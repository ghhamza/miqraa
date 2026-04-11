// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type { Paginated, SessionPublic } from "../types";

const POLL_MS = 30_000;

export interface LiveSessionsContextValue {
  sessions: SessionPublic[];
  hasLiveSession: boolean;
  primaryLiveSession: SessionPublic | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Increments after each successful poll so UI can reset ephemeral state (e.g. banner dismiss). */
  pollVersion: number;
}

const LiveSessionsContext = createContext<LiveSessionsContextValue | null>(null);

export function LiveSessionsProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [sessions, setSessions] = useState<SessionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollVersion, setPollVersion] = useState(0);

  const fetchLive = useCallback(async () => {
    try {
      const { data } = await api.get<Paginated<SessionPublic>>("sessions", {
        params: { status: "in_progress", limit: 100 },
      });
      setSessions(data.items);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
      setPollVersion((v) => v + 1);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchLive();
    const id = window.setInterval(() => void fetchLive(), POLL_MS);
    const onFocus = () => void fetchLive();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, fetchLive]);

  const primaryLiveSession = useMemo(() => {
    if (sessions.length === 0) return null;
    return [...sessions].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )[0]!;
  }, [sessions]);

  const value = useMemo(
    (): LiveSessionsContextValue => ({
      sessions,
      hasLiveSession: sessions.length > 0,
      primaryLiveSession,
      loading,
      refresh: fetchLive,
      pollVersion,
    }),
    [sessions, primaryLiveSession, loading, fetchLive, pollVersion],
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
