// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useRef, useState } from "react";
import { getPageForAyah } from "../lib/quranService";
import type { Riwaya } from "../lib/quranService";

export interface MushafHighlightRange {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
}

export type MushafActiveWord = { surah: number; ayah: number; wordIndex: number };

export interface MushafInteractionState {
  highlightRange: MushafHighlightRange | null;
  activeWord: MushafActiveWord | null;
  currentPage: number;
  setHighlightRange: (range: MushafHighlightRange | null) => void;
  setActiveWord: (word: MushafActiveWord | null) => void;
  goToAyah: (surah: number, ayah: number) => void;
  goToPage: (page: number) => void;
  handleWordClick: (data: MushafActiveWord) => void;
  handleAyahClick: (data: { surah: number; ayah: number }) => void;
}

export interface UseMushafInteractionOptions {
  /** Page number (e.g. from URL) — single source of truth with `onPageChange` */
  initialPage: number;
  riwaya: Riwaya;
  onPageChange: (page: number) => void;
  onWordSelect?: (data: MushafActiveWord) => void;
  onAyahSelect?: (data: { surah: number; ayah: number }) => void;
}

/**
 * Shared Mushaf interaction state for the full reader and future live-session mini-viewer.
 * `currentPage` tracks `initialPage`; keep them in sync when the route changes.
 */
export function useMushafInteraction({
  initialPage,
  riwaya,
  onPageChange,
  onWordSelect,
  onAyahSelect,
}: UseMushafInteractionOptions): MushafInteractionState {
  const [highlightRange, setHighlightRange] = useState<MushafHighlightRange | null>(null);
  const [activeWord, setActiveWord] = useState<MushafActiveWord | null>(null);

  const currentPage = initialPage;

  const goToPage = useCallback(
    (page: number) => {
      onPageChange(page);
    },
    [onPageChange],
  );

  const goToAyah = useCallback(
    (surah: number, ayah: number) => {
      const p = getPageForAyah(surah, ayah, riwaya);
      onPageChange(p);
    },
    [riwaya, onPageChange],
  );

  const handleAyahClick = useCallback(
    (data: { surah: number; ayah: number }) => {
      setHighlightRange({ surah: data.surah, ayahStart: data.ayah, ayahEnd: data.ayah });
      onAyahSelect?.(data);
    },
    [onAyahSelect],
  );

  const handleWordClick = useCallback(
    (data: MushafActiveWord) => {
      setActiveWord(data);
      onWordSelect?.(data);
      handleAyahClick({ surah: data.surah, ayah: data.ayah });
    },
    [onWordSelect, handleAyahClick],
  );

  const pageRef = useRef(initialPage);
  pageRef.current = initialPage;

  /** When `highlightRange` changes (e.g. WebSocket), jump to that page — not when the user turns pages manually. */
  useEffect(() => {
    if (!highlightRange) return;
    const targetPage = getPageForAyah(highlightRange.surah, highlightRange.ayahStart, riwaya);
    if (targetPage !== pageRef.current) {
      onPageChange(targetPage);
    }
  }, [highlightRange, riwaya, onPageChange]);

  return {
    highlightRange,
    activeWord,
    currentPage,
    setHighlightRange,
    setActiveWord,
    goToAyah,
    goToPage,
    handleWordClick,
    handleAyahClick,
  };
}
