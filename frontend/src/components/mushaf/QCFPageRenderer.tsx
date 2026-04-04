// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuranPage } from "../../hooks/useQuranPage";
import { getPageFontFamily, loadPageFont, preloadAdjacentPages } from "../../lib/mushafFontLoader";
import { getSurah } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import type { LineData, WordData } from "../../hooks/useQuranPage";
import { Button } from "../ui/Button";
import { MushafBasmalahSvg } from "./MushafBasmalahSvg";
import { MushafSurahTitleFrame } from "./MushafSurahTitleFrame";

export interface QCFPageRendererProps {
  pageNumber: number;
  riwaya: Riwaya;
  onWordClick?: (data: { surah: number; ayah: number; wordIndex: number }) => void;
  onAyahClick?: (data: { surah: number; ayah: number }) => void;
  highlightRange?: { surah: number; ayahStart: number; ayahEnd: number } | null;
  activeWord?: { surah: number; ayah: number; wordIndex: number } | null;
}

function isHighlighted(
  word: WordData,
  range: { surah: number; ayahStart: number; ayahEnd: number } | null | undefined,
): boolean {
  if (!range) return false;
  if (word.surah !== range.surah) return false;
  return word.ayah >= range.ayahStart && word.ayah <= range.ayahEnd;
}

function isActiveWord(
  word: WordData,
  active: { surah: number; ayah: number; wordIndex: number } | null | undefined,
): boolean {
  if (!active) return false;
  return (
    word.surah === active.surah && word.ayah === active.ayah && word.wordPosition === active.wordIndex
  );
}

export function QCFPageRenderer({
  pageNumber,
  riwaya,
  onWordClick,
  onAyahClick,
  highlightRange,
  activeWord,
}: QCFPageRendererProps) {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useQuranPage(pageNumber, riwaya);
  const [fontReady, setFontReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSizePx, setFontSizePx] = useState(28);

  useEffect(() => {
    let cancelled = false;
    setFontReady(false);
    void (async () => {
      try {
        await loadPageFont(pageNumber);
        /* One frame after fonts are ready so the first paint uses QCF, not fallback metrics. */
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (!cancelled) setFontReady(true);
      } catch {
        if (!cancelled) setFontReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNumber]);

  useEffect(() => {
    if (!fontReady || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      const base = Math.max(12, Math.min(42, w / 14));
      setFontSizePx(base);
    });
    ro.observe(el);
    const w0 = el.clientWidth;
    setFontSizePx(Math.max(12, Math.min(42, w0 / 14)));
    return () => ro.disconnect();
  }, [fontReady, pageNumber]);

  useEffect(() => {
    if (fontReady) preloadAdjacentPages(pageNumber);
  }, [fontReady, pageNumber]);

  useEffect(() => {
    if (!highlightRange || !fontReady) return;
    requestAnimationFrame(() => {
      const firstHighlighted = containerRef.current?.querySelector(".mushaf-word--highlighted");
      if (firstHighlighted) {
        firstHighlighted.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [highlightRange, fontReady, pageNumber]);

  const handleWordClick = useCallback(
    (word: WordData) => {
      const payload = { surah: word.surah, ayah: word.ayah, wordIndex: word.wordPosition };
      onWordClick?.(payload);
      if (import.meta.env.DEV) {
        console.log("[mushaf word]", payload);
      }
      onAyahClick?.({ surah: word.surah, ayah: word.ayah });
    },
    [onWordClick, onAyahClick],
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-sm text-[var(--color-text-muted)]">
        <p>{t("mushaf.loadError")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
          {t("mushaf.retryLoad")}
        </Button>
      </div>
    );
  }

  if (loading || !data || !fontReady) {
    return (
      <div className="flex w-full flex-col gap-2 px-1 py-2" aria-busy="true">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="h-[1.15em] w-full animate-pulse rounded-sm bg-muted/60"
            style={{ lineHeight: 2 }}
          />
        ))}
        <span className="sr-only">{t("mushaf.loading")}</span>
      </div>
    );
  }

  const pageFont = getPageFontFamily(pageNumber);

  return (
    <div
      ref={containerRef}
      className="min-w-0 w-full text-[var(--color-text)]"
      style={{ fontSize: fontSizePx, lineHeight: 2.0 }}
    >
      {data.lines.map((line) => (
        <LineView
          key={line.lineNumber}
          line={line}
          pageFont={pageFont}
          highlightRange={highlightRange}
          activeWord={activeWord}
          onWordClick={handleWordClick}
        />
      ))}
    </div>
  );
}

function LineView({
  line,
  pageFont,
  highlightRange,
  activeWord,
  onWordClick,
}: {
  line: LineData;
  pageFont: string;
  highlightRange?: { surah: number; ayahStart: number; ayahEnd: number } | null;
  activeWord?: { surah: number; ayah: number; wordIndex: number } | null;
  onWordClick: (w: WordData) => void;
}) {
  if (line.lineType === "surah_name" && line.surahNumber != null) {
    const s = getSurah(line.surahNumber);
    const name = s?.nameAr ?? String(line.surahNumber);
    return (
      <div className="mushaf-line mushaf-line--centered py-1">
        <MushafSurahTitleFrame>
          سُورَةُ {name}
        </MushafSurahTitleFrame>
      </div>
    );
  }

  if (line.lineType === "basmallah") {
    return (
      <div className="mushaf-line mushaf-line--centered flex justify-center py-1">
        <MushafBasmalahSvg className="h-9 w-auto max-w-full text-[var(--mushaf-frame-teal)]" />
      </div>
    );
  }

  const hasWords = line.words.length > 0;
  if (!hasWords) {
    return <div className="mushaf-line mushaf-line--empty min-h-[1.1em]" dir="rtl" />;
  }

  const ayahRowClass = line.isCentered
    ? "mushaf-line mushaf-ayah-line mushaf-ayah-line--center"
    : "mushaf-line mushaf-ayah-line mushaf-ayah-line--justify";

  return (
    <div className={ayahRowClass} dir="rtl">
      {line.words.map((word) => (
        <span
          key={word.id}
          className={`mushaf-word ${isHighlighted(word, highlightRange) ? "mushaf-word--highlighted" : ""} ${
            isActiveWord(word, activeWord) ? "mushaf-word--active" : ""
          }`}
          style={{ fontFamily: pageFont }}
          data-surah={word.surah}
          data-ayah={word.ayah}
          data-word={word.wordPosition}
          onClick={() => onWordClick(word)}
        >
          {word.glyph}
        </span>
      ))}
    </div>
  );
}
