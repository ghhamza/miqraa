// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BookMarked, BookOpen, Calendar, Clock, Pencil, Repeat, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RecitationPublic, SessionPublic } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SessionFormModal } from "../../components/sessions/SessionFormModal";
import { DeleteSessionModal } from "../../components/sessions/DeleteSessionModal";
import { RecurrenceScopeModal } from "../../components/sessions/RecurrenceScopeModal";
import { AttendanceSheet, type GradeColor } from "../../components/sessions/AttendanceSheet";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { RecitationFormModal } from "../../components/recitations/RecitationFormModal";
import { RecentRecitationsList } from "../../components/recitations/RecentRecitationsList";
import { SessionRecitationsSortableList } from "../../components/sessions/SessionRecitationsSortableList";
import { SessionCountdown } from "../../components/sessions/SessionCountdown";
import { Modal } from "../../components/ui/Modal";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import { cn } from "@/lib/utils";
import {
  useDeleteSession,
  usePatchSessionDetailCache,
  usePatchSessionStatus,
  useSaveSessionAttendance,
  useSessionDetail,
  useStartSession,
} from "../../data/sessions";
import {
  usePatchSessionRecitationsCache,
  useSessionRecitations,
  useStudentsLastGrades,
} from "../../data/recitations";

/** Localized “in 3 days” / “in 25 minutes” for the early-start confirmation. */
function formatScheduledRelativeToNow(iso: string, intlLocale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const ms = then - now;
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
  const sec = Math.round(ms / 1000);
  if (Math.abs(sec) < 60) return rtf.format(sec, "second");
  const min = Math.round(ms / 60000);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const hour = Math.round(ms / 3600000);
  if (Math.abs(hour) < 24) return rtf.format(hour, "hour");
  const day = Math.round(ms / 86400000);
  return rtf.format(day, "day");
}

function canManage(user: { id: string; role: string } | null, session: SessionPublic): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === session.teacher_id;
}

function statusLabelKey(s: SessionPublic["status"]): string {
  switch (s) {
    case "in_progress":
      return "inProgress";
    default:
      return s;
  }
}

