// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Pencil,
  RotateCcw,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { Enrollment, Paginated, RecitationPublic, Room, SessionPublic } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { RoomFormModal } from "../../components/rooms/RoomFormModal";
import { ArchiveRoomModal } from "../../components/rooms/ArchiveRoomModal";
import { EnrolledStudentsList } from "../../components/enrollment/EnrolledStudentsList";
import { BackLink } from "../../components/navigation/BackLink";
import { PendingRequestsList } from "../../components/enrollment/PendingRequestsList";
import { EnrollStudentModal } from "../../components/enrollment/EnrollStudentModal";
import { RemoveStudentModal } from "../../components/enrollment/RemoveStudentModal";
import { SessionFormModal } from "../../components/sessions/SessionFormModal";
import { SessionBlock } from "../../components/sessions/SessionBlock";
import { RecitationFormModal } from "../../components/recitations/RecitationFormModal";
import { RecentRecitationsList } from "../../components/recitations/RecentRecitationsList";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { riwayaBadgeClass } from "../../lib/riwayaUi";
import {
  calendarGridEnd,
  calendarGridStart,
  endOfMonth,
  isToday,
  startOfMonth,
  toYmdLocal,
} from "../../lib/calendarUtils";

function canManage(user: { id: string; role: string } | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

function sessionStatusLabelKey(status: SessionPublic["status"]): string {
  return status === "in_progress" ? "inProgress" : status;
}

type RoomSessionsViewMode = "calendar" | "list";

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

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { full } = useLocaleDate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [room, setRoom] = useState<Room | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removeEnrollment, setRemoveEnrollment] = useState<Enrollment | null>(null);
  const [sessions, setSessions] = useState<SessionPublic[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsViewMode, setSessionsViewMode] = useState<RoomSessionsViewMode>("calendar");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [listMonthCursor, setListMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  });
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [sessionPrefillDate, setSessionPrefillDate] = useState<Date | null>(null);
  const [sessionPresetMorning, setSessionPresetMorning] = useState(false);
  const [roomRecitations, setRoomRecitations] = useState<RecitationPublic[]>([]);
  const [recitationsLoading, setRecitationsLoading] = useState(false);
  const [recitationFormOpen, setRecitationFormOpen] = useState(false);
  const [studentActionLoading, setStudentActionLoading] = useState(false);

  const loadRoom = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<Room>(`rooms/${id}`);
    setRoom(data);
  }, [id]);

  const loadEnrollments = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<Enrollment[]>(`rooms/${id}/enrollments`);
    setEnrollments(data);
  }, [id]);

  const refreshSessions = useCallback(async () => {
    if (!id) return;
    if (sessionsViewMode === "calendar") {
      const from = calendarGridStart(calendarCursor);
      const to = calendarGridEnd(calendarCursor);
      const { data } = await api.get<Paginated<SessionPublic>>("sessions", {
        params: {
          room_id: id,
          from: from.toISOString(),
          to: to.toISOString(),
          limit: "500",
        },
      });
      setSessions(data.items);
      return;
    }
    const from = startOfMonth(listMonthCursor);
    const to = endOfMonth(listMonthCursor);
    const { data } = await api.get<Paginated<SessionPublic>>("sessions", {
      params: {
        room_id: id,
        from: from.toISOString(),
        to: to.toISOString(),
        limit: "500",
      },
    });
    const sorted = [...data.items].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    );
    setSessions(sorted);
  }, [id, sessionsViewMode, calendarCursor, listMonthCursor]);

  const loadRoomRecitations = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
      params: { room_id: id },
    });
    setRoomRecitations(data.items.slice(0, 15));
  }, [id]);

  const refreshAfterMutation = useCallback(async () => {
    if (!id || !user) return;
    const { data: r } = await api.get<Room>(`rooms/${id}`);
    setRoom(r);
    if (canManage(user, r)) {
      try {
        const { data } = await api.get<Enrollment[]>(`rooms/${id}/enrollments`);
        setEnrollments(data);
      } catch {
        setEnrollments([]);
      }
    } else {
      setEnrollments([]);
    }
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setForbidden(false);
    void (async () => {
      try {
        await loadRoom();
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          if (!cancelled) setForbidden(true);
          if (!cancelled) setRoom(null);
        } else {
          if (!cancelled) setRoom(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadRoom]);

  useEffect(() => {
    if (!id || !room || !user) return;
    if (!canManage(user, room)) {
      setEnrollments([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await loadEnrollments();
      } catch {
        if (!cancelled) setEnrollments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, room, user, loadEnrollments]);

  useEffect(() => {
    if (!id || !room) return;
    let cancelled = false;
    setSessionsLoading(true);
    void (async () => {
      try {
        await refreshSessions();
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, room, refreshSessions]);

  useEffect(() => {
    if (!id || !room) return;
    let cancelled = false;
    setRecitationsLoading(true);
    void (async () => {
      try {
        await loadRoomRecitations();
      } catch {
        if (!cancelled) setRoomRecitations([]);
      } finally {
        if (!cancelled) setRecitationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, room, loadRoomRecitations]);

  const locale = i18n.language === "en" ? "en-US" : i18n.language === "fr" ? "fr-FR" : "ar-SA";

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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p className="text-[var(--color-text-muted)]">{t("rooms.forbiddenRoom")}</p>
        <Link to="/rooms" className="mt-4 inline-block text-[var(--color-primary)]">
          {t("rooms.backToRooms")}
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p className="text-[var(--color-text-muted)]">{t("rooms.roomNotFound")}</p>
        <Link to="/rooms" className="mt-4 inline-block text-[var(--color-primary)]">
          {t("rooms.backToRooms")}
        </Link>
      </div>
    );
  }

  const showActions = canManage(user, room);
  const enrolledCount = room.enrolled_count;
  const isArchived = !room.is_active;

  async function handleRestore() {
    if (!room || restoreLoading) return;
    setRestoreLoading(true);
    try {
      await api.put(`rooms/${room.id}`, { is_active: true });
      await refreshAfterMutation();
    } finally {
      setRestoreLoading(false);
    }
  }

  async function handleStudentJoin() {
    if (!room || !id || studentActionLoading) return;
    setStudentActionLoading(true);
    try {
      await api.post(`rooms/${room.id}/join`);
      await refreshAfterMutation();
    } catch (err) {
      window.alert(userFacingApiError(err));
    } finally {
      setStudentActionLoading(false);
    }
  }

  async function handleCancelPendingRequest() {
    if (!room || !id || studentActionLoading) return;
    if (!window.confirm(t("enrollment.cancelRequestConfirm"))) return;
    setStudentActionLoading(true);
    try {
      await api.delete(`rooms/${room.id}/my-enrollment`);
      await refreshAfterMutation();
    } catch (err) {
      window.alert(userFacingApiError(err));
    } finally {
      setStudentActionLoading(false);
    }
  }

  async function handleLeaveRoom() {
    if (!room || !id || studentActionLoading) return;
    if (!window.confirm(t("enrollment.leaveConfirm"))) return;
    setStudentActionLoading(true);
    try {
      await api.delete(`rooms/${room.id}/my-enrollment`);
      await refreshAfterMutation();
    } catch (err) {
      window.alert(userFacingApiError(err));
    } finally {
      setStudentActionLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <BackLink to="/rooms">{t("rooms.backToRooms")}</BackLink>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className="text-3xl font-bold text-[var(--color-text)] md:text-4xl"
            style={{ fontFamily: "var(--font-quran)" }}
          >
            {room.name}
          </h1>
          <span
            className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${riwayaBadgeClass(room.riwaya)}`}
          >
            {t(`mushaf.${room.riwaya}`)}
          </span>
        </div>
        {showActions ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </span>
            </Button>
            {isArchived ? (
              <Button type="button" variant="primary" loading={restoreLoading} onClick={() => void handleRestore()}>
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {t("common.restore")}
                </span>
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setArchiveOpen(true)}>
                <span className="inline-flex items-center gap-2 text-amber-800">
                  <Archive className="h-4 w-4" />
                  {t("common.archive")}
                </span>
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {isArchived ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {t("rooms.archivedRoomNotice")}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <dl className="space-y-4 text-start">
          <div>
            <dt className="text-sm text-[var(--color-text-muted)]">{t("rooms.teacher")}</dt>
            <dd className="mt-1 text-lg font-medium text-[var(--color-text)]">{room.teacher_name}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--color-text-muted)]">{t("rooms.maxStudents")}</dt>
            <dd className="mt-1 text-lg text-[var(--color-text)]">{room.max_students}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--color-text-muted)]">{t("rooms.status")}</dt>
            <dd className="mt-2">
              <Badge variant={room.is_active ? "green" : "gray"}>
                {room.is_active ? t("common.active") : t("common.inactive")}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--color-text-muted)]">{t("rooms.createdAt")}</dt>
            <dd className="mt-1 text-[var(--color-text)]">{full(room.created_at)}</dd>
          </div>
        </dl>
      </div>

      {user?.role === "student" && !isArchived ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          {room.my_status === "approved" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 shrink-0 text-[var(--color-primary)]" aria-hidden />
                <p className="font-medium text-[var(--color-text)]">{t("enrollment.youAreEnrolled")}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                loading={studentActionLoading}
                onClick={() => void handleLeaveRoom()}
              >
                {t("enrollment.leaveRoom")}
              </Button>
            </div>
          ) : room.my_status === "pending" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 shrink-0 text-[var(--color-gold)]" aria-hidden />
                <p className="font-medium text-[var(--color-text)]">{t("enrollment.pendingMessage")}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                loading={studentActionLoading}
                onClick={() => void handleCancelPendingRequest()}
              >
                {t("enrollment.cancelRequest")}
              </Button>
            </div>
          ) : room.my_status === "rejected" ? (
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 shrink-0 text-red-500" aria-hidden />
              <p className="font-medium text-[var(--color-text)]">{t("enrollment.rejectedMessage")}</p>
            </div>
          ) : room.is_public &&
            room.enrollment_open &&
            !room.my_status &&
            room.enrolled_count < room.max_students ? (
            <Button
              type="button"
              variant="primary"
              loading={studentActionLoading}
              onClick={() => void handleStudentJoin()}
            >
              {room.requires_approval ? t("enrollment.requestJoin") : t("enrollment.joinRoom")}
            </Button>
          ) : !room.enrollment_open ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t("enrollment.enrollmentClosed")}</p>
          ) : room.enrolled_count >= room.max_students ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t("enrollment.roomFull")}</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {t("enrollment.headerCount", { count: enrolledCount, max: room.max_students })}
          </h2>
          {showActions ? (
            <Button
              type="button"
              variant="primary"
              disabled={isArchived || enrolledCount >= room.max_students}
              onClick={() => setEnrollOpen(true)}
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {t("enrollment.enrollStudent")}
              </span>
            </Button>
          ) : null}
        </div>
        {showActions ? (
          <EnrolledStudentsList
            enrollments={enrollments}
            maxStudents={room.max_students}
            canManage={showActions}
            onRemove={(e) => setRemoveEnrollment(e)}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text)]">
              {t("enrollment.studentCount", { count: enrolledCount })}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">{t("enrollment.listRestricted")}</p>
          </div>
        )}
      </section>

      {showActions && room.pending_count > 0 && !isArchived ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
            {t("enrollment.pendingSectionTitle")}
          </h2>
          <PendingRequestsList roomId={room.id} onChanged={() => void refreshAfterMutation()} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
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
              <Button
                type="button"
                variant="primary"
                disabled={isArchived}
                onClick={() => {
                  setSessionPrefillDate(null);
                  setSessionPresetMorning(false);
                  setSessionFormOpen(true);
                }}
              >
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
                          onClick={() => {
                            setSessionPrefillDate(d);
                            setSessionPresetMorning(true);
                            setSessionFormOpen(true);
                          }}
                        >
                          {d.getDate()}
                        </button>
                        <div className="flex max-h-[5.5rem] flex-col gap-1 overflow-y-auto">
                          {daySessions.slice(0, 3).map((s) => (
                            <SessionBlock
                              key={s.id}
                              session={s}
                              compact
                              onClick={() => navigate(`/sessions/${s.id}`)}
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
                  htmlFor={id ? `room-${id}-list-month` : "room-sessions-list-month"}
                  className="whitespace-nowrap text-sm text-[var(--color-text-muted)]"
                >
                  {t("rooms.listMonth")}
                </label>
                <input
                  id={id ? `room-${id}-list-month` : "room-sessions-list-month"}
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
              <p className="text-sm text-[var(--color-text-muted)]">{t("sessions.noSessions")}</p>
            ) : (
              <ul className="space-y-3">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/sessions/${s.id}`}
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
      </section>

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("recitations.roomRecitations")}</h2>
          {showActions ? (
            <Button type="button" variant="primary" disabled={isArchived} onClick={() => setRecitationFormOpen(true)}>
              {t("recitations.addRecitation")}
            </Button>
          ) : null}
        </div>
        {recitationsLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : (
          <RecentRecitationsList items={roomRecitations} />
        )}
      </section>

      <SessionFormModal
        open={sessionFormOpen}
        mode="create"
        session={null}
        defaultRoomId={room.id}
        defaultDatetime={sessionPrefillDate}
        presetMorningStart={sessionPresetMorning}
        onClose={() => {
          setSessionFormOpen(false);
          setSessionPrefillDate(null);
          setSessionPresetMorning(false);
        }}
        onSaved={() => void refreshSessions()}
      />

      <RecitationFormModal
        open={recitationFormOpen}
        mode="create"
        recitation={null}
        defaultRoomId={room.id}
        defaultRoomName={room.name}
        onClose={() => setRecitationFormOpen(false)}
        onSaved={() => void loadRoomRecitations()}
      />

      <RoomFormModal
        open={formOpen}
        mode="edit"
        room={room}
        isAdmin={isAdmin}
        onClose={() => setFormOpen(false)}
        onSaved={() => void refreshAfterMutation()}
      />

      <ArchiveRoomModal
        open={archiveOpen}
        roomId={room.id}
        roomName={room.name}
        onClose={() => setArchiveOpen(false)}
        onArchived={() => navigate("/rooms", { replace: true })}
      />

      <EnrollStudentModal
        open={enrollOpen}
        roomId={room.id}
        maxStudents={room.max_students}
        currentCount={enrolledCount}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={() => void refreshAfterMutation()}
      />

      <RemoveStudentModal
        open={removeEnrollment !== null}
        roomId={room.id}
        enrollment={removeEnrollment}
        onClose={() => setRemoveEnrollment(null)}
        onRemoved={() => void refreshAfterMutation()}
      />
    </div>
  );
}
