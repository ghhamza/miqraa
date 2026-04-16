// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSurahDisplayMeta, getSurahNameWithArabic, QURAN_SURAHS } from "../../lib/quranService";
import type { RecitationGrade } from "../../types";

interface SurahProgressGridProps {
  surahBestGrades: { surah: number; best_grade: string | null }[];
}

const cellColors: Record<RecitationGrade, string> = {
  excellent: "bg-[#1B5E20] text-white border-[#145a18]",
  good: "bg-[#4CAF50] text-white border-[#43a047]",
  needs_work: "bg-[#F57F17] text-white border-[#e65100]",
  weak: "bg-[#EF5350] text-white border-[#e53935]",
};

function parseGrade(g: string | null | undefined): RecitationGrade | null {
  if (!g) return null;
  if (g === "excellent" || g === "good" || g === "needs_work" || g === "weak") return g;
  return null;
}

export function SurahProgressGrid({ surahBestGrades }: SurahProgressGridProps) {
  const { t, i18n } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const gradeBySurah = useMemo(() => {
    const m = new Map<number, RecitationGrade | null>();
    for (const x of surahBestGrades) {
      m.set(x.surah, parseGrade(x.best_grade));
    }
    return m;
  }, [surahBestGrades]);

  const coveredSet = useMemo(
    () => new Set(surahBestGrades.map((x) => x.surah)),
    [surahBestGrades],
  );

  return (
    <div>
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(28px,1fr))] gap-0.5">
        {QURAN_SURAHS.map((s) => {
          const g = gradeBySurah.get(s.number) ?? null;
          const covered = coveredSet.has(s.number);
          const cls =
            covered && g
              ? cellColors[g]
              : covered
                ? "bg-emerald-200 border-emerald-300 text-emerald-900"
                : "bg-gray-200 border-gray-300 text-gray-600";
          const meta = getSurahDisplayMeta(s.number);
          const nameLine = getSurahNameWithArabic(s.number, loc);
          const revLabel =
            meta?.revelationType === "meccan" ? t("mushaf.meccan") : t("mushaf.medinan");
          const title = meta
            ? `${meta.number}. ${nameLine} · ${meta.totalAyahs} ${t("mushaf.ayahs")} · ${revLabel} · ${t("mushaf.revelationOrder")}: ${meta.revelationOrder}${
                g ? ` — ${t(`recitations.${g === "needs_work" ? "needsWork" : g}`)}` : ""
              }`
            : String(s.number);
          return (
            <button
              key={s.number}
              type="button"
              title={title}
              onMouseEnter={() => setHover(s.number)}
              onMouseLeave={() => setHover(null)}
              className={`flex h-7 min-h-[28px] min-w-[28px] items-center justify-center rounded border text-[0.65rem] font-semibold transition hover:scale-105 hover:shadow ${cls} ${
                hover === s.number ? "ring-2 ring-[var(--color-primary)]/40" : ""
              }`}
            >
              {s.number}
            </button>
          );
        })}
      </div>
    </div>
  );
}
