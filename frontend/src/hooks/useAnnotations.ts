// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "../lib/useApiMutation";
import { sessionKeys } from "../lib/queryKeys";
import { api } from "../lib/api";
import type {
  AnnotationKind,
  ErrorAnnotation,
  ErrorCategory,
  ErrorSeverity,
} from "../types";

interface AddErrorInput {
  recId: string;
  surah: number;
  ayah: number;
  wordPosition: number | null;
  severity: ErrorSeverity;
  category: ErrorCategory;
  comment?: string;
  kind?: AnnotationKind;
}

interface MutationContext {
  recId: string;
  previous: ErrorAnnotation[] | undefined;
}

export function useAnnotations(recitationId: string | null) {
  const qc = useQueryClient();
  const key = sessionKeys.annotations(recitationId ?? "");

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ErrorAnnotation[]>("/error-annotations", {
        signal,
        params: { recitation_id: recitationId },
      });
      return data;
    },
    enabled: !!recitationId,
  });

  const annotations = query.data ?? [];

  const loadAnnotations = useCallback(
    async (recId: string) => {
      const targetKey = sessionKeys.annotations(recId);
      try {
        const { data: server } = await api.get<ErrorAnnotation[]>("/error-annotations", {
          params: { recitation_id: recId },
        });
        qc.setQueryData<ErrorAnnotation[]>(targetKey, (prev) => {
          const previousList = prev ?? [];
          const serverIds = new Set(server.map((a) => a.id));
          const keptFromWs = previousList.filter(
            (a) => a.recitation_id === recId && !serverIds.has(a.id),
          );
          return [...server, ...keptFromWs];
        });
      } catch {
        /* annotations are non-critical */
      }
    },
    [qc],
  );

  const addErrorMutation = useApiMutation<ErrorAnnotation, AddErrorInput, MutationContext>({
    mutationFn: async (input) => {
      const { data } = await api.request<ErrorAnnotation>({
        method: "post",
        url: "/error-annotations",
        data: {
          recitation_id: input.recId,
          surah: input.surah,
          ayah: input.ayah,
          word_position: input.wordPosition,
          error_severity: input.severity,
          error_category: input.category,
          teacher_comment: input.comment ?? null,
          annotation_kind: input.kind ?? "error",
        },
      });
      return data;
    },
    onMutate: async (input) => {
      const targetKey = sessionKeys.annotations(input.recId);
      await qc.cancelQueries({ queryKey: targetKey });
      const previous = qc.getQueryData<ErrorAnnotation[]>(targetKey);
      const optimistic: ErrorAnnotation = {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        recitation_id: input.recId,
        surah: input.surah,
        ayah: input.ayah,
        word_position: input.wordPosition,
        error_severity: input.severity,
        error_category: input.category,
        teacher_comment: input.comment ?? null,
        annotation_kind: input.kind ?? "error",
        status: "open",
        resolved_at: null,
        resolved_by: null,
        created_at: new Date().toISOString(),
      } as ErrorAnnotation;
      qc.setQueryData<ErrorAnnotation[]>(targetKey, (prev = []) => [...prev, optimistic]);
      return { recId: input.recId, previous };
    },
    onSuccess: (server, _vars, context) => {
      const targetKey = sessionKeys.annotations(context!.recId);
      qc.setQueryData<ErrorAnnotation[]>(targetKey, (prev = []) => {
        const filtered = prev.filter(
          (a) =>
            !(
              a.id.startsWith("tmp-") &&
              a.recitation_id === server.recitation_id &&
              a.surah === server.surah &&
              a.ayah === server.ayah &&
              a.word_position === server.word_position &&
              a.annotation_kind === server.annotation_kind
            ),
        );
        if (filtered.some((a) => a.id === server.id)) return filtered;
        return [...filtered, server];
      });
    },
    onError: (_message, _err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(sessionKeys.annotations(context.recId), context.previous);
      }
    },
  });

  const removeAnnotationMutation = useApiMutation<
    void,
    { recId: string; annotationId: string },
    MutationContext
  >({
    mutationFn: ({ annotationId }) =>
      api.delete(`/error-annotations/${annotationId}`).then(() => undefined),
    onMutate: async ({ recId, annotationId }) => {
      const targetKey = sessionKeys.annotations(recId);
      await qc.cancelQueries({ queryKey: targetKey });
      const previous = qc.getQueryData<ErrorAnnotation[]>(targetKey);
      qc.setQueryData<ErrorAnnotation[]>(targetKey, (prev = []) =>
        prev.filter((a) => a.id !== annotationId),
      );
      return { recId, previous };
    },
    onError: (_message, _err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(sessionKeys.annotations(context.recId), context.previous);
      }
    },
  });

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
      try {
        await addErrorMutation.mutateAsync({
          recId,
          surah,
          ayah,
          wordPosition,
          severity,
          category,
          comment,
          kind,
        });
      } catch {
        // Error is surfaced through rollback; keep prior UX.
      }
    },
    [addErrorMutation],
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

  const removeAnnotation = useCallback(
    async (annotationId: string) => {
      try {
        await removeAnnotationMutation.mutateAsync({
          recId: recitationId ?? "",
          annotationId,
        });
      } catch {
        /* rollback already applied */
      }
    },
    [removeAnnotationMutation, recitationId],
  );

  const receiveAnnotationFromWs = useCallback(
    (annotation: ErrorAnnotation) => {
      const targetKey = sessionKeys.annotations(annotation.recitation_id);
      qc.setQueryData<ErrorAnnotation[]>(targetKey, (prev = []) => {
        const filtered = prev.filter(
          (a) =>
            !(
              a.id.startsWith("tmp-") &&
              a.recitation_id === annotation.recitation_id &&
              a.surah === annotation.surah &&
              a.ayah === annotation.ayah &&
              a.word_position === annotation.word_position &&
              a.annotation_kind === annotation.annotation_kind
            ),
        );
        if (filtered.some((a) => a.id === annotation.id)) return filtered;
        return [...filtered, annotation];
      });
    },
    [qc],
  );

  const removeAnnotationFromWs = useCallback(
    (annotationId: string) => {
      qc.setQueryData<ErrorAnnotation[]>(
        sessionKeys.annotations(recitationId ?? ""),
        (prev = []) => prev.filter((a) => a.id !== annotationId),
      );
    },
    [qc, recitationId],
  );

  const getWordAnnotationClass = useCallback((surah: number, ayah: number, wordPosition: number): string => {
    const matches = annotations.filter(
      (a) =>
        a.status === "open" &&
        a.surah === surah &&
        a.ayah === ayah &&
        (a.word_position === wordPosition || a.word_position === null),
    );
    if (matches.length === 0) return "";
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

  const saving = addErrorMutation.isPending || removeAnnotationMutation.isPending;

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
