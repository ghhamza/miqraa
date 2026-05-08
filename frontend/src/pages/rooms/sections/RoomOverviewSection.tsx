// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Calendar, CalendarClock, CheckCircle, Clock, Users, XCircle } from "lucide-react";
import { api } from "../../../lib/api";
import { scheduleKeys } from "../../../lib/queryKeys";
import { intlLocaleForAppLanguage } from "../../../lib/intlLocale";
import {
  computeEnrollmentStatus,
  type EnrollmentStatusKind,
} from "../../../lib/roomEnrollmentStatus";
import { useLocaleDate } from "../../../hooks/useLocaleDate";
import type { Room, RoomSchedule, User } from "../../../types";
import { Button } from "../../../components/ui/Button";
import { PageCard } from "../../../components/layout/PageCard";

export interface RoomOverviewSectionProps {
  room: Room;
  user: User | null;
  isArchived: boolean;
  studentActionLoading: boolean;
  onStudentJoin: () => void;
  onLeaveRoom: () => void;
  onCancelPendingRequest: () => void;
}

export function RoomOverviewSection({
  room,
  user,
  isArchived,
  studentActionLoading,
  onStudentJoin,
  onLeaveRoom,
  onCancelPendingRequest,
}: RoomOverviewSectionProps) {
  const { t, i18n } = useTranslation();
  const { full } = useLocaleDate();
  const schedulesQuery = useQuery({
    queryKey: scheduleKeys.list(room.id),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<RoomSchedule[]>(`rooms/${room.id}/schedules`, { signal });
      return data;
    },
    enabled: !!room.id,
    select: (data) => data.filter((s) => s.is_active),
  });

  const schedules = schedulesQuery.data ?? [];

  const status = useMemo(() => computeEnrollmentStatus(room), [room]);

  function statusPillClass(kind: EnrollmentStatusKind): string {
    switch (kind) {
      case "open":
      case "approval_required":
      case "already_approved":
        return "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30";
      case "already_pending":
        return "bg-[var(--color-gold)]/10 text-[var(--color-gold)] border-[var(--color-gold)]/40";
      case "full":
      case "closed":
      case "deadline_passed":
      case "not_public":
      case "archived":
      case "already_rejected":
        return "bg-gray-100 text-[var(--color-text-muted)] border-gray-200";
    }
  }

  function formatScheduleLine(schedule: RoomSchedule, locale: string): string {
    const monday = new Date(2024, 0, 1);
    const day = new Date(monday);
    day.setDate(monday.getDate() + schedule.day_of_week);
    const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(day);

    const h = Math.floor(schedule.start_time_minutes / 60);
    const m = schedule.start_time_minutes % 60;
    const startDate = new Date();
    startDate.setHours(h, m, 0, 0);
    const endDate = new Date(startDate.getTime() + schedule.duration_minutes * 60_000);
    const fmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
    const range = `${fmt.format(startDate)}–${fmt.format(endDate)}`;

    return `${dayName} · ${range}`;
  }

  function renderStudentAction() {
    switch (status.kind) {
      case "already_approved":
        return (
          <Button
            type="button"
            variant="secondary"
            loading={studentActionLoading}
            onClick={() => void onLeaveRoom()}
          >
            {t("enrollment.leaveRoom")}
          </Button>
        );
      case "already_pending":
        return (
          <Button
            type="button"
            variant="secondary"
            loading={studentActionLoading}
            onClick={() => void onCancelPendingRequest()}
          >
            {t("enrollment.cancelRequest")}
          </Button>
        );
      case "already_rejected":
        return (
          <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <XCircle className="h-4 w-4 text-red-500" aria-hidden />
            {t("enrollment.rejectedMessage")}
          </span>
        );
      case "open":
      case "approval_required":
        return (
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            className="px-8 shadow-md"
            loading={studentActionLoading}
            onClick={() => void onStudentJoin()}
          >
            {status.kind === "approval_required" ? t("enrollment.requestJoin") : t("enrollment.joinRoom")}
          </Button>
        );
      case "full":
      case "closed":
      case "deadline_passed":
      case "not_public":
      case "archived":
        return null;
    }
  }

  function iconForStatus(kind: EnrollmentStatusKind): ReactElement {
    switch (kind) {
      case "already_approved":
        return <CheckCircle className="h-3.5 w-3.5" aria-hidden />;
      case "already_pending":
        return <Clock className="h-3.5 w-3.5" aria-hidden />;
      case "already_rejected":
        return <XCircle className="h-3.5 w-3.5" aria-hidden />;
      case "deadline_passed":
        return <CalendarClock className="h-3.5 w-3.5" aria-hidden />;
      default:
        return <CheckCircle className="h-3.5 w-3.5" aria-hidden />;
    }
  }

  return (
    <PageCard padding="lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(status.kind)}`}
            >
              {iconForStatus(status.kind)}
              {t(`rooms.enrollmentStatus.${status.kind}`)}
            </span>
            {status.deadlinePassed || (room.enrollment_deadline_at && !status.deadlinePassed) ? (
              <span className="text-xs text-[var(--color-text-muted)]">
                {status.deadlinePassed
                  ? t("rooms.deadlinePassedAt", { date: full(room.enrollment_deadline_at!) })
                  : t("rooms.deadlineCloses", { date: full(room.enrollment_deadline_at!) })}
              </span>
            ) : null}
          </div>
        </div>

        {user?.role === "student" && !isArchived && status.canAct ? (
          <div className="shrink-0 rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4 text-center sm:min-w-[16rem]">
            <p className="mb-3 text-sm font-medium text-[var(--color-text)]">
              {status.kind === "approval_required"
                ? t("enrollment.requestJoinPrompt")
                : t("enrollment.joinPrompt")}
            </p>
            {renderStudentAction()}
          </div>
        ) : user?.role === "student" && !isArchived ? (
          <div className="shrink-0">{renderStudentAction()}</div>
        ) : null}
      </div>

      {room.description ? (
        <p
          className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--color-text-muted)]"
          dir="auto"
        >
          {room.description}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">{t("rooms.teacher")}</p>
            <p className="text-sm font-medium text-[var(--color-text)]">{room.teacher_name}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
          <div className="flex-1">
            <p className="text-xs text-[var(--color-text-muted)]">{t("rooms.capacityLabel")}</p>
            <p className="text-sm font-medium text-[var(--color-text)]">
              {t("rooms.enrolledFraction", {
                enrolled: room.enrolled_count,
                max: room.max_students,
              })}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[var(--color-primary)]/80 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((room.enrolled_count / Math.max(1, room.max_students)) * 100),
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {schedules.length > 0 ? (
          <div className="flex items-start gap-3 sm:col-span-2">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">{t("rooms.meetsLabel")}</p>
              <ul className="mt-1 space-y-0.5">
                {schedules.map((s) => (
                  <li key={s.id} className="text-sm font-medium text-[var(--color-text)]">
                    {formatScheduleLine(s, intlLocaleForAppLanguage(i18n.language))}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </PageCard>
  );
}
