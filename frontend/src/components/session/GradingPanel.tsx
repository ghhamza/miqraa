// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { api, userFacingApiError } from "../../lib/api";
import type { Paginated, RecitationGrade, RecitationPublic } from "../../types";
import type { SessionParticipant } from "../../hooks/useSessionState";
import {
  getAllSurahs,
  getSurahAyahCount,
  getSurahNameWithArabic,
} from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import { cn } from "@/lib/utils";
import { FormSelect } from "@/components/ui/select";
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
  /** Fires after POST /recitations succeeds — use for linking error annotations to a recitation row. */
  onRecitationCreated?: (rec: RecitationPublic) => void;
  /** When the title is shown elsewhere (e.g. Dialog header). */
  hideTitle?: boolean;
  className?: string;
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
  onRecitationCreated,
  hideTitle = false,
  className,
}: GradingPanelProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const riwayaTyped = riwaya as Riwaya;
  const [surah, setSurah] = useState(() => {
    if (highlightRange) return highlightRange.surah;
    if (currentAyah) return currentAyah.surah;
    return 1;
  });
  const [ayahStart, setAyahStart] = useState(() => {
    if (highlightRange) return highlightRange.ayahStart;
    if (currentAyah) return currentAyah.ayah;
    return 1;
  });
  const [ayahEnd, setAyahEnd] = useState(() => {
    if (highlightRange) return highlightRange.ayahEnd;
    if (currentAyah) return currentAyah.ayah;
    return 1;
  });
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

  const surahSelectOptions = useMemo(
    () =>
      getAllSurahs().map((s) => ({
        value: String(s.number),
        label: `${s.number}. ${getSurahNameWithArabic(s.number, locale)}`,
      })),
    [locale],
  );

  /** Same box model as native inputs so the surah select lines up in the grid. */
  const rangeFieldClass =
    "box-border h-9 w-full min-h-9 rounded-lg border border-input bg-background px-2 text-xs leading-none text-foreground shadow-none outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-xs sm:leading-none";
  const surahSelectTriggerClass = rangeFieldClass;
  const surahSelectStyle = { fontFamily: "var(--font-ui)", color: "var(--color-text)" } as const;

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
      onRecitationCreated?.(data);
      onGradeSubmitted(activeReciter.userId, grade, notes.trim() || undefined);
    } catch (e: unknown) {
      setError(userFacingApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !activeReciter;

  return (
    <div
      className={cn("border-t border-gray-100 bg-muted/20 px-4 py-4", className)}
      style={{ fontFamily: "var(--font-ui)" }}
    >
      {!hideTitle ? (
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("liveSession.gradeRecitation")}</h3>
      ) : null}

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
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs items-end">
            <label className="col-span-1 flex min-w-0 flex-col gap-1.5">
              <span className="leading-tight text-[var(--color-text-muted)]">{t("recitations.surah")}</span>
              <FormSelect
                value={String(surah)}
                onValueChange={(v) => {
                  const n = Number(v);
                  if (n < 1 || n > 114) return;
                  setSurah(n);
                  const max = getSurahAyahCount(n, riwayaTyped);
                  const clamp = (x: number) => Math.max(1, Math.min(x, max));
                  setAyahStart((a) => clamp(a));
                  setAyahEnd((a) => clamp(a));
                }}
                dir={isRtl ? "rtl" : "ltr"}
                aria-label={t("recitations.selectSurah")}
                triggerClassName={surahSelectTriggerClass}
                triggerStyle={surahSelectStyle}
                contentClassName="max-h-[min(22rem,70vh)]"
                options={surahSelectOptions}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="leading-tight text-[var(--color-text-muted)]">{t("recitations.ayahStart")}</span>
              <input
                type="number"
                min={1}
                className={cn(rangeFieldClass, "tabular-nums")}
                value={ayahStart}
                onChange={(e) => setAyahStart(Number(e.target.value))}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="leading-tight text-[var(--color-text-muted)]">{t("recitations.ayahEnd")}</span>
              <input
                type="number"
                min={1}
                className={cn(rangeFieldClass, "tabular-nums")}
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
