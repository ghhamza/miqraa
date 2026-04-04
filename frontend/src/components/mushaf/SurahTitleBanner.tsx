// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { parseSurahTitleLine } from "./surahTitleParse";

const FRAME_TEAL = "#1a5276";
const FRAME_TEAL_MID = "#2c5f7c";
const GOLD = "#D4A843";

interface SurahTitleBannerProps {
  /** Full line from mushaf text (سُورَةُ …). */
  line: string;
  /** Computed title size in px (matches body scale). */
  fontSizePx: number;
}

/**
 * King Fahd–inspired ornamental cartouche: teal frame, gold accents, Scheherazade New title.
 * HTML + webfont (DigitalKhatt canvas cannot load CSS fonts for the banner).
 */
export function SurahTitleBanner({ line, fontSizePx }: SurahTitleBannerProps) {
  const p = parseSurahTitleLine(line);
  if (!p) return null;

  const titleStyle = {
    fontFamily: "var(--font-mushaf-title)",
    fontSize: `${fontSizePx}px`,
    fontWeight: 700 as const,
    lineHeight: 1.45,
    color: FRAME_TEAL,
  };

  return (
    <div className="my-3 w-full min-w-0 px-0">
      <div className="relative w-full overflow-hidden rounded-md" style={{ color: FRAME_TEAL }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 400 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="surahBannerFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffffb" />
              <stop offset="100%" stopColor="#f5f0e4" />
            </linearGradient>
            <linearGradient id="surahGoldLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={`${GOLD}33`} />
              <stop offset="50%" stopColor={GOLD} />
              <stop offset="100%" stopColor={`${GOLD}33`} />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="398" height="46" rx="4" fill="url(#surahBannerFill)" stroke={FRAME_TEAL_MID} strokeWidth="2" />
          <rect x="6" y="6" width="388" height="36" rx="2" fill="none" stroke={FRAME_TEAL} strokeWidth="1" opacity="0.85" />
          <line x1="24" y1="10" x2="376" y2="10" stroke="url(#surahGoldLine)" strokeWidth="1.25" />
          <line x1="24" y1="38" x2="376" y2="38" stroke="url(#surahGoldLine)" strokeWidth="1" opacity="0.9" />
          {/* End caps */}
          <path d="M8 24 L14 18 L14 30 Z" fill={GOLD} opacity="0.55" />
          <path
            d="M392 24 L386 18 L386 30 Z"
            fill={GOLD}
            opacity="0.55"
          />
          {/* Small corner ticks */}
          <path
            d="M10 14 L16 14 L16 10"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.2"
          />
          <path
            d="M390 14 L384 14 L384 10"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.2"
          />
          <path
            d="M10 34 L16 34 L16 38"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.2"
          />
          <path
            d="M390 34 L384 34 L384 38"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.2"
          />
        </svg>

        <div
          className={`relative z-[1] flex w-full min-w-0 items-baseline gap-2 px-4 py-3 sm:px-6 sm:py-3.5 ${p.name ? "justify-between" : "justify-center"}`}
          dir="rtl"
          style={titleStyle}
        >
          <span className="shrink-0 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">{p.prefix}</span>
          {p.name ? (
            <span className="min-w-0 flex-1 text-left leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]" dir="rtl">
              {p.name}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function isSurahTitleLine(line: string): boolean {
  return line.trimStart().startsWith("سُورَةُ");
}
