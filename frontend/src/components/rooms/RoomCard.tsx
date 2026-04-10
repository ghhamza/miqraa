// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useNavigate } from "react-router-dom";
import { Archive, Pencil, RotateCcw, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HalaqahType, Room } from "../../types";

const HALAQAH_I18N: Record<HalaqahType, string> = {
  hifz: "rooms.halaqahHifz",
  tilawa: "rooms.halaqahTilawa",
  muraja: "rooms.halaqahMuraja",
  tajweed: "rooms.halaqahTajweed",
};
import { halaqahBadgeClass } from "../../lib/halaqahUi";
import { riwayaBadgeClass } from "../../lib/riwayaUi";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { useLocaleDate } from "../../hooks/useLocaleDate";

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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { medium } = useLocaleDate();
  const pct =
    room.max_students > 0
      ? Math.min(100, Math.round((room.enrolled_count / room.max_students) * 100))
      : 0;

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/rooms/${room.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/rooms/${room.id}`);
        }
      }}
      className="group cursor-pointer rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-[var(--color-text)]">{room.name}</h2>
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
        </div>

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

        {user?.role === "student" && onJoin ? (
          <div className="border-t border-gray-100 pt-3" onClick={(e) => e.stopPropagation()}>
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
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin(room);
                }}
              >
                {room.requires_approval ? t("enrollment.requestJoin") : t("enrollment.joinRoom")}
              </Button>
            )}
          </div>
        ) : null}

        {canManage ? (
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--color-primary)] transition hover:bg-[var(--color-primary)]/10"
              aria-label={t("common.edit")}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
            {room.is_active ? (
              <button
                type="button"
                className="rounded-lg p-2 text-amber-700 transition hover:bg-amber-50"
                aria-label={t("common.archive")}
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
              >
                <Archive className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--color-primary)] transition hover:bg-[var(--color-primary)]/10"
                aria-label={t("common.restore")}
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
