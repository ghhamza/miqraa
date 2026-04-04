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
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
      <div
        className="flex min-h-0 w-full max-w-3xl flex-1 flex-col rounded-lg border-2 shadow-sm"
        style={{
          borderColor: "var(--mushaf-frame-teal)",
          background: "var(--mushaf-madinah-parchment)",
        }}
      >
        <div
          dir="rtl"
          className="flex shrink-0 justify-between gap-2 border-b px-4 py-2 text-sm leading-snug sm:text-base"
          style={{
            fontFamily: "var(--font-quran)",
            color: "var(--mushaf-frame-teal)",
            borderColor: "rgba(44, 95, 124, 0.25)",
          }}
        >
          <span className="min-w-0 truncate text-right">{surahHeader}</span>
          <span className="min-w-0 shrink-0 truncate text-left">
            {juzLine}
            {hizbLine}
          </span>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-3 sm:px-7">
          {children}
        </div>

        <div
          className="shrink-0 border-t px-4 py-2 text-center text-xs sm:text-sm"
          style={{
            fontFamily: "var(--font-quran)",
            color: "var(--mushaf-frame-teal)",
            borderColor: "rgba(44, 95, 124, 0.25)",
          }}
        >
          {toArabicIndic(page)}
        </div>
      </div>
    </div>
  );
}
