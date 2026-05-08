// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userFacingApiError } from "../../lib/api";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";
import type { GenerateResult, Schedule } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import {
  useDeleteSchedule,
  useGenerateSessionsFromSchedules,
  useSaveScheduleSlot,
  useScheduleList,
} from "../../data/sessions";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

interface ScheduleManagerProps {
  roomId: string;
  canManage: boolean;
}

function minutesToTimeString(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeStringToMinutes(s: string): number {
  const [a, b] = s.split(":");
  const h = Number(a);
  const min = Number(b);
  if (Number.isNaN(h) || Number.isNaN(min)) return 0;
  return h * 60 + min;
}

function formatTimeLabel(m: number, locale: string): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}

export function ScheduleManager({ roomId, canManage }: ScheduleManagerProps) {
  const { t, i18n } = useTranslation();
  const locale = intlLocaleForAppLanguage(i18n.language);
  const isRtl = (i18n.language || "ar").startsWith("ar");

  const [error, setError] = useState<string | null>(null);

  const [slotModal, setSlotModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([0]));
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [slotTitle, setSlotTitle] = useState("");
  const [slotActive, setSlotActive] = useState(true);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [genOpen, setGenOpen] = useState(false);
  const [genWeeks, setGenWeeks] = useState(4);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);

  const schedulesQuery = useScheduleList(roomId);

  const schedules = schedulesQuery.data ?? [];
  const loading = schedulesQuery.isPending;

  useEffect(() => {
    if (schedulesQuery.error) {
      setError((prev) => prev ?? userFacingApiError(schedulesQuery.error));
    }
  }, [schedulesQuery.error]);

  const byDay = useMemo(() => {
    const m = new Map<number, Schedule[]>();
    for (let d = 0; d < 7; d++) m.set(d, []);
    for (const s of schedules) {
      const list = m.get(s.day_of_week) ?? [];
      list.push(s);
      m.set(s.day_of_week, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.start_time_minutes - b.start_time_minutes);
    }
    return m;
  }, [schedules]);

  const dayColumnOrder = useMemo(() => (isRtl ? [6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6]), [isRtl]);

  function openAdd(day?: number) {
    setEditingId(null);
    setSlotModal("add");
    setSelectedDays(day !== undefined ? new Set([day]) : new Set([0]));
    setStartTime("09:00");
    setDuration(60);
    setSlotTitle("");
    setSlotActive(true);
  }

  function openEdit(s: Schedule) {
    setEditingId(s.id);
    setSlotModal("edit");
    setSelectedDays(new Set([s.day_of_week]));
    setStartTime(minutesToTimeString(s.start_time_minutes));
    setDuration(s.duration_minutes);
    setSlotTitle(s.title ?? "");
    setSlotActive(s.is_active);
  }

  const saveSlotMutation = useSaveScheduleSlot(
    roomId,
    () => {
      setSlotModal(null);
    },
    (message) => setError(message),
  );

  const saving = saveSlotMutation.isPending;

  function saveSlot() {
    if (saving) return;
    const mins = timeStringToMinutes(startTime);
    if (mins < 0 || mins >= 1440 || duration <= 0) {
      setError(t("errors.badRequest"));
      return;
    }
    setError(null);

    const days = [...selectedDays];
    saveSlotMutation.mutate({
      mode:
        slotModal === "edit" && editingId
          ? "edit"
          : days.length === 1
          ? "single"
          : "batch",
      editingId,
      days,
      title: slotTitle.trim() || null,
      mins,
      duration,
      isActive: slotActive,
    });
  }

  const deleteMutation = useDeleteSchedule(
    roomId,
    () => setDeleteId(null),
    (message) => setError(message),
  );

  const deleting = deleteMutation.isPending;

  function confirmDelete() {
    if (!deleteId || deleting) return;
    setError(null);
    deleteMutation.mutate(deleteId);
  }

  const generateMutation = useGenerateSessionsFromSchedules(
    (data) => {
      setGenResult(data);
      setGenOpen(false);
    },
    (message) => setError(message),
  );

  const genLoading = generateMutation.isPending;

  function runGenerate() {
    setError(null);
    setGenResult(null);
    generateMutation.mutate({ roomId, weeks: genWeeks });
  }

  function toggleDay(d: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        if (next.size > 1) next.delete(d);
      } else {
        next.add(d);
      }
      return next;
    });
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("sessions.schedules")}</h2>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : !canManage && schedules.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t("sessions.noSchedules")}</p>
      ) : (
        <>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
            dir={isRtl ? "rtl" : "ltr"}
          >
            {dayColumnOrder.map((d) => (
              <div key={d} className="flex min-h-[8rem] flex-col rounded-xl border border-gray-100 bg-[var(--color-bg)] p-2">
                <p className="mb-2 text-center text-xs font-semibold text-[var(--color-text-muted)]">
                  {t(`sessions.${DAY_KEYS[d]}`)}
                </p>
                <div className="flex flex-1 flex-col gap-1.5">
                  {(byDay.get(d) ?? []).map((s) => (
                    <div
                      key={s.id}
                      className={`group relative rounded-lg px-2 py-1.5 text-xs ${
                        s.is_active
                          ? "bg-[#4CAF50]/15 text-[var(--color-primary)]"
                          : "bg-gray-100 text-[var(--color-text-muted)]"
                      }`}
                    >
                      <div className="font-medium">{formatTimeLabel(s.start_time_minutes, locale)}</div>
                      <div className="text-[0.65rem] opacity-90">
                        {t("sessions.durationValue", { minutes: s.duration_minutes })}
                      </div>
                      {canManage ? (
                        <div className="absolute end-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-black/5"
                            aria-label={t("sessions.editSlot")}
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-red-50"
                            aria-label={t("sessions.deleteSlot")}
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => openAdd(d)}
                    className="mt-auto flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-200 py-1.5 text-xs text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("sessions.addSlot")}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {canManage ? (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => openAdd()}>
                {t("sessions.batchCreate")}
              </Button>
              <Button type="button" variant="primary" onClick={() => setGenOpen(true)}>
                {t("sessions.generateSessions")}
              </Button>
            </div>
          ) : null}

          {genResult ? (
            <div className="mt-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-4 py-3 text-sm text-[var(--color-text)]">
              <p>{t("sessions.generateResult", { created: genResult.created, skipped: genResult.skipped })}</p>
              <Link to="/calendar" className="mt-2 inline-block text-[var(--color-primary)] hover:underline">
                {t("sessions.viewCalendar")}
              </Link>
            </div>
          ) : null}
        </>
      )}

      {slotModal && canManage ? (
        <Modal
          open={slotModal !== null}
          onClose={() => setSlotModal(null)}
          title={slotModal === "edit" ? t("sessions.editSlot") : t("sessions.addSlot")}
        >
          <div className="space-y-4">
            {slotModal === "add" ? (
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{t("sessions.selectDays")}</p>
                <div className="flex flex-wrap gap-2">
                  {DAY_KEYS.map((key, idx) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        selectedDays.has(idx)
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-gray-100 text-[var(--color-text-muted)]"
                      }`}
                    >
                      {t(`sessions.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("sessions.startTime")}</label>
              <input
                type="time"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <Input
              label={t("sessions.slotDuration")}
              name="dur"
              type="number"
              min={1}
              value={String(duration)}
              onChange={(e) => setDuration(Number(e.target.value) || 60)}
            />
            <Input
              label={t("sessions.sessionTitle")}
              name="title"
              value={slotTitle}
              onChange={(e) => setSlotTitle(e.target.value)}
              placeholder={t("sessions.sessionTitlePlaceholder")}
            />
            {slotModal === "edit" ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={slotActive} onChange={(e) => setSlotActive(e.target.checked)} />
                {slotActive ? t("sessions.scheduleActive") : t("sessions.scheduleInactive")}
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" variant="secondary" className="min-w-0 flex-1" onClick={() => setSlotModal(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" variant="primary" className="min-w-0 flex-1" loading={saving} onClick={() => void saveSlot()}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {deleteId ? (
        <Modal open onClose={() => setDeleteId(null)} title={t("sessions.deleteSlot")}>
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">{t("sessions.deleteSlotConfirm")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="min-w-0 flex-1" onClick={() => setDeleteId(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="danger" className="min-w-0 flex-1" loading={deleting} onClick={() => void confirmDelete()}>
              {t("common.delete")}
            </Button>
          </div>
        </Modal>
      ) : null}

      {genOpen && canManage ? (
        <Modal open={genOpen} onClose={() => setGenOpen(false)} title={t("sessions.generateSessions")}>
          <div className="mb-4">
            <label className="mb-1 block text-sm text-[var(--color-text)]">{t("sessions.generateWeeks")}</label>
            <input
              type="number"
              min={1}
              max={12}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={genWeeks}
              onChange={(e) => setGenWeeks(Math.min(12, Math.max(1, Number(e.target.value) || 4)))}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("sessions.weeksAhead")}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="min-w-0 flex-1" onClick={() => setGenOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="primary" className="min-w-0 flex-1" loading={genLoading} onClick={() => void runGenerate()}>
              {t("sessions.generateSessions")}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
