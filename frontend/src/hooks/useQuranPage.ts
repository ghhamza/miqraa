// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { getPageForSurahStart, getSurahAyahAtPageStart } from "../lib/quranService";
import type { Riwaya } from "../lib/quranService";

export interface WordData {
  id: number;
  surah: number;
  ayah: number;
  wordPosition: number;
  glyph: string;
  charTypeName: string;
  /** Which Mushaf page’s QCF woff2 contains this glyph (PUA); may differ from the page being viewed. */
  glyphPageFont: number;
}

export interface LineData {
  lineNumber: number;
  lineType: "ayah" | "surah_name" | "basmallah";
  isCentered: boolean;
  surahNumber: number | null;
  words: WordData[];
}

export interface PageData {
  pageNumber: number;
  lines: LineData[];
}

interface ApiWord {
  id: number;
  position: number;
  char_type_name: string;
  code_v2?: string;
  code_v1?: string;
  line_number: number;
  /** Mushaf page font that owns this glyph (QCF PUA is per-page). */
  page_number: number;
}

interface ApiVerse {
  verse_key: string;
  words?: ApiWord[];
}

interface ApiResponse {
  verses: ApiVerse[];
}

/** Bump when layout rules change so cached pages refetch. */
const PAGE_CACHE_VER = 9;
const PAGE_CACHE = new Map<string, PageData>();

/** Madani mushaf page count (Hafs 604 lines). */
const MUSHAF_PAGE_COUNT = 604;

function pageCacheKey(pageNumber: number): string {
  return `${PAGE_CACHE_VER}:${pageNumber}`;
}

/** Standalone basmalah before the surah body: every surah except At-Tawbah (9), which has none in the Mushaf. */
function needsStandaloneBasmallahLine(surah: number): boolean {
  return surah !== 9;
}

function parseGlyph(w: ApiWord): string {
  const g = w.code_v2 ?? w.code_v1;
  return g ?? "";
}

function emptyAyahLine(lineNumber: number, centered = false): LineData {
  return {
    lineNumber,
    lineType: "ayah",
    isCentered: centered,
    surahNumber: null,
    words: [],
  };
}

