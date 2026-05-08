// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useMemo } from "react";
import { keepPreviousData, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { recitationKeys, sessionKeys, userKeys } from "../lib/queryKeys";
import { useApiMutation } from "../lib/useApiMutation";
import type { Paginated, RecitationPublic, RecitationStats } from "../types";

interface RecitationsListParams {
  surah?: number;
  grade?: string;
  from?: string;
  to?: string;
  student?: string;
  session?: string;
  room?: string;
  riwaya?: string;
}

export function useRecitationsFeed(
  keyRole: string,
  options?: { limit?: number; sessionId?: string; enabled?: boolean; staleTime?: number },
) {
  const limit = options?.limit;
  const sessionId = options?.sessionId;
  return useQuery({
    queryKey: recitationKeys.list({
      ...(sessionId ? { session: sessionId } : {}),
      ...(limit ? { from: `limit:${limit}` } : {}),
      turnType: keyRole,
    }),
    queryFn: async ({ signal }) => {
      const params: Record<string, string | number> = {};
      if (limit != null) params.limit = limit;
      if (sessionId) params.session_id = sessionId;
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", { signal, params });
      return data.items;
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime,
  });
}

export function useSessionRecitations(sessionId: string | undefined, limit?: number, enabled = true) {
  return useRecitationsFeed(
    "session-recitations",
    { sessionId: sessionId ?? undefined, limit, enabled: enabled && !!sessionId, staleTime: 0 },
  );
}

export function useStudentsLastGrades(
  studentIds: string[],
  roomId: string | undefined,
  enabled = true,
) {
  const gradeQueries = useQueries({
    queries: studentIds.map((studentId) => ({
      queryKey: [...recitationKeys.lists(), { studentLastGrade: { studentId, roomId } }] as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
          signal,
          params: { student_id: studentId, room_id: roomId, limit: 1 },
        });
        const first = data.items[0];
        return first?.grade ?? "none";
      },
      enabled: enabled && !!roomId,
      staleTime: 60_000,
    })),
  });

  return useMemo(() => {
    const result: Record<string, RecitationPublic["grade"] | "none"> = {};
    studentIds.forEach((studentId, index) => {
      result[studentId] = gradeQueries[index]?.data ?? "none";
    });
    return result;
  }, [gradeQueries, studentIds]);
}

export function useRecitationsList(
  params: RecitationsListParams,
  extraKey?: Record<string, unknown>,
  enabled = true,
) {
  return useQuery({
    queryKey: [...recitationKeys.list(params), ...(extraKey ? [extraKey] : [])] as const,
    queryFn: async ({ signal }) => {
      const query: Record<string, string> = {};
      if (params.surah != null) query.surah = String(params.surah);
      if (params.grade) query.grade = params.grade;
      if (params.from) query.from = params.from;
      if (params.to) query.to = params.to;
      if (params.student) query.student_id = params.student;
      if (params.session) query.session_id = params.session;
      if (params.room) query.room_id = params.room;
      if (params.riwaya) query.riwaya = params.riwaya;
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", { signal, params: query });
      return data.items;
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRecitationsStats() {
  return useQuery({
    queryKey: recitationKeys.stats(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<RecitationStats>("recitations/stats", { signal });
      return data;
    },
    staleTime: 60_000,
  });
}

export function useDeleteRecitation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useApiMutation<void, RecitationPublic>({
    mutationFn: (rec) => api.request({ method: "delete", url: `recitations/${rec.id}` }).then(() => undefined),
    invalidates: [recitationKeys.lists(), recitationKeys.stats()],
    onSuccess: async (_data, rec) => {
      if (rec.student_id) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: userKeys.studentRecitations(rec.student_id) }),
          qc.invalidateQueries({ queryKey: userKeys.studentProgress(rec.student_id) }),
        ]);
      }
      onSuccess?.();
    },
  });
}

type PlanAction = "start" | "pause" | "skip" | "reopen";
interface TransitionInput {
  planId: string;
  action: PlanAction;
  body?: object;
}
interface TransitionContext {
  previous: RecitationPublic[] | undefined;
}

