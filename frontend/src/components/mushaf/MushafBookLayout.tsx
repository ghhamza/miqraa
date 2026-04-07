// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ReactNode } from "react";
import {
  findHizbStartingAtPage,
  findJuzStartingAtPage,
  getJuz,
  getJuzForAyah,
  getSurah,
  getSurahAyahAtPageStart,
  getSurahRangeOnPage,
} from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Portrait page proportion (≈ A4 width:height) so the mushaf card keeps shape across viewports. */
const MUSHAF_PAGE_ASPECT = "210 / 297" as const;
const MUSHAF_PAGE_W_H = 210 / 297;

function toArabicIndic(n: number): string {
  return String(n)
    .split("")
    .map((d) => AR_DIGITS[Number(d)] ?? d)
    .join("");
}

export interface MushafBookLayoutProps {
  page: number;
  riwaya: Riwaya;
  children: ReactNode;
}

export function MushafBookLayout({ page, riwaya, children }: MushafBookLayoutProps) {
  const { startSurah, endSurah } = getSurahRangeOnPage(page, riwaya);
  const [s, a] = getSurahAyahAtPageStart(page, riwaya);
  const juzAtPageStart = findJuzStartingAtPage(page, riwaya);
  const juz = juzAtPageStart ?? getJuz(getJuzForAyah(s, a, riwaya));
  const hizbAtPageStart = findHizbStartingAtPage(page, riwaya);

  const surahStart = getSurah(startSurah);
  const surahEnd = getSurah(endSurah);
  const surahHeader =
    startSurah === endSurah
      ? surahStart
        ? `سورة ${surahStart.nameAr}`
        : ""
      : surahStart && surahEnd
        ? `سورة ${surahStart.nameAr} – سورة ${surahEnd.nameAr}`
        : "";

  const juzLine = juz ? juz.nameAr : "";
  const hizbLine =
    hizbAtPageStart != null ? ` · حزب ${toArabicIndic(hizbAtPageStart.number)}` : "";

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden [container-type:size]">
      <div
        className="mx-auto flex min-h-0 w-full max-w-3xl shrink-0 flex-col overflow-hidden rounded-lg border shadow-sm"
        style={{
          borderColor: "var(--mushaf-page-border)",
          background: "var(--mushaf-page-paper)",
          aspectRatio: MUSHAF_PAGE_ASPECT,
          maxHeight: "100%",
          /* Fit when height is the limiting axis (short viewports): width scales with container height. */
          width: `min(100%, min(48rem, calc(100cqh * ${MUSHAF_PAGE_W_H})))`,
        }}
      >
        <div
          dir="rtl"
          className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 text-lg font-medium leading-relaxed sm:text-xl"
          style={{
            fontFamily: "var(--font-quran)",
            color: "var(--mushaf-surah-title-color)",
          }}
        >
          {/* `truncate` uses overflow:hidden and clips Arabic descenders; surah line may still need ellipsis for long dual-surah headers */}
          <span className="min-w-0 truncate py-px text-right">{surahHeader}</span>
          <span className="min-w-0 shrink-0 whitespace-nowrap py-px text-left">
            {juzLine}
            {hizbLine}
          </span>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden px-4 sm:px-6 md:px-7">
          {/* Stretch mushaf content / loading skeleton to full page column height */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>

        <div
          className={`shrink-0 px-4 py-2.5 text-lg font-medium tabular-nums sm:text-xl ${page % 2 === 1 ? "text-right" : "text-left"}`}
          style={{
            fontFamily: "var(--font-quran)",
            color: "var(--mushaf-surah-title-color)",
          }}
        >
          {toArabicIndic(page)}
        </div>
      </div>
    </div>
  );
}
