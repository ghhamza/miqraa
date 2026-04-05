// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  /** Live session: offset mobile turn strip above session footer. */
  mobileBottomClassName?: string;
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
  mobileBottomClassName,
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
      /* Match RTL Mushaf: left = forward in book (next page), right = back. */
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
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-2">
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

      {/* Tablet / desktop: always-visible surah · juz · page (small screens use bottom sheet + jump). */}
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

      <div
        className="mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-1 flex-col px-3 sm:px-4 md:px-5 lg:px-6"
        aria-label="Mushaf content"
      >
        <MushafBookLayout page={page} riwaya={riwaya}>
          {children}
        </MushafBookLayout>
      </div>

      <MushafPageTurnButtons
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        disabled={navDisabled}
        mobileBottomClassName={mobileBottomClassName}
        onOpenJump={() => setJumpOpen(true)}
        showDesktopJump={false}
      />
    </div>
  );
}
