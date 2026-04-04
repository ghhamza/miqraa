// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { api, userFacingApiError } from "../../lib/api";
import type { Paginated, RecitationGrade, RecitationPublic } from "../../types";
import type { SessionParticipant } from "../../hooks/useSessionState";
import { getSurahNameWithArabic } from "../../lib/quranService";
import { GradeBadge } from "../recitations/GradeBadge";

const GRADE_ORDER: RecitationGrade[] = ["excellent", "good", "needs_work", "weak"];
const GRADE_COLORS: Record<RecitationGrade, string> = {
  excellent: "#1B5E20",
  good: "#4CAF50",
  needs_work: "#F57F17",
  weak: "#EF5350",
};

export interface GradingPanelProps {
  activeReciter: SessionParticipant | null;
  currentAyah: { surah: number; ayah: number } | null;
  highlightRange: { surah: number; ayahStart: number; ayahEnd: number } | null;
  sessionId: string;
  roomId: string;
  riwaya: string;
  locale: string;
  onGradeSubmitted: (studentId: string, grade: string, notes?: string) => void;
}

export function GradingPanel({
  activeReciter,
  currentAyah,
  highlightRange,
  sessionId,
  roomId,
  riwaya,
  locale,
  onGradeSubmitted,
}: GradingPanelProps) {
  const { t } = useTranslation();
  const [surah, setSurah] = useState(1);
  const [ayahStart, setAyahStart] = useState(1);
  const [ayahEnd, setAyahEnd] = useState(1);
  const [notes, setNotes] = useState("");
  const [list, setList] = useState<RecitationPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState(false);

  useEffect(() => {
    if (highlightRange) {
      setSurah(highlightRange.surah);
      setAyahStart(highlightRange.ayahStart);
      setAyahEnd(highlightRange.ayahEnd);
    } else if (currentAyah) {
      setSurah(currentAyah.surah);
      setAyahStart(currentAyah.ayah);
      setAyahEnd(currentAyah.ayah);
    }
  }, [
    highlightRange?.surah,
    highlightRange?.ayahStart,
    highlightRange?.ayahEnd,
    currentAyah?.surah,
    currentAyah?.ayah,
  ]);

  const loadList = useCallback(async () => {
    try {
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
        params: { session_id: sessionId, limit: 50 },
      });
      setList(data.items);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const submitGrade = async (grade: RecitationGrade) => {
    if (!activeReciter) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<RecitationPublic>("recitations", {
        student_id: activeReciter.userId,
        room_id: roomId,
        session_id: sessionId,
        surah,
        ayah_start: ayahStart,
        ayah_end: Math.max(ayahStart, ayahEnd),
        grade,
        teacher_notes: notes.trim() || undefined,
        riwaya,
      });
      setList((prev) => [data, ...prev]);
      setNotes("");
      setOkFlash(true);
      window.setTimeout(() => setOkFlash(false), 1800);
      onGradeSubmitted(activeReciter.userId, grade, notes.trim() || undefined);
    } catch (e: unknown) {
      setError(userFacingApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !activeReciter;

  return (
    <div className="border-t border-gray-100 bg-muted/20 px-4 py-4" style={{ fontFamily: "var(--font-ui)" }}>
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("liveSession.gradeRecitation")}</h3>

      {disabled ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t("liveSession.setReciterFirst")}</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-[var(--color-text)]">
            <span className="text-[var(--color-text-muted)]">{t("liveSession.reciter")}:</span>{" "}
            {activeReciter.name}
          </p>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-quran)" }}>
            {getSurahNameWithArabic(surah, locale)} · {t("liveSession.ayahRange")}: {ayahStart}–{ayahEnd}
          </p>
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
            <label className="col-span-1 flex flex-col gap-1">
              <span className="text-[var(--color-text-muted)]">س / Surah</span>
              <input
                type="number"
                min={1}
                max={114}
                className="rounded border border-gray-200 px-2 py-1"
                value={surah}
                onChange={(e) => setSurah(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[var(--color-text-muted)]">{t("recitations.ayahStart")}</span>
              <input
                type="number"
                min={1}
                className="rounded border border-gray-200 px-2 py-1"
                value={ayahStart}
                onChange={(e) => setAyahStart(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[var(--color-text-muted)]">{t("recitations.ayahEnd")}</span>
              <input
                type="number"
                min={1}
                className="rounded border border-gray-200 px-2 py-1"
                value={ayahEnd}
                onChange={(e) => setAyahEnd(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {GRADE_ORDER.map((g) => (
              <button
                key={g}
                type="button"
                disabled={submitting}
                onClick={() => void submitGrade(g)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                style={{ backgroundColor: GRADE_COLORS[g] }}
              >
                {t(`recitations.${g === "needs_work" ? "needsWork" : g}`)}
              </button>
            ))}
          </div>

          {okFlash ? (
            <p className="mb-2 flex items-center gap-1 text-sm text-[#1B5E20]">
              <Check className="size-4" aria-hidden />
              {t("liveSession.gradeSubmitted")}
            </p>
          ) : null}
          {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

          <label className="mb-4 block">
            <span className="sr-only">{t("liveSession.gradeNotes")}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("liveSession.gradeNotes")}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </>
      )}

      <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">{t("liveSession.sessionRecitations")}</p>
      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)]">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">—</p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-[var(--color-surface)] px-2 py-1.5">
              <span className="min-w-0 truncate" style={{ fontFamily: "var(--font-quran)" }}>
                {r.student_name ?? "—"} — {getSurahNameWithArabic(r.surah, locale)} {r.ayah_start}:{r.ayah_end}
              </span>
              <GradeBadge grade={r.grade} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
