// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useState } from "react";
import { api } from "../lib/api";
import type { ErrorAnnotation, ErrorCategory, ErrorSeverity } from "../types";

export function useAnnotations(_recitationId: string | null) {
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

  const addError = useCallback(
    async (
      recId: string,
      surah: number,
      ayah: number,
      wordPosition: number | null,
      severity: ErrorSeverity,
      category: ErrorCategory,
      comment?: string,
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
      return addError(recId, surah, ayah, wordPosition, "khafi", "other", comment);
    },
    [addError],
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
    const match = annotations.find(
      (a) =>
        a.surah === surah &&
        a.ayah === ayah &&
        (a.word_position === wordPosition || a.word_position === null),
    );
    if (!match) return "";
    if (match.error_severity === "jali") return "mushaf-word--error-jali";
    if (match.error_severity === "khafi") return "mushaf-word--error-khafi";
    return "";
  }, [annotations]);

  const ayahHasErrors = useCallback(
    (surah: number, ayah: number): boolean => {
      return annotations.some((a) => a.surah === surah && a.ayah === ayah);
    },
    [annotations],
  );

  return {
    annotations,
    saving,
    loadAnnotations,
    addError,
    addComment,
    removeAnnotation,
    getWordAnnotationClass,
    ayahHasErrors,
  };
}
