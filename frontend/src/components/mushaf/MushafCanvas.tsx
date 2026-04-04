// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { getJuzForAyah, getSurahAyahAtPageStart, getSurahName } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";

interface MushafCanvasProps {
  page: number;
  riwaya: Riwaya;
}

export const MushafCanvas = forwardRef<HTMLCanvasElement, MushafCanvasProps>(function MushafCanvas(
  { page, riwaya },
  ref,
) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";
  const [surah, ayah] = getSurahAyahAtPageStart(page, riwaya);
  const juz = getJuzForAyah(surah, ayah, riwaya);

  return (
    <div
      className="flex w-full max-w-lg flex-col items-center justify-center rounded-xl border border-amber-100 shadow-inner"
      style={{ aspectRatio: "3 / 4", backgroundColor: "#FDF6E3" }}
    >
      <div
        id="mushaf-canvas"
        className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <p className="text-sm text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-ui)" }}>
          {t("mushaf.digitalKhattPlaceholder")}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-quran)" }}>
          {getSurahName(surah, loc)} · {t("mushaf.pageOf", { n: page })} · {t("mushaf.juzOf", { n: juz })}
        </p>
        <canvas ref={ref} className="max-h-[55%] w-full max-w-md opacity-0" aria-hidden />
      </div>
    </div>
  );
});
