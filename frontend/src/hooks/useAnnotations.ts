// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useState } from "react";
import { api } from "../lib/api";
import type {
  AnnotationKind,
  ErrorAnnotation,
  ErrorCategory,
  ErrorSeverity,
} from "../types";

export function useAnnotations(recitationId: string | null) {
  const [annotations, setAnnotations] = useState<ErrorAnnotation[]>([]);
  const [saving, setSaving] = useState(false);

  const loadAnnotations = useCallback(async (recId: string) => {
    try {
      const res = await api.get<ErrorAnnotation[]>("/error-annotations", {
        params: { recitation_id: recId },
      });
      setAnnotations(res.data);
    } catch {
      /* annotations are non-critical */
    }
  }, []);

  // NOTE: In live sessions, prefer sendCreateAnnotation from useSessionWebSocket
  // and receiveAnnotationFromWs to merge the broadcast. Calling addError while
  // subscribed to WS broadcasts will NOT produce duplicates (HTTP doesn't broadcast),
  // but mixing paths in the same view leads to inconsistent state.
  const addError = useCallback(
    async (
      recId: string,
      surah: number,
      ayah: number,
      wordPosition: number | null,
      severity: ErrorSeverity,
      category: ErrorCategory,
      comment?: string,
      kind: AnnotationKind = "error",
    ) => {
      setSaving(true);
      try {
        const res = await api.post<ErrorAnnotation>("/error-annotations", {
          recitation_id: recId,
          surah,
          ayah,
          word_position: wordPosition,
          error_severity: severity,
          error_category: category,
          teacher_comment: comment ?? null,
          annotation_kind: kind,
        });
        setAnnotations((prev) => [...prev, res.data]);
      } catch (e) {
        console.error("Failed to save annotation", e);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const addComment = useCallback(
    async (
      recId: string,
      surah: number,
      ayah: number,
      wordPosition: number | null,
      comment: string,
    ) => {
      return addError(recId, surah, ayah, wordPosition, "khafi", "other", comment, "note");
    },
    [addError],
  );

  const markRepeat = useCallback(
    async (recId: string, surah: number, ayah: number, wordPosition: number | null) => {
      return addError(recId, surah, ayah, wordPosition, "khafi", "other", undefined, "repeat");
    },
    [addError],
  );

  const markGood = useCallback(
    async (recId: string, surah: number, ayah: number, wordPosition: number | null) => {
      return addError(recId, surah, ayah, wordPosition, "khafi", "other", undefined, "good");
    },
    [addError],
  );

  const receiveAnnotationFromWs = useCallback(
    (annotation: ErrorAnnotation) => {
      setAnnotations((prev) => {
        if (recitationId && annotation.recitation_id !== recitationId) return prev;
        if (prev.some((a) => a.id === annotation.id)) return prev;
        return [...prev, annotation];
      });
    },
    [recitationId],
  );

  const removeAnnotationFromWs = useCallback(
    (annotationId: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    },
    [],
  );

  const removeAnnotation = useCallback(async (annotationId: string) => {
    try {
      await api.delete(`/error-annotations/${annotationId}`);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    } catch (e) {
      console.error("Failed to delete annotation", e);
    }
  }, []);

  const getWordAnnotationClass = useCallback((surah: number, ayah: number, wordPosition: number): string => {
    const matches = annotations.filter(
      (a) =>
        a.status === "open" &&
        a.surah === surah &&
        a.ayah === ayah &&
        (a.word_position === wordPosition || a.word_position === null),
    );
    if (matches.length === 0) return "";

    // Priority: error > repeat > note > good
    const error = matches.find((m) => m.annotation_kind === "error");
    if (error) {
      return error.error_severity === "jali"
        ? "mushaf-word--error-jali"
        : "mushaf-word--error-khafi";
    }
    const repeat = matches.find((m) => m.annotation_kind === "repeat");
    if (repeat) return "mushaf-word--repeat";
    const note = matches.find((m) => m.annotation_kind === "note");
    if (note) return "mushaf-word--note";
    const good = matches.find((m) => m.annotation_kind === "good");
    if (good) return "mushaf-word--good";
    return "";
  }, [annotations]);

  const getWordAnnotations = useCallback(
    (surah: number, ayah: number, wordPosition: number): ErrorAnnotation[] => {
      return annotations.filter(
        (a) =>
          a.status === "open" &&
          a.surah === surah &&
          a.ayah === ayah &&
          (a.word_position === wordPosition || a.word_position === null),
      );
    },
    [annotations],
  );

  const ayahHasErrors = useCallback(
    (surah: number, ayah: number): boolean => {
      return annotations.some(
        (a) =>
          a.status === "open" &&
          a.annotation_kind === "error" &&
          a.surah === surah &&
          a.ayah === ayah,
      );
    },
    [annotations],
  );

  return {
    annotations,
    saving,
    loadAnnotations,
    addError,
    addComment,
    markRepeat,
    markGood,
    removeAnnotation,
    receiveAnnotationFromWs,
    removeAnnotationFromWs,
    getWordAnnotationClass,
    getWordAnnotations,
    ayahHasErrors,
  };
}
