// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MushafBookLayout } from "./MushafBookLayout";
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
  /** Live session: offset mobile turn strip above session footer. */
  mobileBottomClassName?: string;
  /** Live session / notches: offset mobile top strip from viewport top. */
  mobileTopClassName?: string;
  /** e.g. live session: `h-full min-h-0` so the reader fills the viewport. */
  className?: string;
  /** e.g. live session: mic / participants row, centered under the mushaf page (not viewport-fixed). */
  bottomAccessory?: ReactNode;
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
  mobileBottomClassName,
  mobileTopClassName,
  className,
  bottomAccessory,
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
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col",
            /* Space for fixed mobile turn strips */
            "max-md:pt-[calc(3.5rem+env(safe-area-inset-top))] max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]",
          )}
        >
          <MushafPageTurnButtons
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            disabled={navDisabled}
            mobileBottomClassName={mobileBottomClassName}
            mobileTopClassName={mobileTopClassName}
            onOpenJump={hideNavigation ? undefined : () => setJumpOpen(true)}
            showDesktopJump={!hideNavigation}
          />
          <div className="flex w-full max-w-full shrink-0 flex-col items-left justify-center gap-2">
              Quran Menu Navigation Zone
            </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center">
            <MushafBookLayout page={page} riwaya={riwaya}>
              {children}
            </MushafBookLayout>
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
