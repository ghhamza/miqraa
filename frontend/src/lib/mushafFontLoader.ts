// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

const loadedFonts = new Set<number>();

/** Matches Quran Foundation CDN paths and `FontFace` names (e.g. `p510-v2`). */
const HAFS_QCF_VERSION = "v2";

/**
 * Load the QCF V2 font for a page and wait until the browser can actually use it for layout.
 * Without `document.fonts.load` + `ready`, a full refresh often paints PUA glyphs with a fallback
 * font for one frame (thin “wrong” Arabic) before the page font applies.
 */
export async function loadPageFont(pageNumber: number): Promise<void> {
  const fontName = `p${pageNumber}-${HAFS_QCF_VERSION}`;
  const fontUrl = `https://verses.quran.foundation/fonts/quran/hafs/${HAFS_QCF_VERSION}/woff2/p${pageNumber}.woff2`;

  if (!loadedFonts.has(pageNumber)) {
    /* `block` avoids swapping to fallback during load (glyphs would render as garbage). */
    const font = new FontFace(fontName, `url('${fontUrl}')`, { display: "block" });
    await font.load();
    document.fonts.add(font);
    loadedFonts.add(pageNumber);
  }

  try {
    await document.fonts.load(`1em "${fontName}"`);
  } catch {
    /* Some engines are picky; `ready` still helps */
  }
  await document.fonts.ready;
}

const MUSHAF_PAGE_COUNT = 604;

/** Preload fonts for nearby pages (default ±2) so flipping pages stays smooth. */
export function preloadAdjacentPages(currentPage: number, radius = 2): void {
  for (let d = 1; d <= radius; d++) {
    if (currentPage - d >= 1) void loadPageFont(currentPage - d);
    if (currentPage + d <= MUSHAF_PAGE_COUNT) void loadPageFont(currentPage + d);
  }
}

/** Must match the `FontFace` name in `loadPageFont` (no CSS quote characters in the string). */
export function getPageFontFamily(pageNumber: number): string {
  return `p${pageNumber}-${HAFS_QCF_VERSION}`;
}