function buildPageData(pageNumber: number, verses: ApiVerse[], riwaya: Riwaya): PageData {
  const byLine = new Map<number, WordData[]>();
  let minLine = 0;

  for (const verse of verses) {
    const [s, a] = verse.verse_key.split(":").map(Number) as [number, number];
    for (const w of verse.words ?? []) {
      const glyph = parseGlyph(w);
      if (!glyph) continue;
      const lineNum = w.line_number;
      if (minLine === 0 || lineNum < minLine) minLine = lineNum;
      const wd: WordData = {
        id: w.id,
        surah: s,
        ayah: a,
        wordPosition: w.position,
        glyph,
        charTypeName: w.char_type_name,
        glyphPageFont: typeof w.page_number === "number" ? w.page_number : pageNumber,
      };
      const list = byLine.get(lineNum) ?? [];
      list.push(wd);
      byLine.set(lineNum, list);
    }
  }

  for (const [, list] of byLine) {
    list.sort((a, b) => {
      if (a.ayah !== b.ayah) return a.ayah - b.ayah;
      if (a.wordPosition !== b.wordPosition) return a.wordPosition - b.wordPosition;
      return a.id - b.id;
    });
  }

  if (minLine === 0) minLine = 1;

  const sortedLines = [...byLine.keys()].sort((a, b) => a - b);
  const [pageStartSurah, pageStartAyah] = getSurahAyahAtPageStart(pageNumber, riwaya);
  /**
   * Opening pages of Al-Fatiha and Al-Baqarah use centered verse lines in the printed Madani Mushaf
   * (same “shape” as the first page — not full-width justified blocks).
   */
  const madaniCenteredAyahLines =
    (pageNumber === getPageForSurahStart(1, riwaya) && pageStartSurah === 1) ||
    (pageNumber === getPageForSurahStart(2, riwaya) && pageStartSurah === 2 && pageStartAyah === 1);

  type Slot = LineData | null;
  const grid: Slot[] = Array.from({ length: 15 }, () => null);

  const rowHasAyahWords = (cell: Slot): boolean =>
    cell != null &&
    cell.lineType === "ayah" &&
    cell.words.some((w) => w.charTypeName.toLowerCase() !== "end");

  // 1) Place ayah lines from API
  for (const lineNum of sortedLines) {
    const words = byLine.get(lineNum)!;
    grid[lineNum - 1] = {
      lineNumber: lineNum,
      lineType: "ayah",
      isCentered: madaniCenteredAyahLines,
      surahNumber: null,
      words,
    };
  }

  // 2) Mid-page: gap between API lines where a new surah starts at ayah 1
  for (let i = 0; i < sortedLines.length - 1; i++) {
    const prevL = sortedLines[i];
    const nextL = sortedLines[i + 1];
    if (nextL <= prevL + 1) continue;

    const prevWords = byLine.get(prevL)!;
    const nextWords = byLine.get(nextL)!;
    const prevSurah = prevWords[0].surah;
    const nw = nextWords[0];
    if (nw.ayah !== 1 || nw.surah === prevSurah) continue;

    const gapStart = prevL + 1;
    const gapEnd = nextL - 1;
    const gapLen = gapEnd - gapStart + 1;
    const s = nw.surah;

    grid[gapStart - 1] = {
      lineNumber: gapStart,
      lineType: "surah_name",
      isCentered: true,
      surahNumber: s,
      words: [],
    };

    if (!needsStandaloneBasmallahLine(s)) continue;

    if (gapLen >= 2) {
      grid[gapStart] = {
        lineNumber: gapStart + 1,
        lineType: "basmallah",
        isCentered: true,
        surahNumber: null,
        words: [],
      };
    } else if (gapLen === 1) {
      // Only one free line (surah title); shift the new surah’s ayah block down to fit basmalah.
      const firstAyahIdx = nextL - 1;
      for (let j = 13; j >= firstAyahIdx; j--) {
        const cell = grid[j];
        if (cell) {
          grid[j + 1] = { ...cell, lineNumber: j + 2 };
        } else {
          grid[j + 1] = null;
        }
      }
      grid[firstAyahIdx] = {
        lineNumber: firstAyahIdx + 1,
        lineType: "basmallah",
        isCentered: true,
        surahNumber: null,
        words: [],
      };
    }
  }

  // 3) Top of page: lines before first API line (surah opens on this page)
  if (minLine > 1) {
    const w = byLine.get(minLine)![0];
    grid[0] = {
      lineNumber: 1,
      lineType: "surah_name",
      isCentered: true,
      surahNumber: w.surah,
      words: [],
    };

    const wantBasmallah =
      minLine >= 2 && needsStandaloneBasmallahLine(w.surah) && w.ayah === 1;

    if (wantBasmallah) {
      if (minLine >= 3) {
        grid[1] = {
          lineNumber: 2,
          lineType: "basmallah",
          isCentered: true,
          surahNumber: null,
          words: [],
        };
      } else if (minLine === 2) {
        // First ayah is on QCF line 2 with line 1 empty: surah fits on line 1 but we need
        // one more row for basmalah — shift ayah rows down by one (matches printed Mushaf).
        for (let i = 13; i >= 1; i--) {
          const cell = grid[i];
          if (cell) {
            grid[i + 1] = { ...cell, lineNumber: i + 2 };
          } else {
            grid[i + 1] = null;
          }
        }
        grid[1] = {
          lineNumber: 2,
          lineType: "basmallah",
          isCentered: true,
          surahNumber: null,
          words: [],
        };
      }
    }
  }

  // 4) Surah begins on QCF line 1 (no empty lines above first ayah): insert surah + basmalah
  // when the page itself starts at ayah 1 of that surah. Shift ayah rows down by two only if the
  // last two grid rows have no verse text (otherwise we would truncate the page).
  if (minLine === 1) {
    const w = byLine.get(1)![0];
    const [pageStartSurah, pageStartAyah] = getSurahAyahAtPageStart(pageNumber, riwaya);
    const pageStartsAtSurahAyah1 =
      w.surah === pageStartSurah && w.ayah === pageStartAyah && pageStartAyah === 1;
    const wantBasmallah = pageStartsAtSurahAyah1 && needsStandaloneBasmallahLine(w.surah);
    const canShiftTwoLines = !rowHasAyahWords(grid[13]) && !rowHasAyahWords(grid[14]);

    if (wantBasmallah && canShiftTwoLines) {
      for (let i = 12; i >= 0; i--) {
        const cell = grid[i];
        if (cell) {
          grid[i + 2] = { ...cell, lineNumber: i + 3 };
        } else {
          grid[i + 2] = null;
        }
      }
      grid[0] = {
        lineNumber: 1,
        lineType: "surah_name",
        isCentered: true,
        surahNumber: w.surah,
        words: [],
      };
      grid[1] = {
        lineNumber: 2,
        lineType: "basmallah",
        isCentered: true,
        surahNumber: null,
        words: [],
      };
    }
  }

  const lines: LineData[] = [];
  for (let i = 0; i < 15; i++) {
    const ln = i + 1;
    const cell = grid[i];
    if (cell) {
      lines.push(cell);
    } else {
      lines.push(emptyAyahLine(ln, false));
    }
  }

  /* Only 1–2 real words per line: avoid huge space-between gaps; 3+ words stay fully justified */
  const SHORT_LINE_MAX_WORDS = 2;
  for (const line of lines) {
    if (line.lineType !== "ayah") continue;
    const realWordCount = line.words.filter((w) => w.charTypeName.toLowerCase() !== "end").length;
    if (realWordCount > 0 && realWordCount <= SHORT_LINE_MAX_WORDS && !line.isCentered) {
      line.isCentered = true;
    }
  }

  return { pageNumber, lines };
}

async function fetchPage(pageNumber: number, riwaya: Riwaya): Promise<PageData> {
  const key = pageCacheKey(pageNumber);
  const cached = PAGE_CACHE.get(key);
  if (cached) return cached;

  const url = `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&word_fields=code_v2,code_v1,char_type_name,line_number,page_number,position`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as ApiResponse;
  const built = buildPageData(pageNumber, data.verses ?? [], riwaya);
  PAGE_CACHE.set(key, built);
  return built;
}

/**
 * Warm `PAGE_CACHE` for pages around the current one (default ±2) so navigation feels instant
 * after the first visit. Fire-and-forget; failures are ignored.
 */
export function prefetchAdjacentPageData(pageNumber: number, riwaya: Riwaya, radius = 2): void {
  for (let d = 1; d <= radius; d++) {
    const before = pageNumber - d;
    const after = pageNumber + d;
    if (before >= 1) void fetchPage(before, riwaya).catch(() => {});
    if (after <= MUSHAF_PAGE_COUNT) void fetchPage(after, riwaya).catch(() => {});
  }
}

export function useQuranPage(pageNumber: number, riwaya: Riwaya): {
  data: PageData | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
} {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoading(true);
    setError(null);
    prefetchAdjacentPageData(pageNumber, riwaya, 2);
    void fetchPage(pageNumber, riwaya)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageNumber, riwaya, token]);

  const reload = () => {
    PAGE_CACHE.delete(pageCacheKey(pageNumber));
    setToken((t) => t + 1);
  };

  return { data, loading, error, reload };
}
