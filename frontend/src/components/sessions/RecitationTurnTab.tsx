// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { getSurahAyahCount, getSurahNameWithArabic, isValidAyahRange } from "../../lib/quranService";
import type { QuranRiwaya, RecitationGrade, RecitationPublic, TurnType } from "../../types";
import { Button } from "../ui/Button";
import { SurahPicker } from "../recitations/SurahPicker";
import { AyahRangeAudioButton } from "../recitations/AyahRangeAudioButton";

interface RecitationTurnTabProps {
  turnType: TurnType;
  sessionId: string;
  studentId: string;
  roomId: string;
  riwaya: QuranRiwaya;
  existing: RecitationPublic | null;
  onSaved: () => void;
}

export function RecitationTurnTab({
  turnType,
  sessionId,
  studentId,
  roomId,
  riwaya,
  existing,
  onSaved,
}: RecitationTurnTabProps) {
  const { t, i18n } = useTranslation();
  const isEdit = existing != null;
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const [surah, setSurah] = useState(existing?.surah ?? 1);
  const [ayahStart, setAyahStart] = useState(existing?.ayah_start ?? 1);
  const [ayahEnd, setAyahEnd] = useState(existing?.ayah_end ?? 1);
  const [pagesCount, setPagesCount] = useState<string>(existing?.pages_count?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.teacher_notes ?? "");
  const [starRating, setStarRating] = useState<number>(existing?.star_rating ?? 0);
  const [grade, setGrade] = useState<RecitationGrade | "">(existing?.grade ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setSurah(existing?.surah ?? 1);
    setAyahStart(existing?.ayah_start ?? 1);
    setAyahEnd(existing?.ayah_end ?? 1);
    setPagesCount(existing?.pages_count?.toString() ?? "");
    setNotes(existing?.teacher_notes ?? "");
    setStarRating(existing?.star_rating ?? 0);
    setGrade(existing?.grade ?? "");
    setError(null);
    setSuccess(false);
  }, [existing, turnType]);

  const maxAyah = getSurahAyahCount(surah, riwaya);

  const ayahStartOptions = useMemo(
    () => Array.from({ length: maxAyah }, (_, i) => i + 1),
    [maxAyah],
  );

  const ayahEndOptions = useMemo(
    () => Array.from({ length: Math.max(0, maxAyah - ayahStart + 1) }, (_, i) => ayahStart + i),
    [maxAyah, ayahStart],
  );

  useEffect(() => {
    if (ayahStart > maxAyah) setAyahStart(1);
    if (ayahEnd > maxAyah) setAyahEnd(maxAyah);
  }, [surah, maxAyah]);

  useEffect(() => {
    if (ayahEnd < ayahStart) setAyahEnd(ayahStart);
  }, [ayahStart, ayahEnd]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    if (!isValidAyahRange(surah, ayahStart, ayahEnd, riwaya)) {
      setError(t("recitations.invalidRange"));
      setSaving(false);
      return;
    }

    const body = {
      student_id: studentId,
      room_id: roomId,
      session_id: sessionId,
      surah,
      ayah_start: ayahStart,
      ayah_end: ayahEnd,
      turn_type: turnType,
      pages_count: pagesCount ? parseFloat(pagesCount) : null,
      star_rating: starRating > 0 ? starRating : null,
      grade: grade || null,
      teacher_notes: notes.trim() || null,
      riwaya,
    };

    try {
      if (isEdit && existing) {
        await api.put(`/recitations/${existing.id}`, {
          surah,
          ayah_start: ayahStart,
          ayah_end: ayahEnd,
          turn_type: turnType,
          pages_count: pagesCount ? parseFloat(pagesCount) : null,
          star_rating: starRating > 0 ? starRating : null,
          grade: grade || null,
          teacher_notes: notes.trim() || null,
        });
      } else {
        await api.post("/recitations", body);
      }
      setSuccess(true);
      onSaved();
    } catch (e) {
      setError(userFacingApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--color-text)]">
          {t("sessions.fromSurah")}
        </label>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <SurahPicker value={surah} onChange={(s) => s && setSurah(s)} riwaya={riwaya} />
          </div>
          <div className="w-24 shrink-0">
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.ayahStart")}</label>
            <select
              className="w-full rounded-lg border border-gray-200 bg-[var(--color-surface)] px-2 py-2 text-sm"
              value={ayahStart}
              onChange={(e) => setAyahStart(Number(e.target.value))}
            >
              {ayahStartOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--color-text)]">
          {t("sessions.toSurah")}
        </label>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="rounded-lg border border-gray-200 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]">
              {surah}. {getSurahNameWithArabic(surah, loc)}
            </div>
          </div>
          <div className="w-24 shrink-0">
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.ayahEnd")}</label>
            <select
              className="w-full rounded-lg border border-gray-200 bg-[var(--color-surface)] px-2 py-2 text-sm"
              value={ayahEnd}
              onChange={(e) => setAyahEnd(Number(e.target.value))}
            >
              {ayahEndOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isValidAyahRange(surah, ayahStart, ayahEnd, riwaya) ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{t("recitations.audio.previewLabel")}</span>
          <AyahRangeAudioButton surah={surah} ayahStart={ayahStart} ayahEnd={ayahEnd} variant="labeled" />
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-[var(--color-text)]">
          {t("sessions.pagesCount")}
        </label>
        <input
          type="number"
          step="0.5"
          min="0"
          max="604"
          className="mt-1 w-32 rounded-lg border border-gray-200 bg-[var(--color-surface)] px-3 py-2 text-sm"
          value={pagesCount}
          onChange={(e) => setPagesCount(e.target.value)}
          placeholder="0.0"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text)]">
          {t("sessions.teacherNotes")}
        </label>
        <textarea
          className="mt-1 w-full rounded-lg border border-gray-200 bg-[var(--color-surface)] px-3 py-2 text-sm"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("sessions.notesPlaceholder")}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text)]">
          {t("recitations.grade")}
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["excellent", "good", "needs_work", "weak"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(grade === g ? "" : g)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                grade === g
                  ? g === "excellent"
                    ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                    : g === "good"
                      ? "border-[#4CAF50] bg-[#4CAF50] text-white"
                      : g === "needs_work"
                        ? "border-[#F57F17] bg-[#F57F17] text-white"
                        : "border-[#EF5350] bg-[#EF5350] text-white"
                  : "border-gray-200 bg-[var(--color-surface)] text-[var(--color-text)]"
              }`}
            >
              {t(`recitations.${g === "needs_work" ? "needsWork" : g}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text)]">
          {t("sessions.starRating")}
        </label>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStarRating(starRating === n ? 0 : n)}
              className="text-2xl transition hover:scale-110"
              style={{ color: n <= starRating ? "#D4A843" : "#D1D5DB" }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p className="text-sm text-[var(--color-primary)]">{t("sessions.saved")}</p> : null}

      <div className="flex justify-end">
        <Button type="button" variant="primary" loading={saving} onClick={() => void handleSave()}>
          {isEdit ? t("common.save") : t("sessions.saveRecitation")}
        </Button>
      </div>
    </div>
  );
}
