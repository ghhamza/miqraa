// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { FormSelect } from "@/components/ui/select";
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
  /**
   * When the user jumps via “go to surah”, that surah may start mid-page while the page header
   * still lists the previous surah first. While `page === getPageForSurahStart(surahIntent)`, the
   * surah select shows `surahIntent` instead of the first surah on the page.
   */
  surahIntent: number | null;
  onSurahIntent: (surah: number) => void;
  /** Read-only: show surah/juz/page but do not allow changes (e.g. live session students). */
  disabled?: boolean;
  /** Called after surah/juz selection or Enter on page number (e.g. close jump sheet). */
  onAfterNavigate?: () => void;
}

export function MushafNavigation({
  page,
  totalPages,
  riwaya,
  onPageChange,
  surahIntent,
  onSurahIntent,
  disabled = false,
  onAfterNavigate,
}: MushafNavigationProps) {
  const { t, i18n } = useTranslation();
  const pageInputId = useId();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";
  const isRtl = i18n.language === "ar";
  const surahs = getAllSurahs();
  const juzMeta = getAllJuz();

  const [surahAtPageStart, ayahStart] = getSurahAyahAtPageStart(page, riwaya);
  const juz = getJuzForAyah(surahAtPageStart, ayahStart, riwaya);

  const surahIntentMatchesPage =
    surahIntent != null &&
    surahIntent >= 1 &&
    surahIntent <= 114 &&
    getPageForSurahStart(surahIntent, riwaya) === page;
  const surahSelectValue = surahIntentMatchesPage ? surahIntent : surahAtPageStart;

  useEffect(() => {
    try {
      localStorage.setItem(LAST_SURAH_STORAGE_KEY, String(surahSelectValue));
    } catch {
      /* ignore quota / private mode */
    }
  }, [surahSelectValue]);

  /* Page number input: fixed height to match Radix Select trigger (h-11). */
  const controlBase =
    "box-border h-11 w-full min-w-0 max-w-full rounded-lg border border-border bg-background py-2 text-sm font-medium leading-7 text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-base sm:leading-7";
  const controlClass = `${controlBase} px-2.5 sm:px-3`;

  /** Radix Select trigger: IBM Plex for Arabic; avoid Amiri on closed control (WebKit blank paint). */
  const mushafSelectStyle = { fontFamily: "var(--font-ui)", color: "var(--color-text)" } as const;
  const mushafSelectTriggerClass =
    "border-border leading-7 shadow-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:leading-7";

  const surahField = (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-foreground/80 sm:text-sm">{t("mushaf.goToSurah")}</label>
      <FormSelect
        value={String(surahSelectValue)}
        onValueChange={(v) => {
          const n = Number(v);
          if (n >= 1 && n <= 114) {
            onSurahIntent(n);
            onPageChange(getPageForSurahStart(n, riwaya));
            onAfterNavigate?.();
          }
        }}
        disabled={disabled}
        dir={isRtl ? "rtl" : "ltr"}
        aria-label={t("mushaf.goToSurah")}
        triggerClassName={mushafSelectTriggerClass}
        triggerStyle={mushafSelectStyle}
        options={surahs.map((s) => ({
          value: String(s.number),
          label: `${s.number}. ${getSurahNameWithArabic(s.number, loc)}`,
        }))}
      />
    </div>
  );

  const juzField = (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-foreground/80 sm:text-sm">{t("mushaf.goToJuz")}</label>
      <FormSelect
        value={String(juz)}
        onValueChange={(v) => {
          const jn = Number(v);
          if (jn >= 1 && jn <= 30) {
            onPageChange(getPageForJuzStart(jn, riwaya));
            onAfterNavigate?.();
          }
        }}
        disabled={disabled}
        dir={isRtl ? "rtl" : "ltr"}
        aria-label={t("mushaf.goToJuz")}
        triggerClassName={mushafSelectTriggerClass}
        triggerStyle={mushafSelectStyle}
        options={juzMeta.map((j) => ({
          value: String(j.number),
          label: `${j.number}. ${j.nameAr}`,
        }))}
      />
    </div>
  );

  const pageField = (
    <div className="min-w-0">
      <label htmlFor={pageInputId} className="mb-1 block text-xs font-medium text-foreground/80 sm:text-sm">
        {t("mushaf.goToPage")}
      </label>
      <input
        id={pageInputId}
        key={page}
        type="number"
        min={1}
        max={totalPages}
        className={`${controlClass} tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        defaultValue={page}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = Number((e.target as HTMLInputElement).value);
            if (v >= 1 && v <= totalPages) {
              onPageChange(v);
              onAfterNavigate?.();
            }
          }
        }}
      />
    </div>
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* Single column until lg: three narrow columns below ~1024px crush long Arabic labels in selects */}
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-3" dir={isRtl ? "rtl" : "ltr"}>
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
