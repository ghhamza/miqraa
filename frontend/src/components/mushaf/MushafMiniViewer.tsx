// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { getPageForAyah, getSurah, getSurahRangeOnPage, getTotalPages } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import { cn } from "@/lib/utils";
import { MushafCanvas } from "./MushafCanvas";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toArabicIndic(n: number): string {
  return String(n)
    .split("")
    .map((d) => AR_DIGITS[Number(d)] ?? d)
    .join("");
}

export interface MushafMiniViewerProps {
  currentAyah?: { surah: number; ayah: number } | null;
  riwaya?: Riwaya;
  interactive?: boolean;
  onAyahSelect?: (data: { surah: number; ayah: number }) => void;
  onWordSelect?: (data: { surah: number; ayah: number; wordIndex: number }) => void;
  className?: string;
}

/**
 * Compact Mushaf for live-session sidebars (~300–400px). No MushafBookLayout frame.
 * Not embedded on the main Mushaf route yet (live sessions / Part B).
 */
export function MushafMiniViewer({
  currentAyah = null,
  riwaya = "hafs",
  interactive = false,
  onAyahSelect,
  onWordSelect,
  className,
}: MushafMiniViewerProps) {
  const { t, i18n } = useTranslation();
  const totalPages = getTotalPages(riwaya);

  const [page, setPage] = useState(() =>
    currentAyah ? getPageForAyah(currentAyah.surah, currentAyah.ayah, riwaya) : 1,
  );
  const [autoFollow, setAutoFollow] = useState(true);
  const [activeWord, setActiveWord] = useState<{
    surah: number;
    ayah: number;
    wordIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!autoFollow || !currentAyah) return;
    const targetPage = getPageForAyah(currentAyah.surah, currentAyah.ayah, riwaya);
    setPage(targetPage);
  }, [currentAyah?.surah, currentAyah?.ayah, autoFollow, riwaya]);

  useEffect(() => {
    if (!interactive) setActiveWord(null);
  }, [interactive]);

  const highlightRange = currentAyah
    ? { surah: currentAyah.surah, ayahStart: currentAyah.ayah, ayahEnd: currentAyah.ayah }
    : null;

  const goNext = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const toggleAutoFollow = useCallback(() => {
    setAutoFollow((was) => {
      const next = !was;
      if (next && currentAyah) {
        setPage(getPageForAyah(currentAyah.surah, currentAyah.ayah, riwaya));
      }
      return next;
    });
  }, [currentAyah]);

  const handleWordClick = useCallback(
    (data: { surah: number; ayah: number; wordIndex: number }) => {
      setActiveWord(data);
      onWordSelect?.(data);
      onAyahSelect?.({ surah: data.surah, ayah: data.ayah });
    },
    [onWordSelect, onAyahSelect],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goPrev();
      }
    },
    [goNext, goPrev],
  );

  const { startSurah, endSurah } = getSurahRangeOnPage(page, riwaya);
  const surahStart = getSurah(startSurah);
  const surahEnd = getSurah(endSurah);
  const surahTitle =
    startSurah === endSurah
      ? surahStart
        ? `سورة ${surahStart.nameAr}`
        : ""
      : surahStart && surahEnd
        ? `سورة ${surahStart.nameAr} – سورة ${surahEnd.nameAr}`
        : "";

  const pageStr = i18n.language === "ar" ? toArabicIndic(page) : String(page);
  const totalStr = i18n.language === "ar" ? toArabicIndic(totalPages) : String(totalPages);

  const dir = i18n.dir();

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 shadow-sm",
        className,
      )}
      style={{ background: "#FDF6E3" }}
      dir={dir}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-1 border-b border-gray-200/80 px-3 py-1.5 text-xs"
        style={{ fontFamily: "var(--font-quran)", color: "#2c5f7c" }}
      >
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-[#2c5f7c] disabled:opacity-30"
          aria-label={t("mushaf.nextPage")}
          onClick={goNext}
          disabled={page >= totalPages}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate font-medium">{surahTitle}</div>
          <div className="text-[0.65rem] opacity-90">
            {t("mushaf.miniViewerPage", { page: pageStr, total: totalStr })}
          </div>
        </div>

        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-[#2c5f7c] disabled:opacity-30"
          aria-label={t("mushaf.prevPage")}
          onClick={goPrev}
          disabled={page <= 1}
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-2 py-1">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            !interactive && "pointer-events-none [&_.mushaf-word]:cursor-default",
          )}
        >
          <MushafCanvas
            page={page}
            riwaya={riwaya}
            highlightRange={highlightRange}
            activeWord={interactive ? activeWord : null}
            onWordClick={interactive ? handleWordClick : undefined}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-gray-200/80 px-2 py-1">
        <button
          type="button"
          onClick={toggleAutoFollow}
          className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[0.6rem] text-muted-foreground transition-colors hover:bg-black/5"
          aria-pressed={autoFollow}
          aria-label={autoFollow ? t("mushaf.autoFollowOn") : t("mushaf.autoFollowOff")}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: autoFollow ? "#1B5E20" : "#6B7280" }}
            aria-hidden
          />
          <span>{t("mushaf.autoFollow")}</span>
          {!autoFollow && <span className="text-[0.55rem] opacity-80">({t("mushaf.freeBrowse")})</span>}
        </button>
      </div>
    </div>
  );
}
