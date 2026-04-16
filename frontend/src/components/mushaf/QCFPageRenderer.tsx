// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuranPage } from "../../hooks/useQuranPage";
import { getPageFontFamily, loadPageFont, preloadAdjacentPages } from "../../lib/mushafFontLoader";
import { isMushafOpeningCenterPage } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import type { LineData, WordData } from "../../hooks/useQuranPage";
import { Button } from "../ui/Button";
import { MushafBasmalahSvg } from "./MushafBasmalahSvg";
import { SurahNameSvg } from "./SurahNameSvg";

export interface QCFPageRendererProps {
  pageNumber: number;
  riwaya: Riwaya;
  onWordClick?: (data: { surah: number; ayah: number; wordIndex: number; rect?: DOMRect }) => void;
  /** Live session student: preview annotations on hover (optional). */
  onWordMouseEnter?: (data: { surah: number; ayah: number; wordIndex: number; rect?: DOMRect }) => void;
  onWordMouseLeave?: (data: { surah: number; ayah: number; wordIndex: number }) => void;
  /** Optional: emits only for ayah-number marker hover. */
  onAyahMarkerMouseEnter?: (data: { surah: number; ayah: number; rect?: DOMRect }) => void;
  onAyahMarkerMouseLeave?: (data: { surah: number; ayah: number }) => void;
  onAyahClick?: (data: { surah: number; ayah: number }) => void;
  highlightRange?: { surah: number; ayahStart: number; ayahEnd: number } | null;
  activeWord?: { surah: number; ayah: number; wordIndex: number } | null;
  /** CSS class for words that have annotations (e.g. mushaf-word--error-jali) */
  getWordAnnotationClass?: (surah: number, ayah: number, wordPosition: number) => string;
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

/** Quran.com / QCF: verse-end glyphs (circle + number) use `char_type_name: end` — still clickable, not “word” text. */
function isVerseEndMarker(word: WordData): boolean {
  return word.charTypeName.toLowerCase() === "end";
}

/** Surah frame + basmalah stay at top; remaining lines are ayah rows (incl. empty grid slots). */
function partitionOpeningHeadBody(lines: LineData[]): { head: LineData[]; body: LineData[] } {
  let i = 0;
  while (i < lines.length && (lines[i].lineType === "surah_name" || lines[i].lineType === "basmallah")) {
    i++;
  }
  return { head: lines.slice(0, i), body: lines.slice(i) };
}

/** Vertically center only real ayah text — drop leading/trailing empty grid lines. */
function trimAyahLinesForCentering(body: LineData[]): LineData[] {
  const first = body.findIndex((l) => l.words.length > 0);
  if (first === -1) return body;
  let last = body.length - 1;
  while (last >= first && body[last].words.length === 0) last--;
  return body.slice(first, last + 1);
}

export function QCFPageRenderer({
  pageNumber,
  riwaya,
  onWordClick,
  onWordMouseEnter,
  onWordMouseLeave,
  onAyahMarkerMouseEnter,
  onAyahMarkerMouseLeave,
  onAyahClick,
  highlightRange,
  activeWord,
  getWordAnnotationClass,
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
        const pages = new Set<number>([pageNumber]);
        if (data?.lines && data.pageNumber === pageNumber) {
          for (const line of data.lines) {
            for (const w of line.words) {
              const p = w.glyphPageFont;
              if (typeof p === "number" && p >= 1 && p <= 604) pages.add(p);
            }
          }
        }
        await Promise.all([...pages].map((p) => loadPageFont(p)));
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
  }, [pageNumber, data]);

