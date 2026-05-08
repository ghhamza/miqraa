// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuthStore } from "../stores/authStore";
import type { SessionPublic } from "../types";
import { useLiveSessionsPolling } from "../data/sessions";

export interface LiveSessionsContextValue {
  sessions: SessionPublic[];
  hasLiveSession: boolean;
  primaryLiveSession: SessionPublic | null;
  loading: boolean;
  /** Truthy after a poll fails — surface in UI as a non-blocking warning. */
  error: Error | null;
  refresh: () => Promise<void>;
  /** Increments after each successful poll so UI can reset ephemeral state. */
  pollVersion: number;
}

const LiveSessionsContext = createContext<LiveSessionsContextValue | null>(null);

export function LiveSessionsProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const query = useLiveSessionsPolling(user?.id ?? null, !!user);

  const sessions = query.data ?? [];

  const primaryLiveSession = useMemo(() => {
    if (sessions.length === 0) return null;
    return [...sessions].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )[0]!;
  }, [sessions]);

  const value = useMemo<LiveSessionsContextValue>(
    () => ({
      sessions,
      hasLiveSession: sessions.length > 0,
      primaryLiveSession,
      loading: query.isPending && !!user,
      error: query.error as Error | null,
      refresh: async () => {
        await query.refetch();
      },
      pollVersion: query.dataUpdatedAt,
    }),
    [sessions, primaryLiveSession, query.isPending, query.error, query.refetch, query.dataUpdatedAt, user],
  );

  return <LiveSessionsContext.Provider value={value}>{children}</LiveSessionsContext.Provider>;
}

export function useLiveSessions(): LiveSessionsContextValue {
  const ctx = useContext(LiveSessionsContext);
  if (!ctx) {
    throw new Error("useLiveSessions must be used within LiveSessionsProvider");
  }
  return ctx;
}
