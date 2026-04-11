// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { getSurah } from "../../lib/quranService";
import { getSurahNameSvgUrl } from "../../lib/surahNameSvg";
import { cn } from "@/lib/utils";

export interface SurahNameSvgProps {
  surah: number;
  className?: string;
  /** Screen reader / when SVG is missing */
  fallbackLabel?: string;
}

/**
 * Arabic surah title artwork from `assets/surah-names/svg/{n}.svg`.
 *
 * We render a normal `<img>` and tint with CSS `filter` (see `.mushaf-surah-title-img` in `index.css`).
 * The previous mask + solid background approach breaks in WebKit: failed `mask-image` on external SVGs
 * paints the full box as `--mushaf-surah-title-color` (solid blue rectangle).
 */
export function SurahNameSvg({ surah, className, fallbackLabel }: SurahNameSvgProps) {
  const url = getSurahNameSvgUrl(surah);
  const s = getSurah(surah);
  const label = fallbackLabel ?? (s ? `سورة ${s.nameAr}` : `Surah ${surah}`);

  if (!url) {
    return (
      <span
        className={cn("inline-block font-semibold text-[var(--mushaf-surah-title-color)]", className)}
        style={{ fontFamily: "var(--font-mushaf-title)" }}
      >
        {s?.nameAr ?? String(surah)}
      </span>
    );
  }

  return (
    <div className="relative inline-block max-w-full min-w-0" role="img" aria-label={label}>
      <img
        src={url}
        alt=""
        className={cn(
          "mushaf-surah-title-img block h-auto w-auto max-w-full object-contain object-center",
          className,
        )}
        draggable={false}
      />
    </div>
  );
}
