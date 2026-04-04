// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionPublic } from "../../types";
import { useLocaleDate } from "../../hooks/useLocaleDate";

interface SessionBlockProps {
  session: SessionPublic;
  compact?: boolean;
  onClick?: () => void;
}

function statusClasses(status: SessionPublic["status"]): string {
  switch (status) {
    case "scheduled":
      return "bg-[var(--color-primary)] text-white";
    case "in_progress":
      return "animate-pulse bg-[var(--color-primary)] text-white ring-2 ring-[var(--color-primary-light)]";
    case "completed":
      return "bg-[#9E9E9E] text-white";
    case "cancelled":
      return "bg-[#EF5350] text-white line-through opacity-90";
    default:
      return "bg-gray-500 text-white";
  }
}

export function SessionBlock({ session, compact, onClick }: SessionBlockProps) {
  const { t } = useTranslation();
  const { mediumTime } = useLocaleDate();
  const timeStr = mediumTime(session.scheduled_at);
  const title = session.title?.trim() || t("sessions.untitledTitle");

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`${title} — ${session.room_name} — ${timeStr}`}
      className={`w-full rounded-lg px-1.5 py-1 text-start text-xs font-medium shadow-sm transition hover:opacity-95 ${statusClasses(
        session.status,
      )} ${compact ? "max-w-full truncate" : ""}`}
    >
      {!compact ? (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 truncate font-semibold">
            {session.recurrence_group_id || session.schedule_id ? (
              <Repeat className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
            ) : null}
            <span className="truncate">{title}</span>
          </div>
          <div className="truncate opacity-95">{timeStr}</div>
          <div className="truncate text-[0.7rem] opacity-90">{session.room_name}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1 truncate">
            {session.recurrence_group_id || session.schedule_id ? (
              <Repeat className="h-3 w-3 shrink-0 text-white/80" aria-hidden />
            ) : null}
            {timeStr}
          </span>
          <span className="block truncate opacity-90">{session.room_name}</span>
        </div>
      )}
    </button>
  );
}
