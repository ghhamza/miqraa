// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { scheduleKeys, sessionKeys } from "../lib/queryKeys";
import { useApiMutation } from "../lib/useApiMutation";
import {
  fetchSessionsInRecurrenceGroup,
  filterDeletableScheduled,
  filterTargetsForScope,
} from "../lib/recurrenceSessionTargets";
import type { CreateSessionsResponse, GenerateResult, Paginated, Schedule, SessionDetail, SessionPublic, SessionStats } from "../types";
import type { SessionLivePublicItem } from "../types";

const POLL_MS = 30_000;

export function useUpcomingSessions(enabled = true) {
  return useQuery({
    queryKey: sessionKeys.upcoming(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SessionPublic[]>("sessions/upcoming", { signal });
      return data;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useSessionStats(enabled = true) {
  return useQuery({
    queryKey: sessionKeys.stats(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SessionStats>("sessions/stats", { signal });
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useLiveSessionsPolling(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: sessionKeys.live(userId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<SessionPublic>>("sessions", {
        params: { status: "in_progress", limit: 100 },
        signal,
      });
      return data.items;
    },
    enabled: enabled && !!userId,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: POLL_MS / 2,
  });
}

export function useLivePublicSessions(enabled = true) {
  return useQuery({
    queryKey: [...sessionKeys.live(null), { kind: "live-public" }] as const,
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SessionLivePublicItem[]>("sessions/live-public", { signal });
      return data;
    },
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useSessionDetail(sessionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: sessionKeys.detail(sessionId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SessionDetail>(`/sessions/${sessionId}`, { signal });
      return data;
    },
    enabled: !!sessionId && enabled,
  });
}

export function useSessionsList(
  keyRole: string,
  params: Record<string, string | number | undefined>,
  enabled = true,
) {
  return useQuery({
    queryKey: [...sessionKeys.calendars(), { ...params, keyRole }] as const,
    queryFn: async ({ signal }) => {
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
      ) as Record<string, string | number>;
      const { data } = await api.get<Paginated<SessionPublic>>("/sessions", { signal, params: cleanParams });
      return data;
    },
    enabled,
  });
}

export function useCalendarSessions(
  fromIso: string,
  toIso: string,
  roomFilter: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [...sessionKeys.calendars(), { from: fromIso, to: toIso, roomFilter: roomFilter || null }] as const,
    queryFn: async ({ signal }) => {
      const params: Record<string, string> = { from: fromIso, to: toIso, limit: "500" };
      if (roomFilter) params.room_id = roomFilter;
      const { data } = await api.get<Paginated<SessionPublic>>("sessions", { signal, params });
      return data.items;
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useScheduleList(roomId: string, enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.list(roomId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Schedule[]>(`rooms/${roomId}/schedules`, { signal });
      return data;
    },
    enabled: !!roomId && enabled,
  });
}

export function useCreateSession(onSuccess?: (data: CreateSessionsResponse) => void, onError?: (m: string) => void) {
  return useApiMutation<CreateSessionsResponse, Record<string, unknown>>({
    mutationFn: async (payload) => {
      const { data } = await api.request<CreateSessionsResponse>({
        method: "post",
        url: "sessions",
        data: payload,
      });
      return data;
    },
    invalidates: [sessionKeys.calendars(), sessionKeys.upcoming(), sessionKeys.details()],
    onSuccess: (data) => onSuccess?.(data),
    onError: (m) => onError?.(m),
  });
}

type UpdateSessionVars = {
  session: SessionPublic;
  bodyBase: { title: string | null; duration_minutes: number; notes: string | null };
  iso: string;
  scope: "this" | "this_and_future" | "all";
};

export function useUpdateSession(onSuccess?: () => void, onError?: (m: string) => void) {
  return useApiMutation<void, UpdateSessionVars>({
    mutationFn: async ({ session: target, bodyBase, iso, scope }) => {
      const gid = target.recurrence_group_id;
      if (!gid || scope === "this") {
        await api.request({ method: "put", url: `sessions/${target.id}`, data: { ...bodyBase, scheduled_at: iso } });
        return;
      }
      const groupSessions = await fetchSessionsInRecurrenceGroup(gid, target.room_id);
      const targets = filterTargetsForScope(groupSessions, target, scope);
      for (const s of targets) {
        const isCurrent = s.id === target.id;
        await api.request({
          method: "put",
          url: `sessions/${s.id}`,
          data: { ...bodyBase, scheduled_at: isCurrent ? iso : new Date(s.scheduled_at).toISOString() },
        });
      }
    },
    invalidates: [sessionKeys.calendars(), sessionKeys.upcoming(), sessionKeys.details()],
    onSuccess: () => onSuccess?.(),
    onError: (m) => onError?.(m),
  });
}

type AttendancePayload = Array<{ student_id: string; attended: boolean; attendance_note: string | null }>;
export function useSaveSessionAttendance(
  sessionId: string,
  onSuccess?: (attendance: SessionDetail["attendance"]) => void,
  onError?: (m: string) => void,
) {
  return useApiMutation<SessionDetail["attendance"], AttendancePayload>({
    mutationFn: async (attendance) => {
      const { data } = await api.request<SessionDetail["attendance"]>({
        method: "put",
        url: `sessions/${sessionId}/attendance`,
        data: { attendance },
      });
      return data;
    },
    onSuccess: (data) => onSuccess?.(data),
    onError: (m) => onError?.(m),
  });
}

export function usePatchSessionStatus(
  sessionId: string,
  userId: string | null,
  onSuccess?: (data: SessionPublic) => void,
  onError?: (m: string) => void,
) {
  return useApiMutation<SessionPublic, SessionPublic["status"]>({
    mutationFn: async (status) => {
      const { data } = await api.request<SessionPublic>({
        method: "put",
        url: `sessions/${sessionId}`,
        data: { status },
      });
      return data;
    },
    invalidates: [sessionKeys.calendars(), sessionKeys.upcoming(), sessionKeys.live(userId)],
    onSuccess: (d) => onSuccess?.(d),
    onError: (m) => onError?.(m),
  });
}

export function useStartSession(
  sessionId: string,
  userId: string | null,
  onSuccess?: (data: SessionPublic) => void,
  onError?: (m: string, err: unknown) => void,
) {
  return useApiMutation<SessionPublic, void>({
    mutationFn: async () => {
      const { data } = await api.request<SessionPublic>({
        method: "put",
        url: `sessions/${sessionId}`,
        data: { status: "in_progress" },
      });
      return data;
    },
    invalidates: [sessionKeys.calendars(), sessionKeys.upcoming(), sessionKeys.live(userId)],
    onSuccess: (d) => onSuccess?.(d),
    onError: (m, e) => onError?.(m, e),
  });
}

type DeleteSessionInput = {
  sessionId: string;
  recurrenceGroupId: string | null;
  roomId: string;
  scope: "this" | "this_and_future" | "all";
  refSession: SessionDetail;
};
export function useDeleteSession(
  userId: string | null,
  onSuccess?: () => void,
  onSettled?: () => void,
  onError?: (m: string) => void,
) {
  return useApiMutation<void, DeleteSessionInput>({
    mutationFn: async ({ sessionId, recurrenceGroupId, roomId, scope, refSession }) => {
      if (recurrenceGroupId && scope === "all") {
        await api.request({ method: "delete", url: `sessions/group/${recurrenceGroupId}` });
        return;
      }
      if (recurrenceGroupId && scope === "this_and_future") {
        const groupSessions = await fetchSessionsInRecurrenceGroup(recurrenceGroupId, roomId);
        const slice = filterTargetsForScope(groupSessions, refSession, "this_and_future");
        const targets = filterDeletableScheduled(slice);
        for (const s of targets) {
          await api.request({ method: "delete", url: `sessions/${s.id}` });
        }
        return;
      }
      await api.request({ method: "delete", url: `sessions/${sessionId}` });
    },
    invalidates: [sessionKeys.calendars(), sessionKeys.upcoming(), sessionKeys.live(userId), sessionKeys.details()],
    onSuccess: () => onSuccess?.(),
    onSettled: () => onSettled?.(),
    onError: (m) => onError?.(m),
  });
}

export function useSaveScheduleSlot(roomId: string, onSuccess?: () => void, onError?: (m: string) => void) {
  type SaveScheduleInput = {
    mode: "edit" | "single" | "batch";
    editingId?: string | null;
    title?: string | null;
    days: number[];
    mins: number;
    duration: number;
    isActive: boolean;
  };
  return useApiMutation<unknown, SaveScheduleInput>({
    mutationFn: async (input) => {
      if (input.mode === "edit" && input.editingId) {
        return api.request({
          method: "put",
          url: `schedules/${input.editingId}`,
          data: {
            title: input.title,
            day_of_week: input.days[0] ?? 0,
            start_time_minutes: input.mins,
            duration_minutes: input.duration,
            is_active: input.isActive,
          },
        });
      }
      if (input.mode === "single") {
        return api.request({
          method: "post",
          url: "schedules",
          data: {
            room_id: roomId,
            title: input.title,
            day_of_week: input.days[0] ?? 0,
            start_time_minutes: input.mins,
            duration_minutes: input.duration,
          },
        });
      }
      return api.request({
        method: "post",
        url: "schedules/batch",
        data: {
          room_id: roomId,
          title: input.title,
          slots: input.days.map((day_of_week: number) => ({
            day_of_week,
            start_time_minutes: input.mins,
            duration_minutes: input.duration,
          })),
        },
      });
    },
    invalidates: [scheduleKeys.list(roomId)],
    onSuccess: () => onSuccess?.(),
    onError: (m) => onError?.(m),
  });
}

export function useDeleteSchedule(roomId: string, onSuccess?: () => void, onError?: (m: string) => void) {
  return useApiMutation<unknown, string>({
    mutationFn: (id) => api.request({ method: "delete", url: `schedules/${id}` }),
    invalidates: [scheduleKeys.list(roomId)],
    onSuccess: () => onSuccess?.(),
    onError: (m) => onError?.(m),
  });
}

export function useGenerateSessionsFromSchedules(onSuccess?: (r: GenerateResult) => void, onError?: (m: string) => void) {
  return useApiMutation<GenerateResult, { roomId: string; weeks: number }>({
    mutationFn: async (input) => {
      const tz_offset_minutes = -new Date().getTimezoneOffset();
      const { data } = await api.request<GenerateResult>({
        method: "post",
        url: "schedules/generate",
        data: { room_id: input.roomId, weeks: input.weeks, tz_offset_minutes },
      });
      return data;
    },
    invalidates: [sessionKeys.calendars(), sessionKeys.upcoming()],
    onSuccess: (r) => onSuccess?.(r),
    onError: (m) => onError?.(m),
  });
}

export function usePatchSessionDetailCache(sessionId: string) {
  const qc = useQueryClient();
  return (patch: (prev: SessionDetail | undefined) => SessionDetail | undefined) =>
    qc.setQueryData<SessionDetail | undefined>(sessionKeys.detail(sessionId), patch);
}
