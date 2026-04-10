// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ReactNode } from "react";
import type { Riwaya } from "../../lib/quranService";

/** Madina mushaf page proportion (width : height = 5 : 7). */
const MUSHAF_PAGE_ASPECT = "5 / 7" as const;

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
        boxSizing: "border-box",
        /* Fit inside mushaf-only container: width = min(column, 48rem, height×5/7) → strict 5:7 */
        width: "min(100cqi, min(48rem, calc(100cqh * 5 / 7)))",
        maxWidth: "100%",
        maxHeight: "100%",
        height: "auto",
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden px-4 py-3 sm:px-6 sm:py-4 md:px-7 md:py-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
