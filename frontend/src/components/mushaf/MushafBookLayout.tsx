// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Riwaya } from "../../lib/quranService";

/**
 * Max width of the reading column. The page flows naturally in height; no aspect-ratio lock.
 * On viewports narrower than this the card is viewport width minus small gutters.
 */
export const MUSHAF_PAGE_MAX_WIDTH = "48rem" as const;

export const mushafPageCardWidthStyle: CSSProperties = {
  width: "100%",
  maxWidth: MUSHAF_PAGE_MAX_WIDTH,
  boxSizing: "border-box",
};

/** Horizontal inset where verse text sits inside the card (must match inner wrapper below). */
export const MUSHAF_PAGE_INNER_PADDING_X = "px-4 sm:px-6 md:px-7";

export interface MushafBookLayoutProps {
  page: number;
  riwaya: Riwaya;
  children: ReactNode;
}

/**
 * The page card. Height is content-driven with a `min-height` so opening pages (Fatiha,
 * start of Baqarah) have vertical breathing room and can vertically center their short content.
 *
 * The card does NOT clip overflow. If content is taller than the viewport, the outer
 * app scroll handles it — same pattern as quran.com.
 */
export function MushafBookLayout({ children }: MushafBookLayoutProps) {
  return (
    <div
      data-mushaf-card=""
      className="mx-auto flex w-full flex-col min-h-[min(80vh,900px)] md:min-h-[min(64vh,820px)] lg:min-h-[min(68vh,860px)]"
      style={{
        ...mushafPageCardWidthStyle,
      }}
    >
      <div className={cn("flex w-full flex-1 flex-col py-1 sm:py-2 md:py-2", MUSHAF_PAGE_INNER_PADDING_X)}>
        <div className="flex w-full flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
