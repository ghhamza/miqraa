// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { roomKeys, scheduleKeys } from "../lib/queryKeys";
import { useApiMutation } from "../lib/useApiMutation";
import type {
  Enrollment,
  EnrollmentWithStatus,
  HalaqahType,
  JoinResult,
  Paginated,
  QuranRiwaya,
  RecitationPublic,
  Room,
  RoomSchedule,
  RoomStats,
  SessionPublic,
  StudentOption,
  TeacherOption,
  User,
} from "../types";

type ActiveFilter = "all" | "active" | "inactive";
type MyStatusFilter = "" | "approved" | "pending";

interface RoomsListFilters {
  search: string;
  activeFilter: ActiveFilter;
  halaqahFilter: HalaqahType | "";
  riwayaFilter: QuranRiwaya | "";
  myStatusFilter: MyStatusFilter;
  role?: string;
}

interface RoomsListQueryParams {
  search?: string;
  active?: boolean;
  is_public?: boolean;
  my_status?: "" | "approved" | "pending" | "none";
  limit?: number;
}

export function useRoomsList(
  keyRole: string,
  params?: RoomsListQueryParams,
  options?: { enabled?: boolean; staleTime?: number; select?: (items: Room[]) => Room[] },
) {
  return useQuery({
    queryKey: roomKeys.list({
      search: params?.search ?? "",
      active: params?.active == null ? "all" : params.active ? "active" : "archived",
      myStatus: params?.my_status === "none" ? "" : params?.my_status,
      role: keyRole,
    }),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<Room>>("rooms", { signal, params });
      return data.items;
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime,
    select: options?.select,
  });
}

export function useRoomsWithStats(filters: RoomsListFilters) {
  return useQuery({
    queryKey: roomKeys.list({
      search: filters.search,
      active: filters.activeFilter === "inactive" ? "archived" : filters.activeFilter,
      halaqahType: filters.halaqahFilter || undefined,
      riwaya: filters.riwayaFilter || undefined,
      myStatus: filters.myStatusFilter || undefined,
      role: filters.role,
    }),
    queryFn: async ({ signal }) => {
      const [statsRes, roomsRes] = await Promise.all([
        api.get<RoomStats>("rooms/stats", { signal }),
        api.get<Paginated<Room>>("rooms", {
          signal,
          params: {
            ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
            ...(filters.activeFilter === "all" ? {} : { active: filters.activeFilter === "active" }),
            ...(filters.halaqahFilter ? { halaqah_type: filters.halaqahFilter } : {}),
            ...(filters.riwayaFilter ? { riwaya: filters.riwayaFilter } : {}),
            ...(filters.role === "student" && filters.myStatusFilter ? { my_status: filters.myStatusFilter } : {}),
          },
        }),
      ]);
      return { stats: statsRes.data, rooms: roomsRes.data.items };
    },
  });
}

export function useRoomsStats(enabled = true) {
  return useQuery({
    queryKey: roomKeys.stats(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<RoomStats>("rooms/stats", { signal });
      return data;
    },
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useArchivedRooms() {
  return useQuery({
    queryKey: roomKeys.archived(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<Room>>("rooms", {
        signal,
        params: { active: false },
      });
      return data.items;
    },
  });
}

export function useRoom(id: string | undefined) {
  return useQuery({
    queryKey: roomKeys.detail(id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Room>(`rooms/${id}`, { signal });
      return data;
    },
    enabled: !!id,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) return false;
      return failureCount < 2;
    },
  });
}

export function useRoomEnrollments(roomId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: roomKeys.enrollments(roomId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Enrollment[]>(`rooms/${roomId}/enrollments`, { signal });
      return data;
    },
    enabled: !!roomId && enabled,
  });
}

export function useRoomPendingRequests(roomId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: roomKeys.pending(roomId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<EnrollmentWithStatus[]>(`rooms/${roomId}/enrollments/pending`, { signal });
      return data;
    },
    enabled: !!roomId && enabled,
  });
}

export function useRoomSchedules(roomId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.list(roomId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<RoomSchedule[]>(`rooms/${roomId}/schedules`, { signal });
      return data;
    },
    enabled: !!roomId && enabled,
  });
}

export function useRoomSessionsList(roomId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: roomKeys.sessions(roomId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SessionPublic[]>(`rooms/${roomId}/sessions`, { signal });
      return data;
    },
    enabled: !!roomId && enabled,
  });
}

export function useRoomRecentRecitations(roomId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: roomKeys.recitations(roomId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
        signal,
        params: { room_id: roomId },
      });
      return data.items.slice(0, 15);
    },
    enabled: !!roomId && enabled,
  });
}

