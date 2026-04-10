// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ReactNode } from "react";
import type { Riwaya } from "../../lib/quranService";

/** Madina mushaf page proportion (width:height = 5:7). */
const MUSHAF_PAGE_ASPECT = "5 / 7" as const;
const MUSHAF_PAGE_W_H = 5 / 7;

export interface MushafBookLayoutProps {
  page: number;
  riwaya: Riwaya;
  children: ReactNode;
}

export function MushafBookLayout({ children }: MushafBookLayoutProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden [container-type:size]">
      <div
        className="mx-auto flex min-h-0 w-full max-w-3xl shrink-0 flex-col overflow-hidden bg-red-100"
        style={{
          aspectRatio: MUSHAF_PAGE_ASPECT,
          maxHeight: "100%",
          /* Fit when height is the limiting axis (short viewports): width scales with container height. */
          width: `min(100%, min(48rem, calc(100cqh * ${MUSHAF_PAGE_W_H})))`,
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden px-4 py-3 sm:px-6 sm:py-4 md:px-7 md:py-4">
          {/* Stretch mushaf content / loading skeleton to full page column height */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}