export function usePlanTransitions(sessionId: string) {
  const qc = useQueryClient();
  const key = recitationKeys.list({ session: sessionId });
  const transitionMutation = useApiMutation<RecitationPublic, TransitionInput, TransitionContext>({
    mutationFn: async ({ planId, action, body }) => {
      const { data } = await api.request<RecitationPublic>({
        method: "post",
        url: `recitations/${planId}/${action}`,
        data: body ?? {},
      });
      return data;
    },
    onMutate: async ({ planId, action }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RecitationPublic[]>(key);
      const optimisticStatus: RecitationPublic["plan_status"] | null =
        action === "start" ? "in_progress" : action === "pause" ? "paused" : action === "skip" ? "skipped" : "planned";
      qc.setQueryData<RecitationPublic[]>(key, (prev = []) =>
        prev.map((p) => (p.id === planId ? { ...p, plan_status: optimisticStatus } : p)),
      );
      return { previous };
    },
    onSuccess: (data) => {
      qc.setQueryData<RecitationPublic[]>(key, (prev = []) => prev.map((p) => (p.id === data.id ? data : p)));
    },
    onError: (_message, _err, _vars, context) => {
      if (context?.previous !== undefined) qc.setQueryData(key, context.previous);
    },
  });

  const transition = useCallback(
    async (planId: string, action: PlanAction, body?: object) => {
      await transitionMutation.mutateAsync({ planId, action, body });
    },
    [transitionMutation],
  );
  const start = useCallback((planId: string) => transition(planId, "start"), [transition]);
  const pause = useCallback((planId: string) => transition(planId, "pause"), [transition]);
  const skip = useCallback((planId: string) => transition(planId, "skip"), [transition]);
  const reopen = useCallback((planId: string, clearGrade = true) => transition(planId, "reopen", { clear_grade: clearGrade }), [transition]);
  return { start, pause, skip, reopen, transition };
}

export function useSaveRecitationTurn(sessionId: string, studentId: string, onSuccess?: () => void, onError?: (m: string) => void) {
  const qc = useQueryClient();
  type SaveTurnInput =
    | { kind: "create"; body: Record<string, unknown> }
    | { kind: "update"; id: string; body: Record<string, unknown> };
  return useApiMutation({
    mutationFn: async (input: SaveTurnInput) => {
      if (input.kind === "create") {
        return api.request({ method: "post", url: "/recitations", data: input.body });
      }
      return api.request({ method: "put", url: `/recitations/${input.id}`, data: input.body });
    },
    invalidates: [recitationKeys.lists(), recitationKeys.stats(), recitationKeys.list({ session: sessionId }), sessionKeys.detail(sessionId)],
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: userKeys.studentRecitations(studentId) }),
        qc.invalidateQueries({ queryKey: userKeys.studentProgress(studentId) }),
      ]);
      onSuccess?.();
    },
    onError: (m) => onError?.(m),
  });
}

type CompletePlanInput = { planId: string; grade: string; notes: string };
export function useCompletePlanRecitation(
  sessionId: string,
  onSuccess?: (data: RecitationPublic) => void,
  onError?: (m: string) => void,
) {
  const qc = useQueryClient();
  return useApiMutation<RecitationPublic, CompletePlanInput>({
    mutationFn: async ({ planId, grade, notes }) => {
      const { data } = await api.request<RecitationPublic>({
        method: "post",
        url: `recitations/${planId}/complete`,
        data: { grade, teacher_notes: notes.trim() || undefined },
      });
      return data;
    },
    onSuccess: async (data) => {
      qc.setQueryData<RecitationPublic[]>(recitationKeys.list({ session: sessionId }), (prev = []) => {
        const rest = prev.filter((r) => r.id !== data.id);
        return [data, ...rest];
      });
      if (data.student_id) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: userKeys.studentRecitations(data.student_id) }),
          qc.invalidateQueries({ queryKey: userKeys.studentProgress(data.student_id) }),
        ]);
      }
      onSuccess?.(data);
    },
    onError: (m) => onError?.(m),
  });
}

type CreateAndGradeInput = {
  student_id: string;
  room_id: string;
  session_id: string;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  grade: string;
  teacher_notes?: string;
  riwaya: string;
};
export function useCreateAndGradeRecitation(
  sessionId: string,
  onSuccess?: (data: RecitationPublic) => void,
  onError?: (m: string) => void,
) {
  const qc = useQueryClient();
  return useApiMutation<RecitationPublic, CreateAndGradeInput>({
    mutationFn: async (input) => {
      const { data } = await api.request<RecitationPublic>({ method: "post", url: "recitations", data: input });
      return data;
    },
    onSuccess: async (data) => {
      qc.setQueryData<RecitationPublic[]>(recitationKeys.list({ session: sessionId }), (prev = []) => [data, ...prev]);
      if (data.student_id) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: userKeys.studentRecitations(data.student_id) }),
          qc.invalidateQueries({ queryKey: userKeys.studentProgress(data.student_id) }),
        ]);
      }
      onSuccess?.(data);
    },
    onError: (m) => onError?.(m),
  });
}

