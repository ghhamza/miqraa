// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { Room } from "../types";

export type EnrollmentStatusKind =
  | "open"
  | "approval_required"
  | "full"
  | "deadline_passed"
  | "closed"
  | "not_public"
  | "archived"
  | "already_approved"
  | "already_pending"
  | "already_rejected";

export interface EnrollmentStatusResult {
  kind: EnrollmentStatusKind;
  /** True if a Join / Request CTA should be rendered. */
  canAct: boolean;
  /** True if the deadline (if any) has passed. */
  deadlinePassed: boolean;
}

export function computeEnrollmentStatus(
  room: Room,
  now: Date = new Date(),
): EnrollmentStatusResult {
  const deadlinePassed =
    room.enrollment_deadline_at != null &&
    new Date(room.enrollment_deadline_at).getTime() < now.getTime();

  if (room.my_status === "approved") {
    return { kind: "already_approved", canAct: false, deadlinePassed };
  }
  if (room.my_status === "pending") {
    return { kind: "already_pending", canAct: false, deadlinePassed };
  }
  if (room.my_status === "rejected") {
    return { kind: "already_rejected", canAct: false, deadlinePassed };
  }

  if (!room.is_active) {
    return { kind: "archived", canAct: false, deadlinePassed };
  }
  if (!room.is_public) {
    return { kind: "not_public", canAct: false, deadlinePassed };
  }
  if (!room.enrollment_open) {
    return { kind: "closed", canAct: false, deadlinePassed };
  }
  if (deadlinePassed) {
    return { kind: "deadline_passed", canAct: false, deadlinePassed };
  }
  if (room.enrolled_count >= room.max_students) {
    return { kind: "full", canAct: false, deadlinePassed };
  }
  if (room.requires_approval) {
    return { kind: "approval_required", canAct: true, deadlinePassed };
  }
  return { kind: "open", canAct: true, deadlinePassed };
}
