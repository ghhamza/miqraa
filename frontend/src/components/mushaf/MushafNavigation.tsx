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
}

export function MushafNavigation({ page, totalPages, riwaya, onPageChange }: MushafNavigationProps) {
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

  const surahField = (
    <div>
      <label className="mb-0.5 block text-[0.65rem] text-[var(--color-text-muted)]">{t("mushaf.goToSurah")}</label>
      <select
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        style={{ fontFamily: "var(--font-quran)" }}
        value={String(surahStart)}
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
      <label className="mb-0.5 block text-[0.65rem] text-[var(--color-text-muted)]">{t("mushaf.goToJuz")}</label>
      <select
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        value={String(juz)}
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
      <label className="mb-0.5 block text-[0.65rem] text-[var(--color-text-muted)]">{t("mushaf.goToPage")}</label>
      <input
        id="mushaf-go-to-page"
        key={page}
        type="number"
        min={1}
        max={totalPages}
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        defaultValue={page}
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
    <div className="flex w-full flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-3" dir={isRtl ? "rtl" : "ltr"}>
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