type CreateRecitationInput = {
  student_id: string;
  room_id: string;
  session_id: string;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  riwaya: string;
};
export function useCreateRecitation(
  sessionId: string,
  onSuccess?: (data: RecitationPublic) => void,
  onError?: (m: string) => void,
) {
  const qc = useQueryClient();
  return useApiMutation<RecitationPublic, CreateRecitationInput>({
    mutationFn: async (input) => {
      const { data } = await api.request<RecitationPublic>({ method: "post", url: "recitations", data: input });
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData<RecitationPublic[]>(recitationKeys.list({ session: sessionId }), (prev = []) => [data, ...prev]);
      onSuccess?.(data);
    },
    onError: (m) => onError?.(m),
  });
}

export function usePatchSessionRecitationsCache(sessionId: string | undefined) {
  const qc = useQueryClient();
  const key = recitationKeys.list({ session: sessionId });
  return (patch: (prev: RecitationPublic[] | undefined) => RecitationPublic[] | undefined) =>
    qc.setQueryData<RecitationPublic[] | undefined>(key, patch);
}

type CreateAndStartInput = {
  studentId: string;
  roomId: string;
  sessionId: string;
  surahNum: number;
  ayahStart: number;
  ayahEnd: number;
  turnType: string;
  riwaya: string;
  maxAyah: number;
};
export function useCreateAndStartRecitation(
  onSuccess?: (data: RecitationPublic, studentId: string) => void,
  onError?: (m: string) => void,
) {
  const qc = useQueryClient();
  return useApiMutation<RecitationPublic, CreateAndStartInput>({
    mutationFn: async (input) => {
      const { data: created } = await api.request<RecitationPublic>({
        method: "post",
        url: "recitations",
        data: {
          student_id: input.studentId,
          room_id: input.roomId,
          session_id: input.sessionId,
          surah: input.surahNum,
          ayah_start: Math.min(Math.max(1, input.ayahStart), input.maxAyah),
          ayah_end: Math.min(Math.max(1, input.ayahEnd, input.ayahStart), input.maxAyah),
          turn_type: input.turnType,
          riwaya: input.riwaya,
        },
      });
      const { data: started } = await api.request<RecitationPublic>({
        method: "post",
        url: `recitations/${created.id}/start`,
        data: {},
      });
      return started;
    },
    invalidates: [recitationKeys.lists(), sessionKeys.details()],
    onSuccess: async (started, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: userKeys.studentRecitations(vars.studentId) }),
        qc.invalidateQueries({ queryKey: userKeys.studentProgress(vars.studentId) }),
      ]);
      onSuccess?.(started, vars.studentId);
    },
    onError: (m) => onError?.(m),
  });
}

type CreateRecitationFormInput = {
  student_id: string;
  room_id: string | null;
  session_id: string | null;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  grade: null;
  teacher_notes: null;
  riwaya: string;
};
export function useCreateRecitationFromForm(onSuccess?: () => void, onError?: (m: string) => void) {
  const qc = useQueryClient();
  return useApiMutation<RecitationPublic, CreateRecitationFormInput>({
    mutationFn: async (input) => {
      const { data } = await api.request<RecitationPublic>({ method: "post", url: "recitations", data: input });
      return data;
    },
    invalidates: [recitationKeys.lists(), recitationKeys.stats()],
    onSuccess: async (_rec, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: userKeys.studentRecitations(vars.student_id) }),
        qc.invalidateQueries({ queryKey: userKeys.studentProgress(vars.student_id) }),
      ]);
      onSuccess?.();
    },
    onError: (m) => onError?.(m),
  });
}

type UpdateRecitationFormInput = {
  id: string;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  grade: string | null;
  teacher_notes: string | null;
  studentId: string | null;
};
export function useUpdateRecitationFromForm(onSuccess?: () => void, onError?: (m: string) => void) {
  const qc = useQueryClient();
  return useApiMutation<unknown, UpdateRecitationFormInput>({
    mutationFn: ({ id, studentId, ...rest }) => {
      void studentId;
      return api.put(`recitations/${id}`, rest);
    },
    invalidates: [recitationKeys.lists(), recitationKeys.stats()],
    onSuccess: async (_data, vars) => {
      if (vars.studentId) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: userKeys.studentRecitations(vars.studentId) }),
          qc.invalidateQueries({ queryKey: userKeys.studentProgress(vars.studentId) }),
          qc.invalidateQueries({ queryKey: recitationKeys.detail(vars.id) }),
        ]);
      }
      onSuccess?.();
    },
    onError: (m) => onError?.(m),
  });
}
