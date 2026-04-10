// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Riwaya } from "../../lib/quranService";

/** Madina mushaf page proportion (width : height = 5 : 7). */
const MUSHAF_PAGE_ASPECT = "5 / 7" as const;

/**
 * Width of the 5:7 page card inside a `[container-type:size]` mushaf column (shared with
 * {@link MushafReader} immersive chrome so headers align with page text).
 */
export const mushafPageCardWidthStyle: CSSProperties = {
  width: "min(100cqi, min(48rem, calc(100cqh * 5 / 7)))",
  maxWidth: "100%",
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
 * The page card only. Parent must be `[container-type:size]` with size = the area **below** any
 * menu chrome so 5:7 uses cqi/cqh for the mushaf column alone (not the navigation zone).
 */
export function MushafBookLayout({ children }: MushafBookLayoutProps) {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-3xl shrink-0 flex-col overflow-hidden "
      style={{
        aspectRatio: MUSHAF_PAGE_ASPECT,
        maxHeight: "100%",
        height: "auto",
        ...mushafPageCardWidthStyle,
      }}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden py-3 sm:py-4 md:py-4",
          MUSHAF_PAGE_INNER_PADDING_X,
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
