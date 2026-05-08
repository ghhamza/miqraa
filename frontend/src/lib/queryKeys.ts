// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/**
 * Central query-key factory for TanStack Query.
 * Reference guide: `frontend/docs/data-fetching.md`.
 *
 * Rules:
 * - Every `useQuery` / `useApiMutation` call site MUST import a key from here.
 * - Never inline a key as `["rooms", ...]` in a page or component.
 * - Each factory returns a tuple `as const`, so the type system tracks
 *   exactly which slot is which parameter.
 * - Keys are namespaced by domain (rooms, sessions, ...) so partial
 *   invalidation works: `qc.invalidateQueries({ queryKey: roomKeys.all })`
 *   refreshes every rooms-related query.
 *
 * When adding a new key, prefer this hierarchy:
 *   - `domain.all`            — invalidates everything in the domain
 *   - `domain.lists()`        — invalidates every list view in the domain
 *   - `domain.list(filters)`  — one specific filtered list
 *   - `domain.details()`      — invalidates every detail view
 *   - `domain.detail(id)`     — one specific entity
 */

// ─── Rooms ───────────────────────────────────────────────────────────────

export const roomKeys = {
  all: ["rooms"] as const,
  stats: () => ["rooms", "stats"] as const,
  lists: () => ["rooms", "list"] as const,
  list: (filters: {
    search: string;
    active: "all" | "active" | "archived";
    halaqahType?: string;
    riwaya?: string;
    myStatus?: "" | "approved" | "pending";
    role?: string;
  }) => ["rooms", "list", filters] as const,
  archived: () => ["rooms", "archived"] as const,
  details: () => ["rooms", "detail"] as const,
  detail: (id: string) => ["rooms", "detail", id] as const,
  enrollments: (roomId: string) => ["rooms", roomId, "enrollments"] as const,
  pending: (roomId: string) => ["rooms", roomId, "pending"] as const,
  recitations: (roomId: string) => ["rooms", roomId, "recitations"] as const,
  sessions: (roomId: string) => ["rooms", roomId, "sessions"] as const,
  teachersList: () => ["rooms", "teachers"] as const,
  studentsList: (excludeRoomId?: string) =>
    ["rooms", "students", excludeRoomId ?? null] as const,
};

// ─── Users ───────────────────────────────────────────────────────────────

export const userKeys = {
  all: ["users"] as const,
  stats: () => ["users", "stats"] as const,
  lists: () => ["users", "list"] as const,
  list: (filters: { search: string; role?: string }) =>
    ["users", "list", filters] as const,
  detail: (id: string) => ["users", "detail", id] as const,
  studentRecitations: (id: string) => ["users", id, "recitations"] as const,
  studentProgress: (id: string) => ["users", id, "progress"] as const,
};

// ─── Sessions ────────────────────────────────────────────────────────────

export const sessionKeys = {
  all: ["sessions"] as const,
  upcoming: () => ["sessions", "upcoming"] as const,
  stats: () => ["sessions", "stats"] as const,
  live: (userId: string | null) => ["sessions", "live", userId] as const,
  calendars: () => ["sessions", "calendar"] as const,
  calendar: (range: { from: string; to: string }) =>
    ["sessions", "calendar", range] as const,
  details: () => ["sessions", "detail"] as const,
  detail: (id: string) => ["sessions", "detail", id] as const,
  attendance: (id: string) => ["sessions", id, "attendance"] as const,
  plans: (sessionId: string) => ["sessions", sessionId, "plans"] as const,
  annotations: (recitationId: string) =>
    ["sessions", "annotations", recitationId] as const,
};

// ─── Schedules (recurring) ───────────────────────────────────────────────

export const scheduleKeys = {
  all: ["schedules"] as const,
  list: (roomId: string) => ["schedules", "list", roomId] as const,
};

// ─── Recitations ─────────────────────────────────────────────────────────

export const recitationKeys = {
  all: ["recitations"] as const,
  stats: () => ["recitations", "stats"] as const,
  lists: () => ["recitations", "list"] as const,
  list: (filters: {
    student?: string;
    room?: string;
    session?: string;
    surah?: number;
    grade?: string;
    turnType?: string;
    from?: string;
    to?: string;
  }) => ["recitations", "list", filters] as const,
  detail: (id: string) => ["recitations", "detail", id] as const,
};

// ─── Quran Foundation ────────────────────────────────────────────────────

export const qfKeys = {
  streak: () => ["qf", "streak"] as const,
  account: () => ["qf", "account"] as const,
};

// ─── Quran content (audio metadata, etc) ─────────────────────────────────

export const quranKeys = {
  chapterAudio: (chapterId: number, reciterId: number) =>
    ["quran", "chapter-audio", chapterId, reciterId] as const,
};

// ─── Home aggregates ─────────────────────────────────────────────────────

export const homeKeys = {
  whatsNew: (userId: string, prevSeen: string | null) =>
    ["home", "whats-new", userId, prevSeen] as const,
};
