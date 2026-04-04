// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { SessionPublic } from "../../types";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { Badge } from "../ui/Badge";

function sessionStatusVariant(s: SessionPublic["status"]): "green" | "gray" | "blue" {
  if (s === "cancelled") return "gray";
  if (s === "completed") return "gray";
  if (s === "in_progress") return "blue";
  return "green";
}

export function sessionCountdownLabel(iso: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return t("sessions.countdownToday");
  if (diffDays === 1) return t("sessions.countdownTomorrow");
  const ms = d.getTime() - now.getTime();
  const hours = Math.ceil(ms / 3600000);
  if (hours >= 0 && hours < 72) {
    return t("sessions.countdownInHours", { hours: Math.max(0, hours) });
  }
  const days = Math.ceil(ms / 86400000);
  if (days >= 0 && days < 14) return t("sessions.countdownInDays", { days });
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export interface UpcomingSessionsWidgetProps {
  /** Max rows to show (default: all from API). */
  maxItems?: number;
  showViewCalendarLink?: boolean;
}

export function UpcomingSessionsWidget({ maxItems, showViewCalendarLink }: UpcomingSessionsWidgetProps) {
  const { t, i18n } = useTranslation();
  const { mediumTime } = useLocaleDate();
  const [sessions, setSessions] = useState<SessionPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const displaySessions = maxItems != null ? sessions.slice(0, maxItems) : sessions;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<SessionPublic[]>("sessions/upcoming");
        if (!cancelled) setSessions(data);
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.upcomingSectionTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t("sessions.noSessions")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.upcomingSectionTitle")}</h2>
      <ul className="mt-4 space-y-3">
        {displaySessions.map((s) => (
          <li key={s.id}>
            <Link
              to={`/sessions/${s.id}`}
              className="block rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--color-text)]">{s.room_name}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{mediumTime(s.scheduled_at)}</p>
                  <p className="mt-1 text-xs text-[var(--color-primary)]">{sessionCountdownLabel(s.scheduled_at, t)}</p>
                </div>
                <Badge variant={sessionStatusVariant(s.status)}>{t(`sessions.${statusKey(s.status)}`)}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {showViewCalendarLink ? (
        <div className="mt-4 border-t border-gray-100 pt-4 text-center">
          <Link
            to="/calendar"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("home.viewCalendar")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function statusKey(status: SessionPublic["status"]): string {
  switch (status) {
    case "in_progress":
      return "inProgress";
    case "scheduled":
      return "scheduled";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "scheduled";
  }
}
