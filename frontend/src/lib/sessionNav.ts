// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { SessionPublic } from "../types";

export function liveSessionPath(sessionId: string): string {
  return `/sessions/${sessionId}/live`;
}

export function sessionDetailPath(sessionId: string): string {
  return `/sessions/${sessionId}`;
}

/** Calendar / lists: go straight into the room when the session is running. */
export function sessionNavigatePath(session: Pick<SessionPublic, "id" | "status">): string {
  return session.status === "in_progress" ? liveSessionPath(session.id) : sessionDetailPath(session.id);
}
