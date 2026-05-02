// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SessionPublic } from "../../types";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import { toYmdLocal } from "../../lib/calendarUtils";
import { SessionBlock } from "./SessionBlock";

interface AgendaViewProps {
  sessions: SessionPublic[];
  onSessionClick: (s: SessionPublic) => void;
}

function groupByDay(sessions: SessionPublic[]): Map<string, SessionPublic[]> {
  const m = new Map<string, SessionPublic[]>();
  for (const s of sessions) {
    const key = toYmdLocal(new Date(s.scheduled_at));
    const arr = m.get(key) ?? [];
    arr.push(s);
    m.set(key, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }
  return m;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function AgendaView({ sessions, onSessionClick }: AgendaViewProps) {
  const { t, i18n } = useTranslation();
  const locale = intlLocaleForAppLanguage(i18n.language);
  const today = useMemo(() => startOfDay(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const byDay = useMemo(() => groupByDay(sessions), [sessions]);
  const dayKeys = useMemo(() => [...byDay.keys()].sort(), [byDay]);

  function headerLabel(ymd: string): string {
    const d = new Date(ymd + "T12:00:00");
    const dayStart = startOfDay(d);
    if (dayStart.getTime() === today.getTime()) return t("sessions.today");
    if (dayStart.getTime() === tomorrow.getTime()) return t("sessions.tomorrow");
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  }

  return (
    <div className="space-y-8">
      {dayKeys.map((key) => (
        <section key={key}>
          <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-[var(--color-text)]">
            {headerLabel(key)}
          </h3>
          <ul className="flex flex-col gap-2">
            {(byDay.get(key) ?? []).map((s) => (
              <li key={s.id} className="rounded-xl border border-gray-100 bg-[var(--color-surface)] p-2 shadow-sm">
                <SessionBlock session={s} onClick={() => onSessionClick(s)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
