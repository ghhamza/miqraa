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

/** Word tap payload from QCF (includes optional bounding rect for popovers). */
export type MushafWordClickData = MushafActiveWord & { rect?: DOMRect };

export interface MushafInteractionState {
  highlightRange: MushafHighlightRange | null;
  activeWord: MushafActiveWord | null;
  currentPage: number;
  setHighlightRange: (range: MushafHighlightRange | null) => void;
  setActiveWord: (word: MushafActiveWord | null) => void;
  goToAyah: (surah: number, ayah: number) => void;
  goToPage: (page: number) => void;
  handleWordClick: (data: MushafWordClickData) => void;
  handleAyahClick: (data: { surah: number; ayah: number }) => void;
}

export interface UseMushafInteractionOptions {
  /** Page number (e.g. from URL) — single source of truth with `onPageChange` */
  initialPage: number;
  riwaya: Riwaya;
  onPageChange: (page: number) => void;
  onWordSelect?: (data: MushafWordClickData) => void;
  onAyahSelect?: (data: { surah: number; ayah: number }) => void;
  /**
   * When true (default), moving the highlight to an ayah on another page updates the page.
   * Live-session students should set false so only the teacher-driven page is shown.
   */
  followHighlightPage?: boolean;
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
  followHighlightPage = true,
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
    (data: MushafWordClickData) => {
      setActiveWord({ surah: data.surah, ayah: data.ayah, wordIndex: data.wordIndex });
      onWordSelect?.(data);
      handleAyahClick({ surah: data.surah, ayah: data.ayah });
    },
    [onWordSelect, handleAyahClick],
  );

  const pageRef = useRef(initialPage);
  pageRef.current = initialPage;

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  /** Semantic ayah for highlight — use primitives so new object identity from WS sync does not retrigger. */
  const hlSurah = highlightRange?.surah;
  const hlAyahStart = highlightRange?.ayahStart;

  /** When the selected ayah changes, optionally jump to its page. Omit `onPageChange` from deps (often unstable). */
  useEffect(() => {
    if (!followHighlightPage || hlSurah == null || hlAyahStart == null) return;
    const targetPage = getPageForAyah(hlSurah, hlAyahStart, riwaya);
    if (targetPage !== pageRef.current) {
      onPageChangeRef.current(targetPage);
    }
  }, [followHighlightPage, hlSurah, hlAyahStart, riwaya]);

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
