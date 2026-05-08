// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { homeKeys } from "../lib/queryKeys";

export interface WhatsNewData {
  since: string | null;
  new_recitations: number;
  new_enrollments: number;
  completed_sessions: number;
  pending_requests: number;
}

export function useWhatsNew(userId: string | null, dismissed: boolean) {
  return useQuery({
    queryKey: homeKeys.whatsNew(userId ?? "anon", null),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<WhatsNewData>("me/whats-new", { signal });
      return data;
    },
    enabled: !dismissed && !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
