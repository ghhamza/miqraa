// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Archive, MoreVertical, Pencil, RotateCcw, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HalaqahType, Room } from "../../types";
import { halaqahBadgeClass } from "../../lib/halaqahUi";
import { riwayaBadgeClass } from "../../lib/riwayaUi";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useLiveSessions } from "../../contexts/LiveSessionsContext";
import { liveSessionPath } from "../../lib/sessionNav";

const HALAQAH_I18N: Record<HalaqahType, string> = {
  hifz: "rooms.halaqahHifz",
  tilawa: "rooms.halaqahTilawa",
  muraja: "rooms.halaqahMuraja",
  tajweed: "rooms.halaqahTajweed",
};

interface RoomCardProps {
  room: Room;
  canManage: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  user?: { id: string; role: string } | null;
  onJoin?: (room: Room) => void;
  joinLoadingId?: string | null;
}

export function RoomCard({
  room,
  canManage,
  onEdit,
  onArchive,
  onRestore,
  user,
  onJoin,
  joinLoadingId,
}: RoomCardProps) {
  const { t } = useTranslation();
  const { medium } = useLocaleDate();
  const { sessions: liveSessions } = useLiveSessions();
  const liveForRoom = useMemo(
    () => liveSessions.find((s) => s.room_id === room.id),
    [liveSessions, room.id],
  );
  const pct =
    room.max_students > 0
      ? Math.min(100, Math.round((room.enrolled_count / room.max_students) * 100))
      : 0;

  return (
    <article
      data-room-id={room.id}
      className="group rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            <Link
              to={`/rooms/${room.id}`}
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              {room.name}
            </Link>
          </h2>
          <span
            className={`inline-flex rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold ${riwayaBadgeClass(room.riwaya)}`}
          >
            {t(`mushaf.${room.riwaya}`)}
          </span>
          <span
            className={`inline-flex rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold ${halaqahBadgeClass(room.halaqah_type)}`}
          >
            {t(HALAQAH_I18N[room.halaqah_type])}
          </span>
          {canManage && room.pending_count > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-gold)]">
              {room.pending_count} {t("enrollment.pendingRequests")}
            </span>
          ) : null}
          {liveForRoom ? (
            <Link
              to={liveSessionPath(liveForRoom.id)}
              className="miqraa-room-live-link inline-flex shrink-0 items-center rounded-full bg-[#e62117] px-2.5 py-1 text-[0.65rem] font-bold uppercase leading-none tracking-wide text-white shadow-sm outline-none ring-offset-2 transition hover:bg-[#cc0000] focus-visible:ring-2 focus-visible:ring-[#e62117] focus-visible:ring-offset-2"
              title={liveForRoom.title?.trim() || t("sessions.untitledTitle")}
              aria-label={t("rooms.liveSessionLinkAria", { name: room.name })}
            >
              {t("liveSession.badge")}
            </Link>
          ) : null}
        </div>

        <Link
          to={`/rooms/${room.id}`}
          className="flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          <p className="text-sm text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text)]">{t("rooms.teacherLabel")}</span>{" "}
            {room.teacher_name}
          </p>

          <p className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Users className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
            {t("rooms.maxStudentsShort", { count: room.max_students })}
          </p>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>{t("rooms.enrolledStudents")}</span>
              <span className="tabular-nums font-medium text-[var(--color-text)]">
                {t("rooms.enrolledFraction", { enrolled: room.enrolled_count, max: room.max_students })}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[var(--color-primary)]/80 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={room.is_active ? "green" : "gray"}>
              {room.is_active ? t("common.active") : t("common.inactive")}
            </Badge>
            <span className="text-xs text-[var(--color-text-muted)]">{medium(room.created_at)}</span>
          </div>
        </Link>
      </div>

      {user?.role === "student" && onJoin ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {room.my_status === "approved" ? (
            <Badge variant="green">{t("enrollment.statusApproved")}</Badge>
          ) : room.my_status === "pending" ? (
            <Badge variant="gold">{t("enrollment.statusPending")}</Badge>
          ) : room.my_status === "rejected" ? (
            <Badge variant="gray">{t("enrollment.statusRejected")}</Badge>
          ) : !room.enrollment_open ? (
            <Badge variant="gray">{t("enrollment.enrollmentClosed")}</Badge>
          ) : room.enrolled_count >= room.max_students ? (
            <Badge variant="gray">{t("enrollment.roomFull")}</Badge>
          ) : (
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={joinLoadingId === room.id}
              onClick={() => onJoin(room)}
            >
              {room.requires_approval ? t("enrollment.requestJoin") : t("enrollment.joinRoom")}
            </Button>
          )}
        </div>
      ) : null}

      {canManage ? (
        <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="cursor-pointer gap-2">
                <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                {t("common.edit")}
              </DropdownMenuItem>
              {room.is_active ? (
                <DropdownMenuItem onClick={onArchive} className="cursor-pointer gap-2">
                  <Archive className="h-4 w-4 shrink-0" aria-hidden />
                  {t("common.archive")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onRestore} className="cursor-pointer gap-2">
                  <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
                  {t("common.restore")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </article>
  );
}