  useEffect(() => {
    if (!fontReady || !containerRef.current) return;
    const el = containerRef.current;
    const applyFromWidth = () => {
      const w = el.clientWidth;
      if (w < 64) return;
      // Divisor tuned empirically so the widest QCF line (15 words, full-justified) fits with
      // ~3% slack. Clamp: mobile minimum legibility (16px) through desktop cap (34px - beyond
      // this the line height and letter size make the page feel oversized).
      const next = Math.max(16, Math.min(34, (w - 2) / 16));
      setFontSizePx((prev) => (Math.abs(prev - next) < 0.25 ? prev : next));
    };

    const ro = new ResizeObserver(() => {
      /* Double rAF so CSS has committed the new card width before we read it. */
      requestAnimationFrame(() => requestAnimationFrame(applyFromWidth));
    });
    ro.observe(el);

    /* Prime once in case the element was already at its final width at effect-setup time. */
    requestAnimationFrame(() => requestAnimationFrame(applyFromWidth));

    return () => ro.disconnect();
  }, [fontReady]);

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
    (word: WordData, e: MouseEvent<HTMLSpanElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      onWordClick?.({ surah: word.surah, ayah: word.ayah, wordIndex: word.wordPosition, rect });
      onAyahClick?.({ surah: word.surah, ayah: word.ayah });
    },
    [onWordClick, onAyahClick],
  );

  const handleWordMouseEnter = useCallback(
    (word: WordData, e: MouseEvent<HTMLSpanElement>) => {
      if (!onWordMouseEnter) return;
      const rect = e.currentTarget.getBoundingClientRect();
      onWordMouseEnter({
        surah: word.surah,
        ayah: word.ayah,
        wordIndex: word.wordPosition,
        rect,
      });
    },
    [onWordMouseEnter],
  );

  const handleWordMouseLeave = useCallback(
    (word: WordData) => {
      onWordMouseLeave?.({
        surah: word.surah,
        ayah: word.ayah,
        wordIndex: word.wordPosition,
      });
    },
    [onWordMouseLeave],
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
      <div className="flex w-full flex-col gap-3 py-6" aria-busy="true">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="h-5 w-full rounded-sm bg-muted/60 animate-pulse" />
        ))}
        <span className="sr-only">{t("mushaf.loading")}</span>
      </div>
    );
  }

  const centerInColumn = isMushafOpeningCenterPage(pageNumber, riwaya);

  const lineProps = {
    mushafPageNumber: pageNumber,
    highlightRange,
    activeWord,
    getWordAnnotationClass,
    onWordClick: handleWordClick,
    onWordMouseEnter: onWordMouseEnter ? handleWordMouseEnter : undefined,
    onWordMouseLeave: onWordMouseLeave ? handleWordMouseLeave : undefined,
    onAyahMarkerMouseEnter,
    onAyahMarkerMouseLeave,
  };

  const safeFontPx = Math.min(34, Math.max(16, Number.isFinite(fontSizePx) ? fontSizePx : 28));

  if (centerInColumn) {
    const { head, body } = partitionOpeningHeadBody(data.lines);
    const bodyCenter = trimAyahLinesForCentering(body);
    const centeredLines = [...head, ...bodyCenter];
    return (
      <div
        ref={containerRef}
        className="flex w-full flex-1 flex-col justify-center text-[var(--color-text)]"
        style={{ fontSize: safeFontPx, lineHeight: 1.65 }}
      >
        {centeredLines.map((line) => (
          <LineView key={line.lineNumber} line={line} {...lineProps} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full flex-col text-[var(--color-text)]"
      style={{ fontSize: safeFontPx, lineHeight: 1.65 }}
    >
      {data.lines.map((line) => (
        <LineView key={line.lineNumber} line={line} {...lineProps} />
      ))}
    </div>
  );
}

function LineView({
  line,
  mushafPageNumber,
  highlightRange,
  activeWord,
  getWordAnnotationClass,
  onWordClick,
  onWordMouseEnter,
  onWordMouseLeave,
  onAyahMarkerMouseEnter,
  onAyahMarkerMouseLeave,
}: {
  line: LineData;
  mushafPageNumber: number;
  highlightRange?: { surah: number; ayahStart: number; ayahEnd: number } | null;
  activeWord?: { surah: number; ayah: number; wordIndex: number } | null;
  getWordAnnotationClass?: (surah: number, ayah: number, wordPosition: number) => string;
  onWordClick: (w: WordData, e: MouseEvent<HTMLSpanElement>) => void;
  onWordMouseEnter?: (w: WordData, e: MouseEvent<HTMLSpanElement>) => void;
  onWordMouseLeave?: (w: WordData) => void;
  onAyahMarkerMouseEnter?: (data: { surah: number; ayah: number; rect?: DOMRect }) => void;
  onAyahMarkerMouseLeave?: (data: { surah: number; ayah: number }) => void;
}) {
  if (line.lineType === "surah_name" && line.surahNumber != null) {
    const sn = line.surahNumber;
    return (
      <div className="mushaf-line mushaf-line--centered flex justify-center w-full py-[0.2rem]">
        <SurahNameSvg surah={sn} className="h-[calc(2.5em*2/3*0.8)] w-auto max-w-full" />
      </div>
    );
  }

  if (line.lineType === "basmallah") {
    return (
      <div className="mushaf-line mushaf-line--centered flex justify-center py-1">
        <MushafBasmalahSvg className="h-9 w-auto max-w-full text-[var(--color-text)]" />
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
      {line.words.map((word) => {
        const annotationClass = getWordAnnotationClass?.(word.surah, word.ayah, word.wordPosition) ?? "";
        return (
          <span
            key={word.id}
            className={`mushaf-word ${isVerseEndMarker(word) ? "mushaf-word--ayah-marker" : ""} ${
              isHighlighted(word, highlightRange) ? "mushaf-word--highlighted" : ""
            } ${isActiveWord(word, activeWord) ? "mushaf-word--active" : ""} ${annotationClass}`}
            style={{ fontFamily: getPageFontFamily(word.glyphPageFont ?? mushafPageNumber) }}
            data-surah={word.surah}
            data-ayah={word.ayah}
            data-word={word.wordPosition}
            onClick={(e) => onWordClick(word, e)}
            onMouseEnter={(e) => {
              onWordMouseEnter?.(word, e);
              if (isVerseEndMarker(word)) {
                onAyahMarkerMouseEnter?.({
                  surah: word.surah,
                  ayah: word.ayah,
                  rect: e.currentTarget.getBoundingClientRect(),
                });
              }
            }}
            onMouseLeave={() => {
              onWordMouseLeave?.(word);
              if (isVerseEndMarker(word)) {
                onAyahMarkerMouseLeave?.({ surah: word.surah, ayah: word.ayah });
              }
            }}
          >
            {word.glyph}
          </span>
        );
      })}
    </div>
  );
}
