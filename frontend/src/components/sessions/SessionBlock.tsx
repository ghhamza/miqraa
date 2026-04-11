// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionPublic } from "../../types";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { cn } from "@/lib/utils";

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
      return "bg-[#2E7D32] text-white shadow-sm";
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
  const isLive = session.status === "in_progress";
  const tooltip = `${title} — ${session.room_name} — ${timeStr}${isLive ? ` — ${t("sessions.inProgress")}` : ""}`;
  const repeatIconClass = "text-white/80";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={tooltip}
      className={cn(
        "w-full rounded-md px-1.5 py-1 text-start text-xs font-medium shadow-sm transition hover:opacity-95",
        statusClasses(session.status),
        compact ? "max-w-full truncate" : "",
      )}
    >
      {!compact ? (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 truncate font-semibold">
            {session.recurrence_group_id || session.schedule_id ? (
              <Repeat className={cn("h-3.5 w-3.5 shrink-0", repeatIconClass)} aria-hidden />
            ) : null}
            <span className="truncate">{title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 truncate">
            <span className="opacity-95">{timeStr}</span>
            {isLive ? (
              <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase leading-none text-white">
                {t("liveSession.badge")}
              </span>
            ) : null}
          </div>
          <div className="truncate text-[0.7rem] opacity-90">{session.room_name}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5 truncate">
            {session.recurrence_group_id || session.schedule_id ? (
              <Repeat className={cn("h-3 w-3 shrink-0", repeatIconClass)} aria-hidden />
            ) : null}
            <span className="truncate opacity-95">{timeStr}</span>
            {isLive ? (
              <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase leading-none text-white">
                {t("liveSession.badge")}
              </span>
            ) : null}
          </span>
          <span className="block truncate opacity-90">{session.room_name}</span>
        </div>
      )}
    </button>
  );
}