export function useRoomTeachers(enabled = true) {
  return useQuery({
    queryKey: roomKeys.teachersList(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<TeacherOption[]>("teachers", { signal });
      return data;
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useAvailableStudentsForRoom(roomId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: roomKeys.studentsList(roomId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<StudentOption[]>("students", {
        params: { exclude_room_id: roomId },
        signal,
      });
      return data;
    },
    enabled: !!roomId && enabled,
    staleTime: 60_000,
  });
}

export function useTeacherScopedStudents(user: User | null, enabled = true) {
  return useQuery({
    queryKey: [
      ...roomKeys.studentsList(),
      { scope: user?.role === "admin" ? "all" : `teacher:${user?.id ?? ""}` },
    ] as const,
    queryFn: async ({ signal }) => {
      if (!user) return [] as StudentOption[];
      if (user.role === "admin") {
        const { data } = await api.get<StudentOption[]>("students", { signal });
        return data;
      }
      const { data: roomsPage } = await api.get<Paginated<Room>>("rooms", { signal });
      const mine = roomsPage.items.filter((r) => r.teacher_id === user.id);
      const map = new Map<string, StudentOption>();
      for (const r of mine) {
        try {
          const { data: ens } = await api.get<
            { student_id: string; student_name: string; student_email: string }[]
          >(`rooms/${r.id}/enrollments`, { signal });
          for (const e of ens) {
            if (!map.has(e.student_id)) {
              map.set(e.student_id, { id: e.student_id, name: e.student_name, email: e.student_email });
            }
          }
        } catch (err) {
          if ((err as { name?: string })?.name === "CanceledError") throw err;
        }
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!user && user.role !== "student" && enabled,
    staleTime: 60_000,
  });
}

export function useCreateRoom(onSuccess?: () => void, onError?: (message: string) => void) {
  return useApiMutation({
    mutationFn: (input: unknown) => api.request({ method: "post", url: "rooms", data: input }),
    invalidates: [roomKeys.lists(), roomKeys.stats()],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

export function useUpdateRoom(onSuccess?: () => void, onError?: (message: string) => void) {
  const queryClient = useQueryClient();
  return useApiMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Record<string, unknown>) =>
      api.request({ method: "put", url: `rooms/${id}`, data: rest }),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: roomKeys.detail(vars.id) });
      await queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: roomKeys.stats() });
      onSuccess?.();
    },
    onError: (message) => onError?.(message),
  });
}

export function useArchiveRoom(onSuccess?: () => void, onError?: (message: string) => void) {
  return useApiMutation({
    mutationFn: (id: string) => api.request({ method: "delete", url: `rooms/${id}` }),
    invalidates: [roomKeys.lists(), roomKeys.archived(), roomKeys.stats()],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

export function useUnarchiveRoom(onSuccess?: () => void, onError?: (message: string) => void) {
  return useApiMutation({
    mutationFn: (id: string) => api.request({ method: "put", url: `rooms/${id}`, data: { is_active: true } }),
    invalidates: [roomKeys.archived(), roomKeys.lists(), roomKeys.stats()],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

export function useJoinRoom(onSuccess?: (result: JoinResult) => void, onError?: (message: string) => void) {
  return useApiMutation<JoinResult, string>({
    mutationFn: async (roomId) => {
      const { data } = await api.request<JoinResult>({ method: "post", url: `rooms/${roomId}/join` });
      return data;
    },
    invalidates: [roomKeys.lists(), roomKeys.stats()],
    onSuccess: (data) => onSuccess?.(data),
    onError: (message) => onError?.(message),
  });
}

export function useWithdrawRoom(roomId: string, onSuccess?: () => void, onError?: (message: string) => void) {
  return useApiMutation({
    mutationFn: () => api.request({ method: "delete", url: `rooms/${roomId}/my-enrollment` }),
    invalidates: [roomKeys.detail(roomId), roomKeys.enrollments(roomId), roomKeys.lists(), roomKeys.stats()],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

export function useEnrollStudent(roomId: string, onSuccess?: () => void, onError?: (message: string) => void) {
  return useApiMutation({
    mutationFn: (student: StudentOption) =>
      api.request({ method: "post", url: `rooms/${roomId}/enrollments`, data: { student_id: student.id } }),
    invalidates: [
      roomKeys.enrollments(roomId),
      roomKeys.detail(roomId),
      roomKeys.lists(),
      roomKeys.studentsList(roomId),
      roomKeys.pending(roomId),
    ],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

export function useRemoveEnrolledStudent(
  roomId: string,
  onSuccess?: () => void,
  onError?: (message: string) => void,
) {
  return useApiMutation({
    mutationFn: (enrollmentId: string) =>
      api.request({ method: "delete", url: `rooms/${roomId}/enrollments/${enrollmentId}` }),
    invalidates: [roomKeys.enrollments(roomId), roomKeys.detail(roomId), roomKeys.pending(roomId)],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

export function useApprovePendingEnrollment(
  roomId: string,
  onSuccess?: () => void,
  onError?: (message: string) => void,
) {
  return useApiMutation({
    mutationFn: (enrollmentId: string) =>
      api.request({ method: "put", url: `rooms/${roomId}/enrollments/${enrollmentId}/approve` }),
    invalidates: [roomKeys.pending(roomId), roomKeys.enrollments(roomId), roomKeys.detail(roomId)],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

export function useRejectPendingEnrollment(
  roomId: string,
  onSuccess?: () => void,
  onError?: (message: string) => void,
) {
  return useApiMutation({
    mutationFn: (enrollmentId: string) =>
      api.request({ method: "put", url: `rooms/${roomId}/enrollments/${enrollmentId}/reject` }),
    invalidates: [roomKeys.pending(roomId), roomKeys.enrollments(roomId), roomKeys.detail(roomId)],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

export function useInvalidateRoomSessions(roomId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: roomKeys.sessions(roomId) });
}

export function useInvalidateRoomRecitations(roomId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: roomKeys.recitations(roomId) });
}
