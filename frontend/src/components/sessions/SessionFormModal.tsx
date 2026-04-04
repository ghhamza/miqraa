// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { Room, SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
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

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && session) {
      setRoomId(session.room_id);
      setTitle(session.title ?? "");
      setDatetimeLocal(formatDatetimeLocalValue(new Date(session.scheduled_at)));
      setDuration(session.duration_minutes);
      setNotes(session.notes ?? "");
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
    }
  }, [open, mode, session, defaultRoomId, defaultDatetime, presetMorningStart]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingRooms(true);
    void (async () => {
      try {
        const { data } = await api.get<Room[]>("rooms");
        if (!cancelled) {
          setRooms(data);
          setRoomId((prev) => {
            if (prev && data.some((r) => r.id === prev)) return prev;
            if (defaultRoomId && data.some((r) => r.id === defaultRoomId)) return defaultRoomId;
            return data[0]?.id ?? "";
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
    if (mode === "create" && scheduled.getTime() <= Date.now()) {
      setError(t("sessions.pastDate"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const iso = scheduled.toISOString();
      if (mode === "create") {
        await api.post("sessions", {
          room_id: roomId,
          title: title.trim() || null,
          scheduled_at: iso,
          duration_minutes: duration,
          notes: notes.trim() || null,
        });
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
          <select
            id="session-room"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[var(--color-text)]"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={mode === "edit" || loadingRooms}
            required
          >
            {loadingRooms ? (
              <option value="">{t("common.loading")}</option>
            ) : rooms.length === 0 ? (
              <option value="">{t("rooms.noRooms")}</option>
            ) : (
              rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))
            )}
          </select>
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
