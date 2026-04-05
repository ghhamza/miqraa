// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { CreateSessionsResponse, Paginated, Room, SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { FormSelect } from "../ui/select";
import { formatDatetimeLocalValue } from "../../lib/calendarUtils";

interface SessionFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  session: SessionPublic | null;
  defaultRoomId?: string;
  defaultDatetime?: Date | null;
  /** When true (e.g. picked a day on the calendar), default time is 09:00 local */
  presetMorningStart?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SessionFormModal({
  open,
  mode,
  session,
  defaultRoomId,
  defaultDatetime,
  presetMorningStart,
  onClose,
  onSaved,
}: SessionFormModalProps) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [datetimeLocal, setDatetimeLocal] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [repeatEndMode, setRepeatEndMode] = useState<"weeks" | "date">("weeks");
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && session) {
      setRoomId(session.room_id);
      setTitle(session.title ?? "");
      setDatetimeLocal(formatDatetimeLocalValue(new Date(session.scheduled_at)));
      setDuration(session.duration_minutes);
      setNotes(session.notes ?? "");
      setRepeatEnabled(false);
      setRepeatDays([]);
      setRepeatWeeks(4);
      setRepeatEndMode("weeks");
      setRepeatEndDate("");
      setCreatedCount(null);
    } else {
      const dt = defaultDatetime ? new Date(defaultDatetime) : new Date();
      if (presetMorningStart) {
        dt.setHours(9, 0, 0, 0);
      }
      setRoomId(defaultRoomId ?? "");
      setTitle("");
      setDatetimeLocal(formatDatetimeLocalValue(dt));
      setDuration(60);
      setNotes("");
      setRepeatEnabled(false);
      setRepeatDays([]);
      setRepeatWeeks(4);
      setRepeatEndMode("weeks");
      setRepeatEndDate("");
      setCreatedCount(null);
    }
  }, [open, mode, session, defaultRoomId, defaultDatetime, presetMorningStart]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingRooms(true);
    void (async () => {
      try {
        const { data } = await api.get<Paginated<Room>>("rooms");
        const items = data.items;
        if (!cancelled) {
          setRooms(items);
          setRoomId((prev) => {
            if (prev && items.some((r) => r.id === prev)) return prev;
            if (defaultRoomId && items.some((r) => r.id === defaultRoomId)) return defaultRoomId;
            return items[0]?.id ?? "";
          });
        }
      } catch {
        if (!cancelled) setRooms([]);
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, defaultRoomId]);

  useEffect(() => {
    if (!repeatEnabled || !datetimeLocal) return;
    const d = new Date(datetimeLocal);
    const day = d.getDay();
    const mondayBased = day === 0 ? 6 : day - 1;
    setRepeatDays((prev) => (prev.includes(mondayBased) ? prev : [...prev, mondayBased]));
  }, [repeatEnabled, datetimeLocal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !roomId) return;
    const scheduled = new Date(datetimeLocal);
    if (Number.isNaN(scheduled.getTime())) {
      setError(t("errors.badRequest"));
      return;
    }
    if (duration <= 0) {
      setError(t("errors.badRequest"));
      return;
    }
    const allowPastAnchor = mode === "create" && repeatEnabled && repeatDays.length > 0;
    if (mode === "create" && scheduled.getTime() <= Date.now() && !allowPastAnchor) {
      setError(t("sessions.pastDate"));
      return;
    }
    if (mode === "create" && repeatEnabled && repeatDays.length > 0) {
      if (repeatEndMode === "date" && !repeatEndDate.trim()) {
        setError(t("errors.badRequest"));
        return;
      }
    }
    setError(null);
    setCreatedCount(null);
    setLoading(true);
    try {
      const iso = scheduled.toISOString();
      if (mode === "create") {
        const payload: Record<string, unknown> = {
          room_id: roomId,
          title: title.trim() || null,
          scheduled_at: iso,
          duration_minutes: duration,
          notes: notes.trim() || null,
        };

        if (repeatEnabled && repeatDays.length > 0) {
          payload.repeat_days = [...repeatDays].sort((a, b) => a - b);
          if (repeatEndMode === "weeks") {
            payload.repeat_weeks = Math.max(1, Math.min(12, repeatWeeks));
          } else if (repeatEndDate) {
            payload.repeat_end_date = new Date(`${repeatEndDate}T23:59:59`).toISOString();
          }
        }

        const { data } = await api.post<CreateSessionsResponse>("sessions", payload);
        if (data.count > 1) {
          setCreatedCount(data.count);
          setTimeout(() => {
            onSaved();
            onClose();
            setCreatedCount(null);
          }, 1500);
          return;
        }
      } else if (session) {
        await api.put(`sessions/${session.id}`, {
          title: title.trim() || null,
          scheduled_at: iso,
          duration_minutes: duration,
          notes: notes.trim() || null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(userFacingApiError(err, "errors.saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? t("sessions.addSession") : t("sessions.editSession")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]" htmlFor="session-room">
            {t("sessions.room")}
          </label>
          <FormSelect
            id="session-room"
            triggerClassName="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm text-[var(--color-text)]"
            triggerStyle={{ color: "var(--color-text)" }}
            value={roomId}
            onValueChange={setRoomId}
            disabled={mode === "edit" || loadingRooms}
            required
            options={
              loadingRooms
                ? [{ value: "", label: t("common.loading") }]
                : rooms.length === 0
                  ? [{ value: "", label: t("rooms.noRooms") }]
                  : rooms.map((r) => ({ value: r.id, label: r.name }))
            }
          />
        </div>
        <Input
          label={t("sessions.sessionTitle")}
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("sessions.sessionTitlePlaceholder")}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]" htmlFor="session-when">
            {t("sessions.date")} / {t("sessions.time")}
          </label>
          <input
            id="session-when"
            type="datetime-local"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[var(--color-text)]"
            value={datetimeLocal}
            onChange={(e) => setDatetimeLocal(e.target.value)}
            required
          />
        </div>
        {mode === "create" ? (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3">
              <div
                role="switch"
                aria-checked={repeatEnabled}
                tabIndex={0}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  repeatEnabled ? "bg-[var(--color-primary)]" : "bg-gray-300"
                }`}
                onClick={() => setRepeatEnabled(!repeatEnabled)}
                onKeyDown={(e) => e.key === "Enter" && setRepeatEnabled(!repeatEnabled)}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    repeatEnabled
                      ? "ltr:translate-x-5 rtl:-translate-x-5"
                      : "ltr:translate-x-0.5 rtl:-translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-[var(--color-text)]">{t("sessions.repeat")}</span>
            </label>

            {repeatEnabled ? (
              <div className="space-y-3 rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{t("sessions.repeatOn")}</p>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                      const selected = repeatDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setRepeatDays((prev) =>
                              selected ? prev.filter((d) => d !== day) : [...prev, day],
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                            selected
                              ? "bg-[var(--color-primary)] text-white"
                              : "border border-gray-200 bg-white text-[var(--color-text)]"
                          }`}
                        >
                          {t(`sessions.day${day}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--color-text)]">{t("sessions.repeatEnds")}</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-wrap items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="repeat-end"
                        checked={repeatEndMode === "weeks"}
                        onChange={() => setRepeatEndMode("weeks")}
                        className="accent-[var(--color-primary)]"
                      />
                      <span>{t("sessions.afterWeeks")}</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={repeatWeeks}
                        onChange={(e) => setRepeatWeeks(Number(e.target.value) || 4)}
                        disabled={repeatEndMode !== "weeks"}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm"
                      />
                      <span className="text-[var(--color-text-muted)]">{t("sessions.weeksLabel")}</span>
                    </label>
                    <label className="flex flex-wrap items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="repeat-end"
                        checked={repeatEndMode === "date"}
                        onChange={() => setRepeatEndMode("date")}
                        className="accent-[var(--color-primary)]"
                      />
                      <span>{t("sessions.untilDate")}</span>
                      <input
                        type="date"
                        value={repeatEndDate}
                        onChange={(e) => setRepeatEndDate(e.target.value)}
                        disabled={repeatEndMode !== "date"}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <Input
          label={t("sessions.duration")}
          name="duration"
          type="number"
          min={1}
          value={String(duration)}
          onChange={(e) => setDuration(Number(e.target.value) || 60)}
          required
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]" htmlFor="session-notes">
            {t("sessions.notes")}
          </label>
          <textarea
            id="session-notes"
            className="min-h-[88px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[var(--color-text)]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
        {createdCount ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-[var(--color-primary)]">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t("sessions.createdCount", { count: createdCount })}
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={loading || !roomId}>
            {loading ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
