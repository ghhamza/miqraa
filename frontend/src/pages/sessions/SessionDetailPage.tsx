// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Pencil, Repeat, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { Paginated, RecitationPublic, SessionAttendance, SessionDetail, SessionPublic } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { SessionFormModal } from "../../components/sessions/SessionFormModal";
import { DeleteSessionModal } from "../../components/sessions/DeleteSessionModal";
import { AttendanceSheet, type GradeColor } from "../../components/sessions/AttendanceSheet";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { RecitationFormModal } from "../../components/recitations/RecitationFormModal";
import { RecentRecitationsList } from "../../components/recitations/RecentRecitationsList";

function canManage(user: { id: string; role: string } | null, session: SessionPublic): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === session.teacher_id;
}

function statusVariant(s: SessionPublic["status"]): "green" | "gray" | "blue" | "gold" {
  switch (s) {
    case "scheduled":
      return "green";
    case "in_progress":
      return "blue";
    case "completed":
      return "gray";
    case "cancelled":
      return "gray";
    default:
      return "gray";
  }
}

function statusLabelKey(s: SessionPublic["status"]): string {
  switch (s) {
    case "in_progress":
      return "inProgress";
    default:
      return s;
  }
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { t } = useTranslation();
  const { full, mediumTime } = useLocaleDate();
  const user = useAuthStore((s) => s.user);

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSeriesOpen, setDeleteSeriesOpen] = useState(false);
  const [localAttendance, setLocalAttendance] = useState<Record<string, boolean>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [studentGrades, setStudentGrades] = useState<Record<string, GradeColor>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionRecitations, setSessionRecitations] = useState<RecitationPublic[]>([]);
  const [recitationFormOpen, setRecitationFormOpen] = useState(false);
  const [liveSessionFlash, setLiveSessionFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data }, recRes] = await Promise.all([
      api.get<SessionDetail>(`sessions/${id}`),
      api.get<Paginated<RecitationPublic>>("recitations", { params: { session_id: id } }),
    ]);
    setDetail(data);
    setSessionRecitations(recRes.data.items);
    const next: Record<string, boolean> = {};
    const notesInit: Record<string, string> = {};
    for (const a of data.attendance) {
      next[a.student_id] = a.attended;
      notesInit[a.student_id] = a.attendance_note ?? "";
    }
    setLocalAttendance(next);
    setLocalNotes(notesInit);

    const gradesMap: Record<string, GradeColor> = {};
    try {
      for (const att of data.attendance) {
        const res = await api.get<Paginated<RecitationPublic>>("recitations", {
          params: { student_id: att.student_id, room_id: data.room_id, limit: 1 },
        });
        if (res.data.items.length > 0 && res.data.items[0].grade) {
          gradesMap[att.student_id] = res.data.items[0].grade as GradeColor;
        } else {
          gradesMap[att.student_id] = "none";
        }
      }
    } catch {
      for (const att of data.attendance) {
        gradesMap[att.student_id] = "none";
      }
    }
    setStudentGrades(gradesMap);
  }, [id]);

  useEffect(() => {
    const st = routerLocation.state as { liveSessionError?: string; sessionEndedMessage?: string } | null;
    const msg = st?.liveSessionError ?? st?.sessionEndedMessage;
    if (msg) {
      setLiveSessionFlash(msg);
      navigate(".", { replace: true, state: {} });
    }
  }, [routerLocation.state, navigate]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setForbidden(false);
    void (async () => {
      try {
        await load();
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          if (!cancelled) setForbidden(true);
          if (!cancelled) setDetail(null);
        } else {
          if (!cancelled) setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  const manage = detail && user ? canManage(user, detail) : false;

  const presentCount = useMemo(() => {
    if (!detail) return 0;
    return detail.attendance.filter((a) => localAttendance[a.student_id] ?? a.attended).length;
  }, [detail, localAttendance]);

  async function saveAttendance() {
    if (!id || !detail || !manage) return;
    setSavingAttendance(true);
    setError(null);
    try {
      const attendance = detail.attendance.map((a) => {
        const attended = localAttendance[a.student_id] ?? a.attended;
        return {
          student_id: a.student_id,
          attended,
          attendance_note: attended ? (localNotes[a.student_id] ?? a.attendance_note ?? null) : null,
        };
      });
      const { data } = await api.put<SessionAttendance[]>(`sessions/${id}/attendance`, { attendance });
      setDetail((prev) => (prev ? { ...prev, attendance: data } : null));
      const next: Record<string, boolean> = {};
      const nextNotes: Record<string, string> = {};
      for (const a of data) {
        next[a.student_id] = a.attended;
        nextNotes[a.student_id] = a.attendance_note ?? "";
      }
      setLocalAttendance(next);
      setLocalNotes(nextNotes);
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setSavingAttendance(false);
    }
  }

  async function patchStatus(status: SessionPublic["status"]) {
    if (!id || !detail) return;
    setActionLoading(true);
    setError(null);
    try {
      const { data } = await api.put<SessionPublic>(`sessions/${id}`, { status });
      setDetail((prev) => (prev ? { ...prev, ...data, attendance: prev.attendance } : null));
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function startSessionAndEnterLive() {
    if (!id || !detail) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.put<SessionPublic>(`sessions/${id}`, { status: "in_progress" });
      navigate(`/sessions/${id}/live`);
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmDelete() {
    if (!id) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.delete(`sessions/${id}`);
      navigate("/calendar", { replace: true });
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setActionLoading(false);
      setDeleteOpen(false);
    }
  }

  async function confirmDeleteSeries() {
    if (!detail?.recurrence_group_id) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.delete<{ deleted: number }>(`sessions/group/${detail.recurrence_group_id}`);
      navigate("/calendar", { replace: true });
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setActionLoading(false);
      setDeleteSeriesOpen(false);
    }
  }

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

  const title = detail.title?.trim() || t("sessions.untitledTitle");
  const showEditDelete = manage && detail.status !== "completed";

  return (
    <PageShell
      className="mx-auto max-w-3xl"
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("sessions.calendar"), to: "/calendar" },
        { label: title },
      ]}
      title={
        <span className="inline-flex items-center gap-2">
          {detail.recurrence_group_id || detail.schedule_id ? (
            <Repeat className="h-6 w-6 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
          ) : null}
          <span>{title}</span>
        </span>
      }
      actions={
        showEditDelete ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </span>
            </Button>
            <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {t("sessions.deleteSession")}
              </span>
            </Button>
            {detail.recurrence_group_id && detail.status !== "completed" ? (
              <Button type="button" variant="danger" onClick={() => setDeleteSeriesOpen(true)}>
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  {t("sessions.deleteAllUpcoming")}
                </span>
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
      contentClassName="space-y-8"
    >
      {manage && detail.status === "scheduled" ? (
        <div className="rounded-2xl border border-[#1B5E20]/25 bg-[#1B5E20]/[0.06] p-4 shadow-sm">
          <Button
            type="button"
            variant="primary"
            loading={actionLoading}
            onClick={() => void startSessionAndEnterLive()}
            className="min-h-14 w-full bg-[#1B5E20] text-base font-semibold hover:opacity-95"
          >
            {t("liveSession.startSession")}
          </Button>
        </div>
      ) : null}

      {liveSessionFlash ? (
        <div
          className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <span>{liveSessionFlash}</span>
          <button
            type="button"
            className="shrink-0 underline"
            onClick={() => setLiveSessionFlash(null)}
          >
            {t("common.close")}
          </button>
        </div>
      ) : null}

      {detail.status === "in_progress" ? (
        <div>
          <Link to={`/sessions/${detail.id}/live`}>
            <Button type="button" variant="primary">
              {t("liveSession.enterLive")}
            </Button>
          </Link>
        </div>
      ) : null}

      <PageCard>
        <dl className="space-y-4 text-start">
          <div>
            <dt className="text-sm text-[var(--color-text-muted)]">{t("sessions.room")}</dt>
            <dd className="mt-1">
              <Link
                to={`/rooms/${detail.room_id}`}
                className="text-lg font-medium text-[var(--color-primary)] hover:underline"
              >
                {detail.room_name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--color-text-muted)]">{t("sessions.date")}</dt>
            <dd className="mt-1 text-[var(--color-text)]">{full(detail.scheduled_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--color-text-muted)]">{t("sessions.duration")}</dt>
            <dd className="mt-1 text-[var(--color-text)]">
              {t("sessions.durationValue", { minutes: detail.duration_minutes })}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--color-text-muted)]">{t("sessions.status")}</dt>
            <dd className="mt-2">
              <Badge variant={statusVariant(detail.status)}>{t(`sessions.${statusLabelKey(detail.status)}`)}</Badge>
            </dd>
          </div>
          {detail.recurrence_group_id ? (
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">{t("sessions.seriesLabel")}</dt>
              <dd className="mt-1 flex items-center gap-2 text-[var(--color-text)]">
                <Repeat className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                {t("sessions.partOfSeries")}
              </dd>
            </div>
          ) : null}
          {detail.notes ? (
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">{t("sessions.notes")}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-[var(--color-text)]">{detail.notes}</dd>
            </div>
          ) : null}
        </dl>
      </PageCard>

      {manage ? (
        <div className="flex flex-wrap gap-2">
          {detail.status === "scheduled" ? (
            <Button
              type="button"
              variant="secondary"
              loading={actionLoading}
              onClick={() => void patchStatus("cancelled")}
            >
              {t("sessions.cancel")}
            </Button>
          ) : null}
          {detail.status === "in_progress" ? (
            <Button
              type="button"
              variant="primary"
              loading={actionLoading}
              onClick={() => void patchStatus("completed")}
            >
              {t("sessions.complete")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {manage && detail.attendance.length > 0 ? (
        <PageCard>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("sessions.markAttendance")}</h2>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4">
            <AttendanceSheet
              sessionId={detail.id}
              items={detail.attendance}
              localState={localAttendance}
              localNotes={localNotes}
              studentGrades={studentGrades}
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
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="primary" loading={savingAttendance} onClick={() => void saveAttendance()}>
              {t("sessions.saveAttendance")}
            </Button>
          </div>
        </PageCard>
      ) : null}

      <PageCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("recitations.sessionRecitations")}</h2>
          {manage ? (
            <Button type="button" variant="primary" onClick={() => setRecitationFormOpen(true)}>
              {t("recitations.addRecitation")}
            </Button>
          ) : null}
        </div>
        <RecentRecitationsList items={sessionRecitations} showStudent />
      </PageCard>

      <RecitationFormModal
        open={recitationFormOpen}
        mode="create"
        recitation={null}
        defaultRoomId={detail.room_id}
        defaultRoomName={detail.room_name}
        defaultSessionId={detail.id}
        defaultSessionSummary={`${detail.title?.trim() || detail.room_name} · ${mediumTime(detail.scheduled_at)}`}
        onClose={() => setRecitationFormOpen(false)}
        onSaved={() => void load()}
      />

      <SessionFormModal
        open={formOpen}
        mode="edit"
        session={detail}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />

      <DeleteSessionModal
        open={deleteOpen}
        session={detail}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        loading={actionLoading}
      />

      <Modal open={deleteSeriesOpen} onClose={() => setDeleteSeriesOpen(false)} title={t("sessions.deleteAllUpcoming")}>
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text)]">{t("sessions.deleteSeriesConfirm")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteSeriesOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="danger" loading={actionLoading} onClick={() => void confirmDeleteSeries()}>
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
