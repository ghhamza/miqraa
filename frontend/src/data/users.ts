// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { userKeys } from "../lib/queryKeys";
import { useApiMutation } from "../lib/useApiMutation";
import type { Paginated, RecitationPublic, StudentProgress, UserPublic, UserStats } from "../types";

type RoleFilter = "" | "student" | "teacher" | "admin";

export function useUsersList(search: string, role: RoleFilter) {
  const trimmedSearch = search.trim();
  return useQuery({
    queryKey: userKeys.list({
      search: trimmedSearch,
      role: role || undefined,
    }),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<UserPublic>>("users", {
        signal,
        params: {
          ...(role ? { role } : {}),
          ...(trimmedSearch ? { search: trimmedSearch } : {}),
        },
      });
      return data.items;
    },
    placeholderData: keepPreviousData,
  });
}

export function useUsersStats() {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<UserStats>("users/stats", { signal });
      return data;
    },
    staleTime: 60_000,
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<UserPublic>(`users/${id}`, { signal });
      return data;
    },
    enabled: !!id,
  });
}

export function useStudentProgress(studentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: userKeys.studentProgress(studentId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<StudentProgress>(`students/${studentId}/progress`, { signal });
      return data;
    },
    enabled: enabled && !!studentId,
    staleTime: 60_000,
  });
}

export function useStudentRecitations(
  studentId: string | undefined,
  options?: { enabled?: boolean; limit?: number; selectTop?: number },
) {
  const enabled = options?.enabled ?? true;
  const limit = options?.limit;
  const selectTop = options?.selectTop;

  return useQuery({
    queryKey: userKeys.studentRecitations(studentId ?? ""),
    queryFn: async ({ signal }) => {
      if (limit != null) {
        const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
          params: { limit },
          signal,
        });
        return data.items;
      }
      const { data } = await api.get<RecitationPublic[]>(`students/${studentId}/recitations`, { signal });
      return data;
    },
    enabled: enabled && !!studentId,
    staleTime: limit != null ? 30_000 : 0,
    select: (data) => (selectTop != null ? data.slice(0, selectTop) : data),
  });
}

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: "student" | "teacher" | "admin";
}

export function useCreateUser(onSuccess?: () => void, onError?: (message: string) => void) {
  return useApiMutation<unknown, CreateUserInput>({
    mutationFn: (input) => api.request({ method: "post", url: "users", data: input }),
    invalidates: [userKeys.lists(), userKeys.stats()],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

interface UpdateUserInput {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "admin";
}

export function useUpdateUser(onSuccess?: () => void, onError?: (message: string) => void) {
  const queryClient = useQueryClient();
  return useApiMutation<unknown, UpdateUserInput>({
    mutationFn: (input) =>
      api.request({
        method: "put",
        url: `users/${input.id}`,
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
        },
      }),
    invalidates: [userKeys.lists(), userKeys.stats()],
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: userKeys.detail(vars.id) });
      onSuccess?.();
    },
    onError: (message) => onError?.(message),
  });
}

export function useDeleteUser(onSuccess?: () => void, onError?: (message: string) => void) {
  return useApiMutation<unknown, string>({
    mutationFn: (id) => api.request({ method: "delete", url: `users/${id}` }),
    invalidates: [userKeys.lists(), userKeys.stats()],
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}

interface UpdatePasswordInput {
  current_password: string;
  new_password: string;
}

export function useUpdatePassword(onSuccess?: () => void, onError?: (message: string) => void) {
  return useApiMutation<unknown, UpdatePasswordInput>({
    mutationFn: (input) =>
      api.request({
        method: "put",
        url: "auth/password",
        data: input,
      }),
    onSuccess: () => onSuccess?.(),
    onError: (message) => onError?.(message),
  });
}
