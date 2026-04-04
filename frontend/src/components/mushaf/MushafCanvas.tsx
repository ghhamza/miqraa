// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getJuzForAyah,
  getSurahAyahAtPageStart,
  getSurahNameWithArabic,
  getSurahRangeOnPage,
} from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import { DigitalKhattRenderer } from "./DigitalKhattRenderer";

interface MushafCanvasProps {
  page: number;
  riwaya: Riwaya;
  /** Inside Mushaf book frame (double border, margins). */
  embedInBook?: boolean;
}

export function MushafCanvas({ page, riwaya, embedInBook = false }: MushafCanvasProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";
  const [surah, ayah] = getSurahAyahAtPageStart(page, riwaya);
  const { startSurah, endSurah } = getSurahRangeOnPage(page, riwaya);
  const juz = getJuzForAyah(surah, ayah, riwaya);

  if (riwaya === "hafs") {
    return (
      <div className="flex w-full flex-col items-center justify-center">
        <DigitalKhattRenderer pageNumber={page} embedInBook={embedInBook} />
      </div>
    );
  }

  return (
    <div
      className={`flex w-full flex-col items-center justify-center ${
        embedInBook ? "min-h-[18rem] py-8" : "max-w-lg rounded-xl border border-amber-100 shadow-md"
      }`}
      style={embedInBook ? undefined : { aspectRatio: "3 / 4", backgroundColor: "#FDF6E3" }}
    >
      <div
        id="mushaf-canvas"
        className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <BookOpen className="h-12 w-12 shrink-0" style={{ color: "#6B7280" }} aria-hidden />
        <p className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-ui)" }}>
          {t("mushaf.comingSoon")}
        </p>
        <p className="max-w-sm text-sm" style={{ color: "#6B7280", fontFamily: "var(--font-ui)" }}>
          {t("mushaf.comingSoonDesc", { riwaya: t(`mushaf.${riwaya}`) })}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-quran)" }}>
          {startSurah === endSurah
            ? getSurahNameWithArabic(startSurah, loc)
            : `${getSurahNameWithArabic(startSurah, loc)} · ${getSurahNameWithArabic(endSurah, loc)}`}{" "}
          · {t("mushaf.pageOf", { n: page })} · {t("mushaf.juzOf", { n: juz })}
        </p>
      </div>
    </div>
  );
}
