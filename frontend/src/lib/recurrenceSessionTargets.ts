// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { api } from "./api";
import type { Paginated, SessionPublic } from "../types";

const WIDE_DAYS = 400;

function wideRange() {
  const from = new Date();
  from.setDate(from.getDate() - WIDE_DAYS);
  const to = new Date();
  to.setDate(to.getDate() + WIDE_DAYS);
  return { from, to };
}

/** Sessions in the same recurrence group (same room), sorted by time. */
export async function fetchSessionsInRecurrenceGroup(
  recurrenceGroupId: string,
  roomId: string,
  signal?: AbortSignal,
): Promise<SessionPublic[]> {
  const { from, to } = wideRange();
  const { data } = await api.get<Paginated<SessionPublic>>("sessions", {
    params: {
      room_id: roomId,
      from: from.toISOString(),
      to: to.toISOString(),
      limit: "500",
    },
    signal,
  });
  const list = data.items.filter((s) => s.recurrence_group_id === recurrenceGroupId);
  list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  return list;
}

export function filterTargetsForScope(
  sessions: SessionPublic[],
  anchor: SessionPublic,
  scope: "this_and_future" | "all",
): SessionPublic[] {
  if (scope === "all") return sessions;
  const t0 = new Date(anchor.scheduled_at).getTime();
  return sessions.filter((s) => new Date(s.scheduled_at).getTime() >= t0);
}

/** Deletable = scheduled only (matches delete_session rules). */
export function filterDeletableScheduled(sessions: SessionPublic[]): SessionPublic[] {
  return sessions.filter((s) => s.status === "scheduled");
}
