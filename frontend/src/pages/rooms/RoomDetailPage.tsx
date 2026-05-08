// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Pencil, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { roomKeys } from "../../lib/queryKeys";
import { useApiMutation } from "../../lib/useApiMutation";
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

  const [formOpen, setFormOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removeEnrollment, setRemoveEnrollment] = useState<Enrollment | null>(null);
  const [sessionsViewMode, setSessionsViewMode] = useState<RoomSessionsViewMode>("calendar");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [listMonthCursor, setListMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  });
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [sessionPrefillDate, setSessionPrefillDate] = useState<Date | null>(null);
  const [sessionPresetMorning, setSessionPresetMorning] = useState(false);
  const [recitationFormOpen, setRecitationFormOpen] = useState(false);
  const [studentConfirm, setStudentConfirm] = useState<"leave" | "cancel" | null>(null);
  const queryClient = useQueryClient();

  const roomQuery = useQuery({
    queryKey: roomKeys.detail(id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Room>(`rooms/${id}`, { signal });
      return data;
    },
    enabled: !!id,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) return false;
      return failureCount < 2;
    },
  });

  const room = roomQuery.data ?? null;
  const forbidden =
    (roomQuery.error as { response?: { status?: number } } | null)?.response?.status === 403;
  const canManageRoom = !!room && !!user && canManage(user, room);

  const enrollmentsQuery = useQuery({
    queryKey: roomKeys.enrollments(id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Enrollment[]>(`rooms/${id}/enrollments`, { signal });
      return data;
    },
    enabled: !!id && canManageRoom,
  });

  const enrollments = enrollmentsQuery.data ?? [];

  const sessionsRange = useMemo(() => {
    if (sessionsViewMode === "calendar") {
      return {
        from: calendarGridStart(calendarCursor).toISOString(),
        to: calendarGridEnd(calendarCursor).toISOString(),
      };
    }
    return {
      from: startOfMonth(listMonthCursor).toISOString(),
      to: endOfMonth(listMonthCursor).toISOString(),
    };
  }, [sessionsViewMode, calendarCursor, listMonthCursor]);

  const sessionsQuery = useQuery({
    queryKey: roomKeys.sessions(id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<SessionPublic>>("sessions", {
        signal,
        params: {
          room_id: id,
          from: sessionsRange.from,
          to: sessionsRange.to,
          limit: "500",
        },
      });
      if (sessionsViewMode === "list") {
        return [...data.items].sort(
          (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
        );
      }
      return data.items;
    },
    enabled: !!id && !!room,
  });

  useEffect(() => {
    if (!id || !room) return;
    void queryClient.invalidateQueries({ queryKey: roomKeys.sessions(id) });
  }, [id, room, sessionsRange.from, sessionsRange.to, queryClient]);

  const sessions = sessionsQuery.data ?? [];
  const sessionsLoading = sessionsQuery.isFetching;

  const recitationsQuery = useQuery({
    queryKey: roomKeys.recitations(id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
        signal,
        params: { room_id: id },
      });
      return data.items.slice(0, 15);
    },
    enabled: !!id && !!room,
  });

  const roomRecitations = recitationsQuery.data ?? [];
  const recitationsLoading = recitationsQuery.isPending;
  const loading = roomQuery.isPending;

  const restoreMutation = useApiMutation({
    mutationFn: () => api.put(`rooms/${room?.id}`, { is_active: true }),
    invalidates: [
      roomKeys.detail(id ?? ""),
      roomKeys.lists(),
      roomKeys.archived(),
      roomKeys.stats(),
    ],
  });

  const joinMutation = useApiMutation({
    mutationFn: () => api.post(`rooms/${room?.id}/join`),
    invalidates: [
      roomKeys.detail(id ?? ""),
      roomKeys.enrollments(id ?? ""),
      roomKeys.lists(),
      roomKeys.stats(),
    ],
    onError: (message) => window.alert(message),
  });

  const withdrawMutation = useApiMutation({
    mutationFn: () => api.delete(`rooms/${room?.id}/my-enrollment`),
    invalidates: [
      roomKeys.detail(id ?? ""),
      roomKeys.enrollments(id ?? ""),
      roomKeys.lists(),
      roomKeys.stats(),
    ],
    onSuccess: () => setStudentConfirm(null),
    onError: (message) => window.alert(message),
  });

  const restoreLoading = restoreMutation.isPending;
  const studentActionLoading = joinMutation.isPending || withdrawMutation.isPending;

  function handleRestore() {
    if (!room || restoreLoading) return;
    restoreMutation.mutate();
  }

  function handleStudentJoin() {
    if (!room || !id || studentActionLoading) return;
    joinMutation.mutate();
  }

  function confirmStudentWithdrawal() {
    if (!room || !id || studentActionLoading) return;
    withdrawMutation.mutate();
  }

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
            onRefresh={() => {
              // No-op: PendingRequestsList invalidates its own keys.
            }}
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
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: roomKeys.sessions(id ?? "") });
        }}
      />

      <RecitationFormModal
        open={recitationFormOpen}
        mode="create"
        recitation={null}
        defaultRoomId={room.id}
        defaultRoomName={room.name}
        onClose={() => setRecitationFormOpen(false)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: roomKeys.recitations(id ?? "") });
        }}
      />

      <RoomFormModal
        open={formOpen}
        mode="edit"
        room={room}
        isAdmin={isAdmin}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          // No-op: RoomFormModal invalidates room keys itself.
        }}
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
        onEnrolled={() => {
          // No-op: EnrollStudentModal invalidates enrollment keys itself.
        }}
      />

      <RemoveStudentModal
        open={removeEnrollment !== null}
        roomId={room.id}
        enrollment={removeEnrollment}
        onClose={() => setRemoveEnrollment(null)}
        onRemoved={() => {
          // No-op: RemoveStudentModal invalidates enrollment keys itself.
        }}
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