function SessionStatusBadge({ status }: { status: SessionPublic["status"] }) {
  const { t } = useTranslation();
  const label = t(`sessions.${statusLabelKey(status)}`);
  switch (status) {
    case "scheduled":
      return (
        <Badge
          variant="outline"
          className="border-[#1B5E20]/40 bg-transparent font-medium text-[#1B5E20] dark:text-emerald-300"
        >
          {label}
        </Badge>
      );
    case "in_progress":
      return (
        <Badge
          variant="outline"
          className="animate-pulse border-red-500/50 bg-red-50 font-medium text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100"
        >
          {label}
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="outline"
          className="border-emerald-800/25 bg-emerald-50/90 font-medium text-emerald-900 dark:border-emerald-600/30 dark:bg-emerald-950/30 dark:text-emerald-100"
        >
          {label}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge
          variant="outline"
          className="border-red-600/50 bg-transparent font-medium text-red-800 dark:text-red-200"
        >
          {label}
        </Badge>
      );
    default:
      return <Badge variant="gray">{label}</Badge>;
  }
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { t, i18n } = useTranslation();
  const { mediumTime, shortWeekdayDate, timeShort, full } = useLocaleDate();
  const user = useAuthStore((s) => s.user);

  const [formOpen, setFormOpen] = useState(false);
  const [editScope, setEditScope] = useState<"this" | "this_and_future" | "all" | undefined>(undefined);
  const [recurrencePrompt, setRecurrencePrompt] = useState<"edit" | "delete" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState<"this" | "this_and_future" | "all" | null>(null);
  const [localAttendance, setLocalAttendance] = useState<Record<string, boolean>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [recitationFormOpen, setRecitationFormOpen] = useState(false);
  const [recitationEditing, setRecitationEditing] = useState<RecitationPublic | null>(null);
  const [liveSessionFlash, setLiveSessionFlash] = useState<string | null>(null);
  const [activeSessionConflictId, setActiveSessionConflictId] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [earlyStartConfirmOpen, setEarlyStartConfirmOpen] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  const patchSessionDetail = usePatchSessionDetailCache(id ?? "");
  const patchSessionRecitations = usePatchSessionRecitationsCache(id);

  const detailQuery = useSessionDetail(id, !!id);

  const detail = detailQuery.data ?? null;
  const loading = detailQuery.isPending;
  const forbidden =
    (detailQuery.error as { response?: { status?: number } } | null)?.response?.status === 403;

  const sessionRecitationsQuery = useSessionRecitations(id, undefined, !!id);

  const sessionRecitations = sessionRecitationsQuery.data ?? [];

  useEffect(() => {
    if (!detail) return;
    const nextAttendance: Record<string, boolean> = {};
    const nextNotes: Record<string, string> = {};
    for (const a of detail.attendance) {
      nextAttendance[a.student_id] = a.attended;
      nextNotes[a.student_id] = a.attendance_note ?? "";
    }
    setLocalAttendance(nextAttendance);
    setLocalNotes(nextNotes);
  }, [detail]);

  useEffect(() => {
    const st = routerLocation.state as { liveSessionError?: string; sessionEndedMessage?: string } | null;
    const msg = st?.liveSessionError ?? st?.sessionEndedMessage;
    if (msg) {
      setLiveSessionFlash(msg);
      navigate(".", { replace: true, state: {} });
    }
  }, [routerLocation.state, navigate]);

  useEffect(() => {
    if (detail?.status !== "in_progress") return;
    const interval = setInterval(() => setLiveTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, [detail?.status]);

  const attendanceStudentIds = useMemo(
    () => (detail?.attendance ?? []).map((a) => a.student_id),
    [detail?.attendance],
  );
  const studentGrades = useStudentsLastGrades(attendanceStudentIds, detail?.room_id, !!detail?.room_id) as Record<
    string,
    GradeColor
  >;

  const manage = detail && user ? canManage(user, detail) : false;
  const canEditSession = manage && (detail?.status === "scheduled" || detail?.status === "in_progress");
  const canDeleteSession = manage && detail?.status !== "in_progress";
  const attendanceDisabled = manage && detail?.status === "cancelled";

  const minutesRunning = useMemo(() => {
    if (!detail || detail.status !== "in_progress") return 0;
    void liveTick;
    const start = new Date(detail.scheduled_at).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / 60000));
  }, [detail, liveTick]);

  const presentCount = useMemo(() => {
    if (!detail) return 0;
    return detail.attendance.filter((a) => localAttendance[a.student_id] ?? a.attended).length;
  }, [detail, localAttendance]);

  const infoDatePod = useMemo(
    () => (detail ? shortWeekdayDate(detail.scheduled_at) : ""),
    [detail, shortWeekdayDate],
  );

  const infoTimePod = useMemo(() => {
    if (!detail) return "";
    const startMs = new Date(detail.scheduled_at).getTime();
    const endDate = new Date(startMs + detail.duration_minutes * 60_000);
    if (detail.status === "completed") {
      return `${timeShort(detail.scheduled_at)}\u2013${timeShort(endDate.toISOString())}`;
    }
    return `${timeShort(detail.scheduled_at)} \u00b7 ${t("sessions.durationValue", { minutes: detail.duration_minutes })}`;
  }, [detail, t, timeShort]);

  type AttendancePayload = Array<{
    student_id: string;
    attended: boolean;
    attendance_note: string | null;
  }>;

  const attendanceMutation = useSaveSessionAttendance(
    id ?? "",
    (data) => {
      patchSessionDetail((prev) => (prev ? { ...prev, attendance: data } : prev));
      const next: Record<string, boolean> = {};
      const nextNotes: Record<string, string> = {};
      for (const a of data) {
        next[a.student_id] = a.attended;
        nextNotes[a.student_id] = a.attendance_note ?? "";
      }
      setLocalAttendance(next);
      setLocalNotes(nextNotes);
    },
    (message) => setError(message),
  );

  const savingAttendance = attendanceMutation.isPending;

  function saveAttendance() {
    if (!id || !detail || !manage || attendanceDisabled) return;
    setError(null);
    const attendance: AttendancePayload = detail.attendance.map((a) => {
      const attended = localAttendance[a.student_id] ?? a.attended;
      return {
        student_id: a.student_id,
        attended,
        attendance_note: attended ? (localNotes[a.student_id] ?? a.attendance_note ?? null) : null,
      };
    });
    attendanceMutation.mutate(attendance);
  }

  const statusMutation = usePatchSessionStatus(
    id ?? "",
    user?.id ?? null,
    (data) => {
      patchSessionDetail((prev) => (prev ? { ...prev, ...data, attendance: prev.attendance } : prev));
    },
    (message) => setError(message),
  );

  function patchStatus(status: SessionPublic["status"]) {
    if (!id || !detail) return;
    setError(null);
    statusMutation.mutate(status);
  }

  const startMutation = useStartSession(
    id ?? "",
    user?.id ?? null,
    () => {
      navigate(`/sessions/${id}/live`);
    },
    (message, error) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as
          | { active_session_id?: string; code?: string }
          | undefined;
        if (data?.code === "session_already_in_progress" && data.active_session_id) {
          setActiveSessionConflictId(data.active_session_id);
        }
      }
      setError(message);
    },
  );

  function startSessionAndEnterLive() {
    if (!id || !detail) return;
    setError(null);
    setActiveSessionConflictId(null);
    startMutation.mutate();
  }

  const handleStartClick = () => {
    if (!detail) return;
    const minutesUntilStart = (new Date(detail.scheduled_at).getTime() - Date.now()) / 60_000;
    if (minutesUntilStart > 30) {
      setEarlyStartConfirmOpen(true);
      return;
    }
    void startSessionAndEnterLive();
  };

  const handleEarlyStartConfirm = () => {
    setEarlyStartConfirmOpen(false);
    void startSessionAndEnterLive();
  };

  const deleteMutation = useDeleteSession(
    user?.id ?? null,
    () => {
      navigate("/calendar", { replace: true });
    },
    () => {
      setDeleteOpen(false);
      setDeleteScope(null);
    },
    (message) => setError(message),
  );

  function confirmDelete() {
    if (!id || !detail) return;
    setError(null);
    deleteMutation.mutate({
      sessionId: id,
      recurrenceGroupId: detail.recurrence_group_id ?? null,
      roomId: detail.room_id,
      scope: deleteScope ?? "this",
      refSession: detail,
    });
  }

  const actionLoading =
    statusMutation.isPending || startMutation.isPending || deleteMutation.isPending;

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
        <p className="text-[var(--color-text-muted)]">{t("errors.noPermission")}</p>
        <Link to="/calendar" className="mt-4 inline-block text-[var(--color-primary)]">
          {t("sessions.calendar")}
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p className="text-[var(--color-text-muted)]">{t("errors.not_found")}</p>
        <Link to="/calendar" className="mt-4 inline-block text-[var(--color-primary)]">
          {t("sessions.calendar")}
        </Link>
      </div>
    );
  }

  const title = detail.title?.trim() || detail.room_name || t("sessions.untitledTitle");
  const status = detail.status;

  const attendanceTitle =
    manage && status === "completed" ? t("sessions.attendanceTitleFinal") : t("sessions.markAttendance");

  const attendanceHelper = !manage
    ? undefined
    : status === "scheduled"
      ? t("sessions.attendanceHelperScheduled")
      : status === "in_progress"
        ? t("sessions.attendanceHelperInProgress")
        : status === "completed"
          ? t("sessions.attendanceHelperCompleted")
          : t("sessions.attendanceHelperCancelled");

  const dangerHelper =
    status === "scheduled"
      ? t("sessions.dangerZoneHelperScheduled")
      : status === "completed"
        ? t("sessions.dangerZoneHelperCompleted")
        : t("sessions.dangerZoneHelperCancelled");

  const recitationSectionTitle = !manage
    ? t("recitations.sessionRecitations")
    : status === "scheduled"
      ? t("sessions.recitationsSectionPlan")
      : status === "in_progress"
        ? t("sessions.recitationsSectionDuring")
        : status === "completed"
          ? t("sessions.recitationsSectionAfter")
          : t("sessions.recitationsSectionPlanCancelled");

  const recitationEmpty =
    !manage
      ? {
          title: t("roomDetail.recitationsEmptyTitle"),
          description: t("roomDetail.recitationsEmptyDescriptionStudent"),
          primaryLabel: undefined as string | undefined,
        }
      : status === "scheduled"
        ? {
            title: t("sessions.recitationsEmptyPlanTitle"),
            description: t("sessions.recitationsEmptyPlanDescription"),
            primaryLabel: t("sessions.recitationsAddToPlan"),
          }
        : status === "in_progress"
          ? {
              title: t("sessions.recitationsEmptyDuringTitle"),
              description: t("sessions.recitationsEmptyDuringDescription"),
              primaryLabel: t("sessions.recitationsLogOne"),
            }
          : status === "completed"
            ? {
                title: t("sessions.recitationsEmptyAfterTitle"),
                description: t("sessions.recitationsEmptyAfterDescription"),
                primaryLabel: t("recitations.addRecitation"),
              }
            : {
                title: t("sessions.recitationsEmptyCancelled"),
                description: undefined,
                primaryLabel: undefined,
              };

  const showRecitationAddButton = manage && status !== "cancelled";
  const primaryRecitationActionLabel = showRecitationAddButton
    ? recitationEmpty.primaryLabel ?? t("recitations.addRecitation")
    : undefined;
  const showRecitationHeaderAdd = showRecitationAddButton && sessionRecitations.length > 0;
  const sessionPlanSortable = manage && (status === "scheduled" || status === "in_progress");

  return (
    <PageShell
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("sessions.calendar"), to: "/calendar" },
        { label: title },
      ]}
      title={<span>{title}</span>}
      actions={
        canEditSession && status !== "scheduled" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (detail.recurrence_group_id) setRecurrencePrompt("edit");
              else {
                setEditScope(undefined);
                setFormOpen(true);
              }
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </span>
          </Button>
        ) : undefined
      }
      contentClassName="space-y-8"
    >
      {liveSessionFlash ? (
        <div
          className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <span>{liveSessionFlash}</span>
          <button type="button" className="shrink-0 underline" onClick={() => setLiveSessionFlash(null)}>
            {t("common.close")}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      {manage && status === "scheduled" ? (
        <div className="flex flex-col">
          {canEditSession ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (detail.recurrence_group_id) setRecurrencePrompt("edit");
                  else {
                    setEditScope(undefined);
                    setFormOpen(true);
                  }
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  {t("common.edit")}
                </span>
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="primary"
            loading={actionLoading}
            onClick={handleStartClick}
            className={cn(
              "min-h-14 w-full bg-[#1B5E20] text-base font-semibold hover:opacity-95 md:mx-auto md:max-w-md",
              canEditSession && "mt-4",
            )}
          >
            {t("liveSession.startSession")}
          </Button>
          {activeSessionConflictId ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p>{t("sessions.closeCurrentSessionFirst")}</p>
              <Link className="mt-2 inline-block font-medium underline" to={`/sessions/${activeSessionConflictId}/live`}>
                {t("sessions.openCurrentSession")}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {manage && status === "in_progress" ? (
        <div className="rounded-2xl border-2 border-orange-400/50 bg-gradient-to-br from-orange-50/90 to-red-50/50 p-4 shadow-sm dark:border-orange-500/30 dark:from-orange-950/30 dark:to-red-950/20">
          <p className="text-sm font-medium text-orange-950 dark:text-orange-100">
            {minutesRunning < 1
              ? t("sessions.primaryRunningJustStarted")
              : t("sessions.primaryRunningFor", { count: minutesRunning })}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text)]">{t("sessions.primaryLiveHelper")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/sessions/${detail.id}/live`}>
              <Button type="button" variant="primary">
                {t("liveSession.enterLive")}
              </Button>
            </Link>
            <Button type="button" variant="secondary" loading={actionLoading} onClick={() => void patchStatus("completed")}>
              {t("sessions.complete")}
            </Button>
          </div>
        </div>
      ) : null}

      {!manage && status === "in_progress" ? (
        <div className="rounded-2xl border-2 border-orange-400/50 bg-gradient-to-br from-orange-50/90 to-red-50/50 p-4 shadow-sm dark:border-orange-500/30 dark:from-orange-950/30 dark:to-red-950/20">
          <p className="text-sm text-[var(--color-text)]">{t("sessions.primaryLiveHelper")}</p>
          <div className="mt-4">
            <Link to={`/sessions/${detail.id}/live`}>
              <Button type="button" variant="primary">
                {t("liveSession.enterLive")}
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {/* Session info */}
      <PageCard>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
          <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0 text-[var(--color-primary)]/80" aria-hidden />
            <Link
              to={`/rooms/${detail.room_id}`}
              className="text-base font-semibold text-[var(--color-primary)] hover:underline"
            >
              {detail.room_name}
            </Link>
            <SessionStatusBadge status={detail.status} />
            {detail.recurrence_group_id ? (
              <span className="inline-flex shrink-0" title={t("sessions.recurringIndicator")}>
                <Repeat className="h-3.5 w-3.5 text-[var(--color-text-muted)]" aria-hidden />
              </span>
            ) : null}
          </div>
          <div className="min-h-0 min-w-0 flex-1 max-sm:hidden" aria-hidden />
          <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-4 max-sm:basis-full sm:ms-auto">
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text)]">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
              {infoDatePod}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text)]">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
              {infoTimePod}
            </span>
            <SessionCountdown
              scheduledAt={detail.scheduled_at}
              durationMinutes={detail.duration_minutes}
              status={detail.status}
            />
          </div>
        </div>
        {detail.notes && status !== "cancelled" ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text)]">{detail.notes}</p>
        ) : null}
        {status === "cancelled" ? (
          <div className="mt-3 border-t border-red-100 pt-3 dark:border-red-900/40">
            <p className="font-medium text-red-800 dark:text-red-200">{t("sessions.cancelledSessionBanner")}</p>
            {detail.notes?.trim() ? (
              <p className="mt-2 text-sm text-red-900/90 dark:text-red-200/95">
                {t("sessions.cancelledSessionNotes", { notes: detail.notes })}
              </p>
            ) : null}
          </div>
        ) : null}
      </PageCard>

      {/* Session recitations */}
      <PageCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{recitationSectionTitle}</h2>
          {showRecitationHeaderAdd ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setRecitationEditing(null);
                setRecitationFormOpen(true);
              }}
            >
              {primaryRecitationActionLabel}
            </Button>
          ) : null}
        </div>
        {sessionRecitations.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-10"
            icon={<BookMarked className="h-12 w-12" />}
            title={recitationEmpty.title}
            {...(recitationEmpty.description ? { description: recitationEmpty.description } : {})}
            primaryAction={
              showRecitationAddButton && primaryRecitationActionLabel
                ? {
                    label: primaryRecitationActionLabel,
                    onClick: () => {
                      setRecitationEditing(null);
                      setRecitationFormOpen(true);
                    },
                  }
                : undefined
            }
          />
        ) : sessionPlanSortable ? (
          <SessionRecitationsSortableList
            items={sessionRecitations}
            sessionId={detail.id}
            showStudent
            onItemsChange={(items) => {
              patchSessionRecitations(() => items);
            }}
            onPersistFailed={() => setError(t("plan.reorderFailed"))}
            onEditItem={
              manage
                ? (r) => {
                    setRecitationEditing(r);
                    setRecitationFormOpen(true);
                  }
                : undefined
            }
          />
        ) : (
          <RecentRecitationsList
            items={sessionRecitations}
            showStudent
            onItemClick={
              manage
                ? (r) => {
                    setRecitationEditing(r);
                    setRecitationFormOpen(true);
                  }
                : undefined
            }
          />
        )}
      </PageCard>

      {/* Attendance */}
      {manage && detail.attendance.length === 0 ? (
        <PageCard
          className={cn(status === "completed" && "border-gray-200/90 bg-[var(--color-surface)]/95")}
        >
          {status === "completed" ? (
            <p className="mb-3 text-sm text-[var(--color-text-muted)]">{t("sessions.sessionEndedSummary")}</p>
          ) : null}
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{attendanceTitle}</h2>
          {attendanceHelper ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{attendanceHelper}</p> : null}
          <EmptyState
            className="mt-4 border-0 bg-transparent py-10"
            icon={<BookMarked className="h-12 w-12" />}
            title={t("sessions.attendanceEmptyTitle")}
            description={
              status === "cancelled"
                ? t("sessions.attendanceHelperCancelled")
                : t("sessions.attendanceEmptyDescription")
            }
            primaryAction={manage && status !== "cancelled" ? { label: t("users.tabsStudents"), to: `/rooms/${detail.room_id}` } : undefined}
          />
        </PageCard>
      ) : manage && detail.attendance.length > 0 ? (
        <PageCard
          className={cn(status === "completed" && "border-gray-200/90 bg-[var(--color-surface)]/95")}
        >
          {status === "completed" ? (
            <p className="mb-3 text-sm text-[var(--color-text-muted)]">{t("sessions.sessionEndedSummary")}</p>
          ) : null}
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{attendanceTitle}</h2>
          {attendanceHelper ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{attendanceHelper}</p> : null}
          <div className="mt-4">
            <AttendanceSheet
              sessionId={detail.id}
              items={detail.attendance}
              localState={localAttendance}
              localNotes={localNotes}
              studentGrades={studentGrades}
              disabled={attendanceDisabled}
              onToggle={(studentId, attended) =>
                setLocalAttendance((prev) => ({ ...prev, [studentId]: attended }))
              }
              onNoteChange={(studentId, note) =>
                setLocalNotes((prev) => ({ ...prev, [studentId]: note }))
              }
              onPresentAll={() => {
                const next: Record<string, boolean> = { ...localAttendance };
                for (const a of detail.attendance) {
                  next[a.student_id] = true;
                }
                setLocalAttendance(next);
              }}
              onAbsentAll={() => {
                const next: Record<string, boolean> = { ...localAttendance };
                for (const a of detail.attendance) {
                  next[a.student_id] = false;
                }
                setLocalAttendance(next);
              }}
              total={detail.attendance.length}
              presentCount={presentCount}
            />
          </div>
          {!attendanceDisabled ? (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="primary" loading={savingAttendance} onClick={() => void saveAttendance()}>
                {t("sessions.saveAttendance")}
              </Button>
            </div>
          ) : null}
        </PageCard>
      ) : null}

      {/* Danger zone */}
      {canDeleteSession ? (
        <section
          className="rounded-xl border-2 border-red-200 bg-red-50/60 p-5 shadow-sm dark:bg-red-950/20"
          aria-labelledby="session-danger-heading"
        >
          <h2 id="session-danger-heading" className="text-base font-semibold text-red-900 dark:text-red-100">
            {t("sessions.dangerZoneTitle")}
          </h2>
          <p className="mt-1 text-sm text-red-800/95 dark:text-red-200/90">{dangerHelper}</p>
          <div className="mt-4 flex flex-col gap-3 border-t border-red-200/90 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            {status === "scheduled" ? (
              <Button
                type="button"
                variant="secondary"
                loading={actionLoading}
                className="border-2 border-[#1B5E20] bg-[var(--color-surface)] text-[#1B5E20] hover:bg-[#1B5E20]/5 dark:border-emerald-600 dark:text-emerald-300"
                onClick={() => setCancelConfirmOpen(true)}
              >
                {t("sessions.cancel")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (detail.recurrence_group_id) setRecurrencePrompt("delete");
                else {
                  setDeleteScope(null);
                  setDeleteOpen(true);
                }
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("sessions.deleteSession")}
              </span>
            </Button>
          </div>
        </section>
      ) : null}

      <RecitationFormModal
        open={recitationFormOpen}
        mode={recitationEditing ? "edit" : "create"}
        recitation={recitationEditing}
        defaultRoomId={detail.room_id}
        defaultRoomName={detail.room_name}
        defaultSessionId={detail.id}
        defaultSessionSummary={`${detail.title?.trim() || detail.room_name} · ${mediumTime(detail.scheduled_at)}`}
        onClose={() => {
          setRecitationFormOpen(false);
          setRecitationEditing(null);
        }}
        onSaved={() => {
          // No-op: SessionFormModal / RecitationFormModal invalidate their domain keys.
          // The detail page picks up changes through cache invalidation.
        }}
      />

      <RecurrenceScopeModal
        open={recurrencePrompt !== null}
        mode={recurrencePrompt === "delete" ? "delete" : "edit"}
        sessionTitle={title}
        onClose={() => setRecurrencePrompt(null)}
        onChoose={(scope, mode) => {
          setRecurrencePrompt(null);
          if (mode === "edit") {
            setEditScope(scope);
            setFormOpen(true);
          } else {
            setDeleteScope(scope);
            setDeleteOpen(true);
          }
        }}
      />

      <SessionFormModal
        open={formOpen}
        mode="edit"
        session={detail}
        editScope={editScope}
        onClose={() => {
          setFormOpen(false);
          setEditScope(undefined);
        }}
        onSaved={() => {
          // No-op: SessionFormModal / RecitationFormModal invalidate their domain keys.
          // The detail page picks up changes through cache invalidation.
        }}
      />

      <DeleteSessionModal
        open={deleteOpen}
        session={detail}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteScope(null);
        }}
        onConfirm={() => void confirmDelete()}
        loading={actionLoading}
      />

      <Modal
        open={earlyStartConfirmOpen}
        onClose={() => setEarlyStartConfirmOpen(false)}
        title={t("sessions.earlyStartTitle")}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text)]">
            {t("sessions.earlyStartBody", {
              date: full(detail.scheduled_at),
              relative: formatScheduledRelativeToNow(
                detail.scheduled_at,
                intlLocaleForAppLanguage(i18n.language),
              ),
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEarlyStartConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={actionLoading}
              onClick={handleEarlyStartConfirm}
            >
              {t("sessions.earlyStartConfirm")}
            </Button>
          </div>
        </div>
      </Modal>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={(open) => !open && setCancelConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sessions.cancel")}</AlertDialogTitle>
            <AlertDialogDescription>{t("sessions.cancelSessionConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelConfirmOpen(false)} disabled={actionLoading}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={actionLoading}
              onClick={() => {
                setCancelConfirmOpen(false);
                void patchStatus("cancelled");
              }}
            >
              {t("common.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
