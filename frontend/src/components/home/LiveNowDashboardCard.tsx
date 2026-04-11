// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useLiveSessions } from "../../contexts/LiveSessionsContext";
import { liveSessionPath } from "../../lib/sessionNav";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import type { SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

function minutesSinceScheduled(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

export function LiveNowDashboardCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessions, hasLiveSession } = useLiveSessions();
  const { mediumTime } = useLocaleDate();

  if (!hasLiveSession) return null;

  const titleOf = (s: SessionPublic) => s.title?.trim() || t("sessions.untitledTitle");

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{t("liveSession.dashboard.title")}</h2>
      <ul className="mt-3 space-y-2">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-sm font-semibold leading-snug text-foreground">{titleOf(s)}</p>
                <Badge
                  variant="destructive"
                  className="h-5 shrink-0 border-0 bg-red-600 px-1.5 py-0 text-[0.65rem] font-bold uppercase leading-none text-white"
                >
                  {t("liveSession.badge")}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.room_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {mediumTime(s.scheduled_at)} · {t("liveSession.banner.startedAgo", { minutes: minutesSinceScheduled(s.scheduled_at) })}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-9 shrink-0 border-0 bg-[var(--color-gold)] px-4 text-sm font-semibold text-[#1A1A1A] hover:bg-[var(--color-gold)]/90"
              onClick={() => navigate(liveSessionPath(s.id))}
            >
              {t("liveSession.dashboard.join")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
