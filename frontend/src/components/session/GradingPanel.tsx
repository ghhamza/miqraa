// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { api } from "../../lib/api";
import { useApiMutation } from "../../lib/useApiMutation";
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
import { waitForQfSyncStatus } from "../../lib/qfSync";
import { QfSyncToast } from "../recitations/QfSyncToast";
import { recitationKeys, userKeys } from "../../lib/queryKeys";

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
  /** When set with `gradingMode: "completePlan"`, submit uses POST /recitations/:id/complete. */
  gradingMode?: "create" | "completePlan";
  planToComplete?: RecitationPublic | null;
  onPlanCompleted?: (rec: RecitationPublic) => void;
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
  gradingMode = "create",
  planToComplete = null,
  onPlanCompleted,
  hideTitle = false,
  className,
}: GradingPanelProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
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
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState(false);
  const [qfSyncToast, setQfSyncToast] = useState<{ kind: "success" | "error"; relinkNeeded?: boolean } | null>(null);

  useEffect(() => {
    if (gradingMode === "completePlan" && planToComplete) {
      setSurah(planToComplete.surah);
      setAyahStart(planToComplete.ayah_start);
      setAyahEnd(planToComplete.ayah_end);
      return;
    }
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
    gradingMode,
    planToComplete?.surah,
    planToComplete?.ayah_start,
    planToComplete?.ayah_end,
    highlightRange?.surah,
    highlightRange?.ayahStart,
    highlightRange?.ayahEnd,
    currentAyah?.surah,
    currentAyah?.ayah,
  ]);

  const listQuery = useQuery({
    queryKey: recitationKeys.list({ session: sessionId }),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
        signal,
        params: { session_id: sessionId, limit: 50 },
      });
      return data.items;
    },
  });
  const list = listQuery.data ?? [];
  const loading = listQuery.isPending;

  const loadList = useCallback(async () => {
    await listQuery.refetch();
  }, [listQuery]);
  void loadList;

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

  const isCompletePlan = gradingMode === "completePlan" && planToComplete != null;

  type CompletePlanInput = {
    planId: string;
    grade: RecitationGrade;
    notes: string;
  };

  type CreateAndGradeInput = {
    student_id: string;
    room_id: string;
    session_id: string;
    surah: number;
    ayah_start: number;
    ayah_end: number;
    grade: RecitationGrade;
    teacher_notes: string | undefined;
    riwaya: Riwaya;
  };

  const completePlanMutation = useApiMutation<RecitationPublic, CompletePlanInput>({
    mutationFn: async ({ planId, grade, notes }) => {
      const { data } = await api.request<RecitationPublic>({
        method: "post",
        url: `recitations/${planId}/complete`,
        data: {
          grade,
          teacher_notes: notes.trim() || undefined,
        },
      });
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData<RecitationPublic[]>(
        recitationKeys.list({ session: sessionId }),
        (prev = []) => {
          const rest = prev.filter((r) => r.id !== data.id);
          return [data, ...rest];
        },
      );
      if (data.student_id) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: userKeys.studentRecitations(data.student_id),
          }),
          queryClient.invalidateQueries({
            queryKey: userKeys.studentProgress(data.student_id),
          }),
        ]);
      }
      setNotes("");
      setOkFlash(true);
      window.setTimeout(() => setOkFlash(false), 1800);
      onPlanCompleted?.(data);
      const sid = planToComplete?.student_id ?? activeReciter?.userId;
      if (sid) onGradeSubmitted(sid, data.grade ?? "good", notes.trim() || undefined);
      const sync = await waitForQfSyncStatus(data.id);
      if (sync?.synced_at) {
        setQfSyncToast({ kind: "success" });
      } else if (sync?.error && sync.error !== "not_linked") {
        setQfSyncToast({
          kind: "error",
          relinkNeeded: sync.error === "insufficient_scope",
        });
      }
    },
    onError: (message) => setError(message),
  });

  const createAndGradeMutation = useApiMutation<RecitationPublic, CreateAndGradeInput>({
    mutationFn: async (input) => {
      const { data } = await api.request<RecitationPublic>({
        method: "post",
        url: "recitations",
        data: input,
      });
      return data;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData<RecitationPublic[]>(
        recitationKeys.list({ session: sessionId }),
        (prev = []) => [data, ...prev],
      );
      if (data.student_id) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: userKeys.studentRecitations(data.student_id),
          }),
          queryClient.invalidateQueries({
            queryKey: userKeys.studentProgress(data.student_id),
          }),
        ]);
      }
      setNotes("");
      setOkFlash(true);
      window.setTimeout(() => setOkFlash(false), 1800);
      onRecitationCreated?.(data);
      if (data.student_id) {
        onGradeSubmitted(data.student_id, data.grade ?? "good", notes.trim() || undefined);
      }
      const sync = await waitForQfSyncStatus(data.id);
      if (sync?.synced_at) {
        setQfSyncToast({ kind: "success" });
      } else if (sync?.error && sync.error !== "not_linked") {
        setQfSyncToast({
          kind: "error",
          relinkNeeded: sync.error === "insufficient_scope",
        });
      }
    },
    onError: (message) => setError(message),
  });

  const submitting = completePlanMutation.isPending || createAndGradeMutation.isPending;

  const submitGrade = (grade: RecitationGrade) => {
    if (isCompletePlan) {
      if (!planToComplete) return;
      setError(null);
      completePlanMutation.mutate({
        planId: planToComplete.id,
        grade,
        notes,
      });
      return;
    }

    if (!activeReciter) return;
    setError(null);
    createAndGradeMutation.mutate({
      student_id: activeReciter.userId,
      room_id: roomId,
      session_id: sessionId,
      surah,
      ayah_start: ayahStart,
      ayah_end: Math.max(ayahStart, ayahEnd),
      grade,
      teacher_notes: notes.trim() || undefined,
      riwaya: riwayaTyped,
    });
  };

  const disabled = isCompletePlan ? !planToComplete : !activeReciter;

  return (
    <div
      className={cn("border-t border-gray-100 bg-muted/20 px-4 py-4", className)}
      style={{ fontFamily: "var(--font-ui)" }}
    >
      {qfSyncToast ? (
        <QfSyncToast
          kind={qfSyncToast.kind}
          relinkNeeded={qfSyncToast.relinkNeeded}
          onDismiss={() => setQfSyncToast(null)}
        />
      ) : null}
      {!hideTitle ? (
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("liveSession.gradeRecitation")}</h3>
      ) : null}

      {disabled ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t("liveSession.setReciterFirst")}</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-[var(--color-text)]">
            <span className="text-[var(--color-text-muted)]">{t("liveSession.reciter")}:</span>{" "}
            {activeReciter?.name ?? planToComplete?.student_name ?? "—"}
          </p>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-quran)" }}>
            {getSurahNameWithArabic(surah, locale)} · {t("liveSession.ayahRange")}: {ayahStart}–{ayahEnd}
          </p>
          {!isCompletePlan ? (
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
          ) : null}

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
