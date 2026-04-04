// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Room } from "../../types";
import { riwayaBadgeClass } from "../../lib/riwayaUi";
import { Badge } from "../ui/Badge";
import { useLocaleDate } from "../../hooks/useLocaleDate";

interface RoomCardProps {
  room: Room;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function RoomCard({ room, canManage, onEdit, onDelete }: RoomCardProps) {
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
            <button
              type="button"
              className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
              aria-label={t("common.delete")}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
