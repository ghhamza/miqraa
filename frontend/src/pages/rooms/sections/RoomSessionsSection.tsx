// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Room, SessionPublic, User } from "../../../types";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { PageCard } from "../../../components/layout/PageCard";
import { SessionBlock } from "../../../components/sessions/SessionBlock";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useLocaleDate } from "../../../hooks/useLocaleDate";
import { intlLocaleForAppLanguage } from "../../../lib/intlLocale";
import { sessionNavigatePath } from "../../../lib/sessionNav";
import { calendarGridStart, isToday, toYmdLocal } from "../../../lib/calendarUtils";

function canManage(user: User | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

function sessionStatusLabelKey(status: SessionPublic["status"]): string {
  return status === "in_progress" ? "inProgress" : status;
}

export type RoomSessionsViewMode = "calendar" | "list";

function groupSessionsByDay(sessions: SessionPublic[]): Map<string, SessionPublic[]> {
  const m = new Map<string, SessionPublic[]>();
  for (const s of sessions) {
    const key = toYmdLocal(new Date(s.scheduled_at));
    const arr = m.get(key) ?? [];
    arr.push(s);
    m.set(key, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }
  return m;
}

export interface RoomSessionsSectionProps {
  room: Room;
  user: User | null;
  roomRouteId: string | undefined;
  sessions: SessionPublic[];
  sessionsLoading: boolean;
  sessionsViewMode: RoomSessionsViewMode;
  setSessionsViewMode: (m: RoomSessionsViewMode) => void;
  calendarCursor: Date;
  setCalendarCursor: Dispatch<SetStateAction<Date>>;
  listMonthCursor: Date;
  setListMonthCursor: Dispatch<SetStateAction<Date>>;
  isArchived: boolean;
  onSessionFormOpen: () => void;
  onCalendarDayClick: (d: Date) => void;
}

export function RoomSessionsSection({
  room,
  user,
  roomRouteId,
  sessions,
  sessionsLoading,
  sessionsViewMode,
  setSessionsViewMode,
  calendarCursor,
  setCalendarCursor,
  listMonthCursor,
  setListMonthCursor,
  isArchived,
  onSessionFormOpen,
  onCalendarDayClick,
}: RoomSessionsSectionProps) {
  const { t, i18n } = useTranslation();
  const { full } = useLocaleDate();
  const navigate = useNavigate();
  const showActions = canManage(user, room);
  const locale = intlLocaleForAppLanguage(i18n.language);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2024, 0, 1 + i);
      labels.push(fmt.format(d));
    }
    return labels;
  }, [locale]);

  const monthCells = useMemo(() => {
    const start = calendarGridStart(calendarCursor);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [calendarCursor]);

  const sessionsByDay = useMemo(() => groupSessionsByDay(sessions), [sessions]);

  const calendarPeriodLabel = useMemo(() => {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(calendarCursor);
  }, [calendarCursor, locale]);

  function openSessionFormDefault() {
    onSessionFormOpen();
  }

  return (
    <PageCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("rooms.upcomingSessions")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-gray-200 bg-[var(--color-bg)] p-0.5"
            role="group"
            aria-label={t("rooms.upcomingSessions")}
          >
            <button
              type="button"
              aria-pressed={sessionsViewMode === "calendar"}
              aria-label={t("rooms.sessionsCalendarView")}
              title={t("rooms.sessionsCalendarView")}
              onClick={() => {
                setCalendarCursor(new Date(listMonthCursor.getFullYear(), listMonthCursor.getMonth(), 15));
                setSessionsViewMode("calendar");
              }}
              className={`rounded-lg p-2 transition ${
                sessionsViewMode === "calendar"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:bg-white/80"
              }`}
            >
              <Calendar className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-pressed={sessionsViewMode === "list"}
              aria-label={t("rooms.sessionsListView")}
              title={t("rooms.sessionsListView")}
              onClick={() => {
                setListMonthCursor(
                  new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1, 0, 0, 0, 0),
                );
                setSessionsViewMode("list");
              }}
              className={`rounded-lg p-2 transition ${
                sessionsViewMode === "list"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:bg-white/80"
              }`}
            >
              <List className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {showActions ? (
            <Button type="button" variant="primary" disabled={isArchived} onClick={() => openSessionFormDefault()}>
              {t("sessions.addSession")}
            </Button>
          ) : null}
        </div>
      </div>
      {sessionsViewMode === "calendar" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!p-2"
              onClick={() =>
                setCalendarCursor((c) => {
                  const n = new Date(c);
                  n.setMonth(n.getMonth() - 1);
                  return n;
                })
              }
              aria-label={t("rooms.calendarPrevMonth")}
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <span className="min-w-[10rem] text-center text-base font-semibold text-[var(--color-text)]">
              {calendarPeriodLabel}
            </span>
            <Button
              type="button"
              variant="secondary"
              className="!p-2"
              onClick={() =>
                setCalendarCursor((c) => {
                  const n = new Date(c);
                  n.setMonth(n.getMonth() + 1);
                  return n;
                })
              }
              aria-label={t("rooms.calendarNextMonth")}
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCalendarCursor(new Date())}>
              {t("sessions.today")}
            </Button>
          </div>
          {sessionsLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-7 gap-1">
                {weekdayLabels.map((name) => (
                  <div key={name} className="p-2 text-center text-xs font-semibold text-[var(--color-text-muted)]">
                    {name}
                  </div>
                ))}
                {monthCells.map((d) => {
                  const key = toYmdLocal(d);
                  const daySessions = sessionsByDay.get(key) ?? [];
                  const muted =
                    d.getMonth() !== calendarCursor.getMonth() || d.getFullYear() !== calendarCursor.getFullYear();
                  const today = isToday(d);
                  return (
                    <div
                      key={key}
                      className={`min-h-[7rem] rounded-xl border p-1 ${
                        today
                          ? "border-[var(--color-primary)]/40 bg-[#E8F5E9]"
                          : "border-gray-100 bg-[var(--color-surface)]"
                      } ${muted ? "opacity-50" : ""}`}
                    >
                      <button
                        type="button"
                        className="mb-1 w-full text-start text-sm font-medium text-[var(--color-text)]"
                        disabled={isArchived || !showActions}
                        onClick={() => onCalendarDayClick(d)}
                      >
                        {d.getDate()}
                      </button>
                      <div className="flex max-h-[5.5rem] flex-col gap-1 overflow-y-auto">
                        {daySessions.slice(0, 3).map((s) => (
                          <SessionBlock
                            key={s.id}
                            session={s}
                            compact
                            onClick={() => navigate(sessionNavigatePath(s))}
                          />
                        ))}
                        {daySessions.length > 3 ? (
                          <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                            +{daySessions.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!p-2"
              onClick={() =>
                setListMonthCursor((c) => {
                  const n = new Date(c);
                  n.setMonth(n.getMonth() - 1);
                  return new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0, 0);
                })
              }
              aria-label={t("rooms.calendarPrevMonth")}
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={roomRouteId ? `room-${roomRouteId}-list-month` : "room-sessions-list-month"}
                className="whitespace-nowrap text-sm text-[var(--color-text-muted)]"
              >
                {t("rooms.listMonth")}
              </label>
              <input
                id={roomRouteId ? `room-${roomRouteId}-list-month` : "room-sessions-list-month"}
                type="month"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[var(--color-text)]"
                value={`${listMonthCursor.getFullYear()}-${String(listMonthCursor.getMonth() + 1).padStart(2, "0")}`}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const [y, mo] = v.split("-").map(Number);
                  setListMonthCursor(new Date(y, mo - 1, 1, 0, 0, 0, 0));
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="!p-2"
              onClick={() =>
                setListMonthCursor((c) => {
                  const n = new Date(c);
                  n.setMonth(n.getMonth() + 1);
                  return new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0, 0);
                })
              }
              aria-label={t("rooms.calendarNextMonth")}
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const d = new Date();
                setListMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0));
              }}
            >
              {t("sessions.thisMonth")}
            </Button>
          </div>
          {sessionsLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-12 w-12" />}
              title={t("roomDetail.sessionsEmptyTitle")}
              description={t("roomDetail.sessionsEmptyDescription")}
              primaryAction={
                canManage(user, room) && !isArchived
                  ? { label: t("sessions.addSession"), onClick: () => openSessionFormDefault() }
                  : undefined
              }
            />
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    to={sessionNavigatePath(s)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
                  >
                    <div>
                      <p className="font-medium text-[var(--color-text)]">
                        {s.title?.trim() || t("sessions.untitledTitle")}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)]">{full(s.scheduled_at)}</p>
                    </div>
                    <Badge
                      variant={
                        s.status === "in_progress"
                          ? "blue"
                          : s.status === "cancelled" || s.status === "completed"
                            ? "gray"
                            : "green"
                      }
                    >
                      {t(`sessions.${sessionStatusLabelKey(s.status)}`)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageCard>
  );
}
