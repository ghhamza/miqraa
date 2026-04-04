// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Pencil, Trash2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import type { Enrollment, RecitationPublic, Room, SessionPublic } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { RoomFormModal } from "../../components/rooms/RoomFormModal";
import { DeleteRoomModal } from "../../components/rooms/DeleteRoomModal";
import { EnrolledStudentsList } from "../../components/enrollment/EnrolledStudentsList";
import { EnrollStudentModal } from "../../components/enrollment/EnrollStudentModal";
import { RemoveStudentModal } from "../../components/enrollment/RemoveStudentModal";
import { SessionFormModal } from "../../components/sessions/SessionFormModal";
import { RecitationFormModal } from "../../components/recitations/RecitationFormModal";
import { RecentRecitationsList } from "../../components/recitations/RecentRecitationsList";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { riwayaBadgeClass } from "../../lib/riwayaUi";

function canManage(user: { id: string; role: string } | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

function sessionStatusLabelKey(status: SessionPublic["status"]): string {
  return status === "in_progress" ? "inProgress" : status;
}

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { full } = useLocaleDate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [room, setRoom] = useState<Room | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removeEnrollment, setRemoveEnrollment] = useState<Enrollment | null>(null);
  const [sessions, setSessions] = useState<SessionPublic[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [roomRecitations, setRoomRecitations] = useState<RecitationPublic[]>([]);
  const [recitationsLoading, setRecitationsLoading] = useState(false);
  const [recitationFormOpen, setRecitationFormOpen] = useState(false);

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

  const loadSessions = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<SessionPublic[]>(`rooms/${id}/sessions`);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const upcoming = data
      .filter((s) => new Date(s.scheduled_at).getTime() >= start.getTime())
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    setSessions(upcoming.slice(0, 40));
  }, [id]);

  const loadRoomRecitations = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<RecitationPublic[]>("recitations", {
      params: { room_id: id },
    });
    setRoomRecitations(data.slice(0, 15));
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
    if (!id || !room || !user) return;
    let cancelled = false;
    setSessionsLoading(true);
    void (async () => {
      try {
        await loadSessions();
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, room, user, loadSessions]);

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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        to="/rooms"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        {t("rooms.backToRooms")}
      </Link>

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
            <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {t("common.delete")}
              </span>
            </Button>
          </div>
        ) : null}
      </div>

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

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {t("enrollment.headerCount", { count: enrolledCount, max: room.max_students })}
          </h2>
          {showActions ? (
            <Button
              type="button"
              variant="primary"
              disabled={enrolledCount >= room.max_students}
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

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("rooms.upcomingSessions")}</h2>
          {showActions ? (
            <Button type="button" variant="primary" onClick={() => setSessionFormOpen(true)}>
              {t("sessions.addSession")}
            </Button>
          ) : null}
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
      </section>

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("recitations.roomRecitations")}</h2>
          {showActions ? (
            <Button type="button" variant="primary" onClick={() => setRecitationFormOpen(true)}>
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
        onClose={() => setSessionFormOpen(false)}
        onSaved={() => void loadSessions()}
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

      <DeleteRoomModal
        open={deleteOpen}
        roomId={room.id}
        roomName={room.name}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate("/rooms", { replace: true })}
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
