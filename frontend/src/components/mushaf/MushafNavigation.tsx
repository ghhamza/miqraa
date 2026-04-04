// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getAllJuz,
  getAllSurahs,
  getJuzForAyah,
  getPageForJuzStart,
  getPageForSurahStart,
  getSurahAyahAtPageStart,
  getSurahNameWithArabic,
} from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";

const LAST_SURAH_STORAGE_KEY = "miqraa.mushaf.lastSurah";

interface MushafNavigationProps {
  page: number;
  totalPages: number;
  riwaya: Riwaya;
  onPageChange: (p: number) => void;
  /** Read-only: show surah/juz/page but do not allow changes (e.g. live session students). */
  disabled?: boolean;
}

export function MushafNavigation({
  page,
  totalPages,
  riwaya,
  onPageChange,
  disabled = false,
}: MushafNavigationProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";
  const isRtl = i18n.language === "ar";
  const surahs = getAllSurahs();
  const juzMeta = getAllJuz();

  const [surahStart, ayahStart] = getSurahAyahAtPageStart(page, riwaya);
  const juz = getJuzForAyah(surahStart, ayahStart, riwaya);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_SURAH_STORAGE_KEY, String(surahStart));
    } catch {
      /* ignore quota / private mode */
    }
  }, [surahStart]);

  const fieldClass =
    "w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2.5 text-base font-medium text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

  const surahField = (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground/80">{t("mushaf.goToSurah")}</label>
      <select
        className={fieldClass}
        style={{ fontFamily: "var(--font-quran)" }}
        value={String(surahStart)}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (n >= 1 && n <= 114) {
            onPageChange(getPageForSurahStart(n, riwaya));
          }
        }}
      >
        {surahs.map((s) => (
          <option key={s.number} value={s.number}>
            {s.number}. {getSurahNameWithArabic(s.number, loc)}
          </option>
        ))}
      </select>
    </div>
  );

  const juzField = (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground/80">{t("mushaf.goToJuz")}</label>
      <select
        className={fieldClass}
        style={{ fontFamily: "var(--font-quran)" }}
        value={String(juz)}
        disabled={disabled}
        onChange={(e) => {
          const jn = Number(e.target.value);
          if (jn >= 1 && jn <= 30) {
            onPageChange(getPageForJuzStart(jn, riwaya));
          }
        }}
      >
        {juzMeta.map((j) => (
          <option key={j.number} value={j.number}>
            {j.number}. {j.nameAr}
          </option>
        ))}
      </select>
    </div>
  );

  const pageField = (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground/80">{t("mushaf.goToPage")}</label>
      <input
        id="mushaf-go-to-page"
        key={page}
        type="number"
        min={1}
        max={totalPages}
        className={`${fieldClass} tabular-nums`}
        defaultValue={page}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = Number((e.target as HTMLInputElement).value);
            if (v >= 1 && v <= totalPages) onPageChange(v);
          }
        }}
      />
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3" dir={isRtl ? "rtl" : "ltr"}>
        {isRtl ? (
          <>
            {pageField}
            {juzField}
            {surahField}
          </>
        ) : (
          <>
            {surahField}
            {juzField}
            {pageField}
          </>
        )}
      </div>
    </div>
  );
}
