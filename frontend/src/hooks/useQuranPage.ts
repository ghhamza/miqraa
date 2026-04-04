// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { getSurahAyahAtPageStart } from "../lib/quranService";
import type { Riwaya } from "../lib/quranService";

export interface WordData {
  id: number;
  surah: number;
  ayah: number;
  wordPosition: number;
  glyph: string;
  charTypeName: string;
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
const PAGE_CACHE_VER = 3;
const PAGE_CACHE = new Map<string, PageData>();

function pageCacheKey(pageNumber: number): string {
  return `${PAGE_CACHE_VER}:${pageNumber}`;
}

/** Surahs that do not have a standalone basmalah line before the first verse (Al-Fatiha is special-cased in layout). */
function needsStandaloneBasmallahLine(surah: number): boolean {
  if (surah === 1) return false;
  if (surah === 9) return false;
  return true;
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
  /** Al-Fatiha on page 1 is printed with centered verse lines in the Madani Mushaf. */
  const fatihaCenteredAyah = pageNumber === 1 && getSurahAyahAtPageStart(pageNumber, riwaya)[0] === 1;

  type Slot = LineData | null;
  const grid: Slot[] = Array.from({ length: 15 }, () => null);

  // 1) Place ayah lines from API
  for (const lineNum of sortedLines) {
    const words = byLine.get(lineNum)!;
    grid[lineNum - 1] = {
      lineNumber: lineNum,
      lineType: "ayah",
      isCentered: fatihaCenteredAyah,
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

    if (needsStandaloneBasmallahLine(s) && gapLen >= 2) {
      grid[gapStart] = {
        lineNumber: gapStart + 1,
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
      minLine >= 3 &&
      needsStandaloneBasmallahLine(w.surah) &&
      w.ayah === 1 &&
      !(w.surah === 1 && minLine === 2);

    if (wantBasmallah) {
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
