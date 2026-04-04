// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri
//
// Frame artwork: DigitalKhatt ayaframe (AGPL-3.0), https://digitalkhatt.org/

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const FRAME_SRC = "/mushaf/ayaframe-2CC7JSOP.svg";

/** Decorative banner frame with surah title text centered (RTL). */
export function MushafSurahTitleFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative mx-auto w-full max-w-full py-1", className)}>
      <img
        src={FRAME_SRC}
        alt=""
        className="pointer-events-none block h-auto w-full max-w-full select-none"
        draggable={false}
        aria-hidden
      />
      <span
        className="absolute inset-0 flex items-center justify-center px-[13%] text-center text-[0.82em] font-semibold leading-tight sm:px-[11%] sm:text-[0.88em]"
        style={{
          fontFamily: "var(--font-mushaf-title)",
          color: "#126183",
        }}
        dir="rtl"
      >
        {children}
      </span>
    </div>
  );
}
