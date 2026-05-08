// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useQuery } from "@tanstack/react-query";
import { qfKeys } from "../lib/queryKeys";
import { api } from "../lib/api";

export interface QfStreak {
  days: number;
  longest: number | null;
}

export function useQfStreak(enabled: boolean) {
  const query = useQuery({
    queryKey: qfKeys.streak(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<QfStreak>("qf/me/streak", { signal });
      return data;
    },
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });

  if (!enabled) {
    return { data: null as QfStreak | null, loading: false, linked: false };
  }

  const status = (query.error as { response?: { status?: number } } | null)?.response?.status;
  const linked = status !== 404;

  return {
    data: query.data ?? null,
    loading: query.isPending,
    linked,
  };
}
