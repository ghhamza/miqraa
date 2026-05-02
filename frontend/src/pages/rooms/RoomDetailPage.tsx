// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useState } from "react";
import { useCancellableEffect } from "../../hooks/useCancellableEffect";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Pencil, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { Enrollment, Paginated, RecitationPublic, Room, SessionPublic } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { RoomFormModal } from "../../components/rooms/RoomFormModal";
import { ArchiveRoomModal } from "../../components/rooms/ArchiveRoomModal";
import { EnrollStudentModal } from "../../components/enrollment/EnrollStudentModal";
import { RemoveStudentModal } from "../../components/enrollment/RemoveStudentModal";
import { SessionFormModal } from "../../components/sessions/SessionFormModal";
import { RecitationFormModal } from "../../components/recitations/RecitationFormModal";
import { PageShell } from "../../components/layout/PageShell";
import { halaqahBadgeClass } from "../../lib/halaqahUi";
import { riwayaBadgeClass } from "../../lib/riwayaUi";
import {
  calendarGridEnd,
  calendarGridStart,
  endOfMonth,
  startOfMonth,
} from "../../lib/calendarUtils";
import { RoomOverviewSection } from "./sections/RoomOverviewSection";
import { RoomStudentsSection } from "./sections/RoomStudentsSection";
import { RoomSessionsSection, type RoomSessionsViewMode } from "./sections/RoomSessionsSection";
import { RoomRecitationsSection } from "./sections/RoomRecitationsSection";

function canManage(user: { id: string; role: string } | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const [studentConfirm, setStudentConfirm] = useState<"leave" | "cancel" | null>(null);

  const loadRoom = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    const { data } = await api.get<Room>(`rooms/${id}`, signal ? { signal } : {});
    setRoom(data);
  }, [id]);

  const loadEnrollments = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    const { data } = await api.get<Enrollment[]>(`rooms/${id}/enrollments`, signal ? { signal } : {});
    setEnrollments(data);
  }, [id]);

  const refreshSessions = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    const sig = signal ? { signal } : {};
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
        ...sig,
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
      ...sig,
    });
    const sorted = [...data.items].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    );
    setSessions(sorted);
  }, [id, sessionsViewMode, calendarCursor, listMonthCursor]);

  const loadRoomRecitations = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
      params: { room_id: id },
      ...(signal ? { signal } : {}),
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

  useCancellableEffect(
    async (signal) => {
      if (!id) return;
      setLoading(true);
      setForbidden(false);
      try {
        await loadRoom(signal);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "CanceledError") return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          setForbidden(true);
          setRoom(null);
        } else {
          setRoom(null);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [id, loadRoom],
  );

  useCancellableEffect(
    async (signal) => {
      if (!id || !room || !user) return;
      if (!canManage(user, room)) {
        setEnrollments([]);
        return;
      }
      try {
        await loadEnrollments(signal);
      } catch (err) {
        if ((err as { name?: string })?.name === "CanceledError") return;
        setEnrollments([]);
      }
    },
    [id, room, user, loadEnrollments],
  );

  useCancellableEffect(
    async (signal) => {
      if (!id || !room) return;
      setSessionsLoading(true);
      try {
        await refreshSessions(signal);
      } catch (err) {
        if ((err as { name?: string })?.name === "CanceledError") return;
        setSessions([]);
      } finally {
        if (!signal.aborted) setSessionsLoading(false);
      }
    },
    [id, room, refreshSessions],
  );

  useCancellableEffect(
    async (signal) => {
      if (!id || !room) return;
      setRecitationsLoading(true);
      try {
        await loadRoomRecitations(signal);
      } catch (err) {
        if ((err as { name?: string })?.name === "CanceledError") return;
        setRoomRecitations([]);
      } finally {
        if (!signal.aborted) setRecitationsLoading(false);
      }
    },
    [id, room, loadRoomRecitations],
  );

  const showActions = room ? canManage(user, room) : false;
  const enrolledCount = room?.enrolled_count ?? 0;
  const isArchived = room ? !room.is_active : false;

  const showStudentsSection =
    showActions || (user?.role === "student" && room?.my_status === "approved");
  const showRecitationsSection =
    showActions || (user?.role === "student" && room?.my_status === "approved");

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

  async function confirmStudentWithdrawal() {
    if (!room || !id || studentActionLoading) return;
    setStudentActionLoading(true);
    try {
      await api.delete(`rooms/${room.id}/my-enrollment`);
      setStudentConfirm(null);
      await refreshAfterMutation();
    } catch (err) {
      window.alert(userFacingApiError(err));
    } finally {
      setStudentActionLoading(false);
    }
  }

  return (
    <PageShell
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("rooms.title"), to: "/rooms" },
        { label: room.name },
      ]}
      title={room.name}
      titleAside={
        <div className="inline-flex items-center gap-2">
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${riwayaBadgeClass(room.riwaya)}`}
          >
            {t(`mushaf.${room.riwaya}`)}
          </span>
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${halaqahBadgeClass(room.halaqah_type)}`}
          >
            {t(`rooms.halaqah${capitalize(room.halaqah_type)}`)}
          </span>
        </div>
      }
      actions={
        showActions ? (
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
        ) : undefined
      }
    >
      {isArchived ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {t("rooms.archivedRoomNotice")}
        </div>
      ) : null}

      <div className="space-y-6">
        <RoomOverviewSection
          room={room}
          user={user}
          isArchived={isArchived}
          studentActionLoading={studentActionLoading}
          onStudentJoin={() => void handleStudentJoin()}
          onLeaveRoom={() => setStudentConfirm("leave")}
          onCancelPendingRequest={() => setStudentConfirm("cancel")}
        />

        {showStudentsSection ? (
          <RoomStudentsSection
            room={room}
            user={user}
            enrollments={enrollments}
            enrolledCount={enrolledCount}
            showActions={showActions}
            isArchived={isArchived}
            onRefresh={() => void refreshAfterMutation()}
            onEnrollOpen={() => setEnrollOpen(true)}
            onRemoveEnrollment={(e) => setRemoveEnrollment(e)}
          />
        ) : null}

        <RoomSessionsSection
          room={room}
          user={user}
          roomRouteId={id}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionsViewMode={sessionsViewMode}
          setSessionsViewMode={setSessionsViewMode}
          calendarCursor={calendarCursor}
          setCalendarCursor={setCalendarCursor}
          listMonthCursor={listMonthCursor}
          setListMonthCursor={setListMonthCursor}
          isArchived={isArchived}
          onSessionFormOpen={() => {
            setSessionPrefillDate(null);
            setSessionPresetMorning(false);
            setSessionFormOpen(true);
          }}
          onCalendarDayClick={(d) => {
            setSessionPrefillDate(d);
            setSessionPresetMorning(true);
            setSessionFormOpen(true);
          }}
        />

        {showRecitationsSection ? (
          <RoomRecitationsSection
            room={room}
            user={user}
            roomRecitations={roomRecitations}
            recitationsLoading={recitationsLoading}
            isArchived={isArchived}
            onRecitationFormOpen={() => setRecitationFormOpen(true)}
          />
        ) : null}
      </div>

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

      <AlertDialog
        open={studentConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setStudentConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {studentConfirm === "leave"
                ? t("enrollment.leaveRoom")
                : t("enrollment.cancelRequest")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {studentConfirm === "leave"
                ? t("enrollment.leaveConfirm")
                : t("enrollment.cancelRequestConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStudentConfirm(null)}
              disabled={studentActionLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={studentActionLoading}
              onClick={() => void confirmStudentWithdrawal()}
            >
              {t("common.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
