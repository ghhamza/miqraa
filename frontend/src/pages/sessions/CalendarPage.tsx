// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
import type { Paginated, Room, SessionPublic } from "../../types";
import { Button } from "../../components/ui/Button";
import { FormSelect } from "../../components/ui/select";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { SessionBlock } from "../../components/sessions/SessionBlock";
import { SessionFormModal } from "../../components/sessions/SessionFormModal";
import {
  calendarGridEnd,
  calendarGridStart,
  endOfWeekSunday,
  isToday,
  startOfWeekMonday,
  toYmdLocal,
} from "../../lib/calendarUtils";

type ViewMode = "month" | "week";

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

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [sessions, setSessions] = useState<SessionPublic[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomFilter, setRoomFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);
  const [defaultRoom, setDefaultRoom] = useState<string | undefined>();
  const [presetMorning, setPresetMorning] = useState(false);

  const locale = i18n.language === "en" ? "en-US" : i18n.language === "fr" ? "fr-FR" : "ar-SA";

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2024, 0, 1 + i);
      labels.push(fmt.format(d));
    }
    return labels;
  }, [locale]);

  const range = useMemo(() => {
    if (view === "month") {
      const from = calendarGridStart(cursor);
      const to = calendarGridEnd(cursor);
      return { from, to };
    }
    const from = startOfWeekMonday(cursor);
    const to = endOfWeekSunday(cursor);
    return { from, to };
  }, [view, cursor]);

  const periodLabel = useMemo(() => {
    if (view === "month") {
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
    }
    const a = startOfWeekMonday(cursor);
    const b = endOfWeekSunday(cursor);
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    if (sameMonth) {
      return `${new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(a)} — ${a.getDate()}–${b.getDate()}`;
    }
    return `${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(a)} – ${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(b)}`;
  }, [view, cursor, locale]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        limit: "500",
      };
      if (roomFilter) params.room_id = roomFilter;
      const { data } = await api.get<Paginated<SessionPublic>>("sessions", { params });
      setSessions(data.items);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, roomFilter]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<Paginated<Room>>("rooms");
        if (!cancelled) setRooms(data.items);
      } catch {
        if (!cancelled) setRooms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byDay = useMemo(() => groupByDay(sessions), [sessions]);

  const monthCells = useMemo(() => {
    const start = calendarGridStart(cursor);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [cursor]);

  const weekCells = useMemo(() => {
    const start = startOfWeekMonday(cursor);
    const cells: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [cursor]);

  function goPrev() {
    setCursor((c) => {
      const n = new Date(c);
      if (view === "month") {
        n.setMonth(n.getMonth() - 1);
      } else {
        n.setDate(n.getDate() - 7);
      }
      return n;
    });
  }

  function goNext() {
    setCursor((c) => {
      const n = new Date(c);
      if (view === "month") {
        n.setMonth(n.getMonth() + 1);
      } else {
        n.setDate(n.getDate() + 7);
      }
      return n;
    });
  }

  function goToday() {
    setCursor(new Date());
  }

  const inMonth = (d: Date) => d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();

  return (
    <PageShell
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("sessions.calendar") },
      ]}
      title={t("sessions.calendar")}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={view === "month" ? "primary" : "secondary"}
            onClick={() => setView("month")}
          >
            {t("sessions.monthView")}
          </Button>
          <Button
            type="button"
            variant={view === "week" ? "primary" : "secondary"}
            onClick={() => setView("week")}
          >
            {t("sessions.weekView")}
          </Button>
        </div>
      }
    >
      <PageCard padding="md">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" className="!p-2" onClick={goPrev} aria-label="prev">
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <span className="min-w-[10rem] text-center text-lg font-semibold text-[var(--color-text)]">
            {periodLabel}
          </span>
          <Button type="button" variant="secondary" className="!p-2" onClick={goNext} aria-label="next">
            <ChevronRight className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <Button type="button" variant="secondary" onClick={goToday}>
            {t("sessions.today")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="room-filter" className="text-sm text-[var(--color-text-muted)]">
            {t("sessions.room")}
          </label>
          <FormSelect
            id="room-filter"
            triggerClassName="min-w-[12rem] rounded-xl border border-gray-200 bg-white py-2 text-sm"
            value={roomFilter}
            onValueChange={setRoomFilter}
            options={[
              { value: "", label: t("sessions.allRooms") },
              ...rooms.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </div>
      </div>

      <div className="mt-6 space-y-6">
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : view === "month" ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-1">
            {weekdayLabels.map((name) => (
              <div key={name} className="p-2 text-center text-xs font-semibold text-[var(--color-text-muted)]">
                {name}
              </div>
            ))}
            {monthCells.map((d) => {
              const key = toYmdLocal(d);
              const daySessions = byDay.get(key) ?? [];
              const muted = !inMonth(d);
              const today = isToday(d);
              return (
                <div
                  key={key}
                  className={`min-h-[7rem] rounded-xl border p-1 ${
                    today ? "border-[var(--color-primary)]/40 bg-[#E8F5E9]" : "border-gray-100 bg-[var(--color-surface)]"
                  } ${muted ? "opacity-50" : ""}`}
                >
                  <button
                    type="button"
                    className="mb-1 w-full text-start text-sm font-medium text-[var(--color-text)]"
                    onClick={() => {
                      setPrefillDate(d);
                      setPresetMorning(true);
                      setDefaultRoom(roomFilter || undefined);
                      setFormOpen(true);
                    }}
                  >
                    {d.getDate()}
                  </button>
                  <div className="flex max-h-[5.5rem] flex-col gap-1 overflow-y-auto">
                    {daySessions.slice(0, 3).map((s) => (
                      <SessionBlock
                        key={s.id}
                        session={s}
                        compact
                        onClick={() => navigate(`/sessions/${s.id}`)}
                      />
                    ))}
                    {daySessions.length > 3 ? (
                      <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                        +{daySessions.length - 3}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 gap-2">
            {weekCells.map((d, i) => {
              const key = toYmdLocal(d);
              const daySessions = byDay.get(key) ?? [];
              const today = isToday(d);
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-2 ${
                    today ? "border-[var(--color-primary)]/40 bg-[#E8F5E9]" : "border-gray-100 bg-[var(--color-surface)]"
                  }`}
                >
                  <div className="mb-2 text-center text-xs font-semibold text-[var(--color-text-muted)]">
                    {weekdayLabels[i]}
                  </div>
                  <p className="mb-2 text-center text-sm font-bold text-[var(--color-text)]">{d.getDate()}</p>
                  <button
                    type="button"
                    className="mb-2 w-full rounded-lg border border-dashed border-gray-200 py-1 text-xs text-[var(--color-text-muted)]"
                    onClick={() => {
                      setPrefillDate(d);
                      setPresetMorning(true);
                      setDefaultRoom(roomFilter || undefined);
                      setFormOpen(true);
                    }}
                  >
                    {t("sessions.addSession")}
                  </button>
                  <div className="flex flex-col gap-2">
                    {daySessions.map((s) => (
                      <SessionBlock key={s.id} session={s} onClick={() => navigate(`/sessions/${s.id}`)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-gray-100 pt-4">
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            setPrefillDate(new Date());
            setPresetMorning(false);
            setDefaultRoom(roomFilter || undefined);
            setFormOpen(true);
          }}
        >
          {t("sessions.addSession")}
        </Button>
      </div>
      </div>
      </PageCard>

      <SessionFormModal
        open={formOpen}
        mode="create"
        session={null}
        defaultRoomId={defaultRoom}
        defaultDatetime={prefillDate}
        presetMorningStart={presetMorning}
        onClose={() => {
          setFormOpen(false);
          setPrefillDate(null);
        }}
        onSaved={() => void fetchSessions()}
      />
    </PageShell>
  );
}
