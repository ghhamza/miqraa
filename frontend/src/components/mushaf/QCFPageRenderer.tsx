// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
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
  /** Default until we read a real column width (avoid fontSize=12 when width was 0 → huge flex gaps). */
  const [fontSizePx, setFontSizePx] = useState(28);
  /** Last container width used to set font from ResizeObserver — ignore RO when only height changes (new page). */
  const lastObservedWidthForFontRef = useRef<number | null>(null);
  /** Reset width-based font on page navigation (avoid carrying over previous page’s vertical shrink). */
  const layoutPageRef = useRef<number | null>(null);

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

    const MIN_WIDTH_PX = 64;

    function computeFontSize(widthPx: number): number {
      /* Subpixel + padding: slightly conservative so justified QCF lines (flex, no shrink) stay in column */
      const w = Math.max(0, Math.floor(widthPx) - 2);
      if (w < MIN_WIDTH_PX) return -1;
      return Math.max(12, Math.min(48, w / 14.5));
    }

    function applyFontSizeIfWidthChanged(rawWidth: number): void {
      if (lastObservedWidthForFontRef.current != null && Math.abs(rawWidth - lastObservedWidthForFontRef.current) < 1) {
        return;
      }
      lastObservedWidthForFontRef.current = rawWidth;
      const next = computeFontSize(rawWidth);
      if (next < 0) return;
      setFontSizePx(next);
    }

    function measureFromEl(): void {
      applyFontSizeIfWidthChanged(el.clientWidth);
    }

    const ro = new ResizeObserver((entries) => {
      /* Read after layout; first frame often reports 0 in nested flex min-h-0 chains. */
      requestAnimationFrame(() => {
        const raw = entries[0]?.contentRect.width ?? el.clientWidth;
        applyFontSizeIfWidthChanged(raw);
      });
    });
    ro.observe(el);

    /* Double rAF: wait until parent flex layout has stable width (fixes flaky refresh). */
    requestAnimationFrame(() => {
      requestAnimationFrame(measureFromEl);
    });

    return () => ro.disconnect();
  }, [fontReady, pageNumber]);

  /** On page change: width-based font, then shrink until column fits height. */
  useLayoutEffect(() => {
    if (!fontReady || !data || !containerRef.current) return;
    if (data.pageNumber !== pageNumber) return;
    const el = containerRef.current;

    if (layoutPageRef.current !== pageNumber) {
      const w = Math.max(0, Math.floor(el.clientWidth) - 2);
      if (w < 64) return;
      const baseSize = Math.max(12, Math.min(48, w / 14.5));
      lastObservedWidthForFontRef.current = el.clientWidth;
      const nextPage = pageNumber;
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        flushSync(() => {
          layoutPageRef.current = nextPage;
          setFontSizePx(baseSize);
        });
      });
      return () => {
        cancelled = true;
      };
    }

    const h = el.clientHeight;
    const sh = el.scrollHeight;
    if (h <= 0 || sh <= h + 2) return;
    setFontSizePx((prev) => {
      const p = Number.isFinite(prev) ? prev : 28;
      if (p <= 12) return 12;
      const scaled = Math.floor(p * (h / sh));
      if (!Number.isFinite(scaled)) return p;
      return Math.max(12, scaled < p ? scaled : p - 1);
    });
  }, [fontReady, data, pageNumber, fontSizePx]);

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
      <div
        className="flex w-full flex-1 flex-col gap-1.5 px-1 py-2 min-h-0"
        aria-busy="true"
      >
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[6px] flex-1 basis-0 rounded-sm bg-muted/60 animate-pulse"
          />
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

  const safeFontPx = Math.min(48, Math.max(12, Number.isFinite(fontSizePx) ? fontSizePx : 28));

  if (centerInColumn) {
    const { head, body } = partitionOpeningHeadBody(data.lines);
    const bodyCenter = trimAyahLinesForCentering(body);
    return (
      <div
        ref={containerRef}
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden text-[var(--color-text)]"
        style={{ fontSize: safeFontPx, lineHeight: 1.65 }}
      >
        {head.length > 0 ? (
          <div className="w-full shrink-0">
            {head.map((line) => (
              <LineView key={line.lineNumber} line={line} {...lineProps} />
            ))}
          </div>
        ) : null}
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-center">
          {bodyCenter.map((line) => (
            <LineView key={line.lineNumber} line={line} {...lineProps} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-auto overflow-y-hidden text-[var(--color-text)]"
      style={{ fontSize: safeFontPx, lineHeight: 1.65 }}
    >
      {/* 15 QCF slots share height so the footer area doesn’t leave a dead band */}
      {data.lines.map((line) => (
        <div
          key={line.lineNumber}
          className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center"
        >
          <LineView line={line} {...lineProps} />
        </div>
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
