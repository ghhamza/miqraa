// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import type { HizbInfo, JuzInfo } from "../../lib/quranService";

function formatArabicIndic(n: number): string {
  return n.toLocaleString("ar-u-nu-arab");
}

interface MushafBookLayoutProps {
  page: number;
  runningSurahTitle: string;
  runningJuzNameAr: string;
  juzStart: JuzInfo | null;
  hizbStart: HizbInfo | null;
  children: React.ReactNode;
}

export function MushafBookLayout({
  page,
  runningSurahTitle,
  runningJuzNameAr,
  juzStart,
  hizbStart,
  children,
}: MushafBookLayoutProps) {
  const { t } = useTranslation();

  const juzLabel = juzStart != null ? juzStart.nameAr : runningJuzNameAr;
  const leftRunning =
    hizbStart != null
      ? `${juzLabel} · ${t("mushaf.hizb")} ${formatArabicIndic(hizbStart.number)}`
      : juzLabel;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-3 sm:px-4">
      <div className="mushaf-page-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="w-full min-w-0 pb-14 md:pb-0">
          <div className="mushaf-page-frame relative w-full min-w-0 rounded-sm bg-[#FDF6E3]">
            <span
              className="pointer-events-none absolute start-1 top-1 z-[1] h-2 w-2 rounded-tl-sm border-s-2 border-t-2 border-[#D4A843]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute end-1 top-1 z-[1] h-2 w-2 rounded-tr-sm border-e-2 border-t-2 border-[#D4A843]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-1 start-1 z-[1] h-2 w-2 rounded-bl-sm border-b-2 border-s-2 border-[#D4A843]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-1 end-1 z-[1] h-2 w-2 rounded-br-sm border-b-2 border-e-2 border-[#D4A843]"
              aria-hidden
            />

            <div
              className="m-1 rounded-sm border-2 border-[#2c5f7c] bg-[#f0e9d8]/40 p-[5px]"
              style={{ boxShadow: "inset 0 0 0 1px #1a5276" }}
            >
              <div className="flex min-h-0 flex-col rounded-sm bg-[#FDF6E3]">
                <div
                  className="flex shrink-0 items-center justify-between gap-2 px-2 pt-1 pb-0.5 text-[0.6rem] leading-tight sm:text-[0.65rem]"
                  dir="ltr"
                  style={{ fontFamily: "var(--font-quran)", color: "#2c5f7c" }}
                >
                  <span className="min-w-0 flex-1 truncate text-start font-medium">{leftRunning}</span>
                  <span className="min-w-0 flex-1 truncate text-end font-semibold">{runningSurahTitle}</span>
                </div>
                <div className="min-w-0">{children}</div>
                <div
                  className="shrink-0 pb-1 pt-1 text-center text-sm font-medium tabular-nums"
                  style={{ fontFamily: "var(--font-quran)", color: "#2c5f7c" }}
                  aria-label={t("mushaf.bookPageNumberAria", { n: page })}
                >
                  {formatArabicIndic(page)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
