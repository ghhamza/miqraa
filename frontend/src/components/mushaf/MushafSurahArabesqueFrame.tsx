// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width horizontal rule: symmetric wave (Q + T reflects control points about x=160).
 * Bottom rule is the same SVG flipped on Y so top and bottom mirror exactly.
 */
function ArabesqueRule({ flip }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 320 14"
      preserveAspectRatio="none"
      className={cn("h-[8.8px] w-full shrink-0 text-[var(--mushaf-surah-title-color)]", flip && "-scale-y-100")}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M0 7 Q 80 2 160 7 T 320 7"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="nonScalingStroke"
        opacity={0.72}
      />
      <path
        d="M0 10 Q 80 5 160 10 T 320 10"
        stroke="currentColor"
        strokeWidth="0.45"
        strokeLinecap="round"
        vectorEffect="nonScalingStroke"
        opacity={0.38}
      />
    </svg>
  );
}

/**
 * Full-width minimalist arabesque frame around inline surah title artwork.
 * Symmetric waves; light side borders only (no corner accents).
 */
export function MushafSurahArabesqueFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full min-w-0", className)}>
      <ArabesqueRule />
      <div className="flex min-w-0 w-full justify-center border-x border-[var(--mushaf-surah-title-color)]/25 px-[0.6rem] py-[0.2rem] sm:px-[0.8rem]">
        {children}
      </div>
      <ArabesqueRule flip />
    </div>
  );
}
