// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MushafBookLayout, MUSHAF_PAGE_INNER_PADDING_X, mushafPageCardWidthStyle } from "./MushafBookLayout";
import { MushafNavigation } from "./MushafNavigation";
import { MushafPageTurnButtons } from "./MushafPageTurnButtons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getPageForSurahStart, getTotalPages } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";

export interface MushafReaderProps {
  page: number;
  onPageChange: (p: number) => void;
  riwaya: Riwaya;
  /** When false, navigation, turn buttons, and arrow keys do not change the page. */
  canChangePage?: boolean;
  /** Live session immersive: hide surah/juz/page dropdowns; page chevrons stay. */
  hideNavigation?: boolean;
  /** e.g. live session: `h-full min-h-0` so the reader fills the viewport. */
  className?: string;
  /** e.g. live session: mic / participants row, centered under the mushaf page (not viewport-fixed). */
  bottomAccessory?: ReactNode;
  /** Strip above the mushaf page (e.g. surah/juz shortcuts). Omit to show the default placeholder. */
  menuNavigationZone?: ReactNode;
  /** Live session: menu strip is placed in page layout (top-middle); omit the internal nav block. */
  omitMenuStrip?: boolean;
  /**
   * Rendered inside the padded mushaf column, above page turn controls — aligns with the book column
   * (e.g. live session desktop: menu + surah row).
   */
  immersiveHeader?: ReactNode;
  children: ReactNode;
}

/**
 * Shared Mushaf shell: surah / juz / page navigation, book column, edge turn controls.
 * Used by {@link MushafPage} and live sessions so the reader is one component, not duplicated markup.
 */
export function MushafReader({
  page,
  onPageChange,
  riwaya,
  canChangePage = true,
  hideNavigation = false,
  className,
  bottomAccessory,
  menuNavigationZone,
  omitMenuStrip = false,
  immersiveHeader,
  children,
}: MushafReaderProps) {
  const { t } = useTranslation();
  const [jumpOpen, setJumpOpen] = useState(false);
  /** Last surah chosen via “go to surah”; shown in the select when that surah starts on `page` (mid-page starts vs first surah on page). */
  const [surahIntent, setSurahIntent] = useState<number | null>(null);
  const totalPages = getTotalPages(riwaya);
  const navDisabled = !canChangePage;

  useEffect(() => {
    if (surahIntent == null) return;
    const p = getPageForSurahStart(surahIntent, riwaya);
    if (p !== page) setSurahIntent(null);
  }, [page, riwaya, surahIntent]);

  useEffect(() => {
    if (!canChangePage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      /* RTL Mushaf: left arrow = advance in book (next page), right arrow = back (prev). Matches edge buttons. */
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPageChange(Math.min(totalPages, page + 1));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onPageChange(Math.max(1, page - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canChangePage, onPageChange, page, totalPages]);

  return (
    <div
      className={cn("relative flex min-h-0 w-full flex-1 flex-col gap-2", className)}
    >
      {!hideNavigation ? (
        <Sheet open={jumpOpen} onOpenChange={setJumpOpen}>
          <SheetContent side="bottom" className="max-h-[min(85dvh,32rem)] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetHeader className="text-start">
              <SheetTitle>{t("mushaf.jumpTitle")}</SheetTitle>
            </SheetHeader>
            <div className="px-1 pb-2">
              <MushafNavigation
                page={page}
                totalPages={totalPages}
                riwaya={riwaya}
                onPageChange={onPageChange}
                disabled={navDisabled}
                surahIntent={surahIntent}
                onSurahIntent={setSurahIntent}
                onAfterNavigate={() => setJumpOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {/* Tablet / desktop: always-visible surah · juz · page (small screens use bottom sheet + jump). */}
      {!hideNavigation ? (
        <div className="hidden w-full shrink-0 border-b border-gray-100 pb-2 md:block">
          <div className="mx-auto w-full min-w-0 max-w-4xl px-3 sm:px-4 md:px-5 lg:px-6">
            <MushafNavigation
              page={page}
              totalPages={totalPages}
              riwaya={riwaya}
              onPageChange={onPageChange}
              disabled={navDisabled}
              surahIntent={surahIntent}
              onSurahIntent={setSurahIntent}
            />
          </div>
        </div>
      ) : null}

      <div
        className="mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-1 flex-col px-3 sm:px-4 md:px-5 lg:px-6"
        aria-label="Mushaf content"
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <MushafPageTurnButtons
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            disabled={navDisabled}
            onOpenJump={hideNavigation ? undefined : () => setJumpOpen(true)}
            showDesktopJump={!hideNavigation}
          />
          {!omitMenuStrip ? (
            <nav
              className="flex w-full max-w-full shrink-0 flex-col items-stretch gap-2  py-2"
              aria-label={t("mushaf.menuNavigationZone")}
              data-testid="quran-menu-navigation-zone"
            >
              {menuNavigationZone !== undefined ? (
                menuNavigationZone
              ) : (
                <p className="text-center text-xs text-muted-foreground sm:text-sm">{t("mushaf.menuNavigationZone")}</p>
              )}
            </nav>
          ) : null}
          {/* cqi/cqh = mushaf column; immersive header uses same card width + text gutters as the page */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden [container-type:size]">
            {immersiveHeader ? (
              <div className="mx-auto w-full max-w-3xl shrink-0" style={mushafPageCardWidthStyle}>
                <div className={cn(MUSHAF_PAGE_INNER_PADDING_X, "pb-1 pt-0")}>{immersiveHeader}</div>
              </div>
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden">
              <MushafBookLayout page={page} riwaya={riwaya}>
                {children}
              </MushafBookLayout>
            </div>
          </div>
          {bottomAccessory ? (
            <div className="flex w-full max-w-full shrink-0 flex-col items-center justify-center gap-2 px-2">
              {bottomAccessory}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
