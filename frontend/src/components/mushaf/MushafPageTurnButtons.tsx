// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

interface MushafPageTurnButtonsProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  /** When true, prev/next controls do nothing (e.g. live session students). */
  disabled?: boolean;
  /**
   * Mobile fixed strip: offset from viewport bottom (e.g. live session footer stacked below).
   * Desktop edge chevrons are unchanged.
   */
  mobileBottomClassName?: string;
  /** Opens surah / juz / page jump UI (bottom sheet). */
  onOpenJump?: () => void;
  /**
   * When false, no center jump button between edge chevrons (md+); use when navigation is shown inline.
   * @default true
   */
  showDesktopJump?: boolean;
}

/**
 * Mushaf is always read RTL: advancing in the book (higher page #) matches turning toward the
 * left. Left control = next page, right control = previous page.
 */
export function MushafPageTurnButtons({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  mobileBottomClassName,
  onOpenJump,
  showDesktopJump = true,
}: MushafPageTurnButtonsProps) {
  const { t } = useTranslation();

  const btnClass =
    "rounded-xl border border-gray-200 bg-[var(--color-surface)] p-2 text-[var(--color-text)] shadow-sm hover:bg-gray-50 disabled:opacity-40";
  const navDisabled = disabled;

  return (
    <>
      {/* md+: next (left) / previous (right) at viewport edges */}
      <div className="pointer-events-none fixed inset-x-0 top-1/2 z-20 hidden -translate-y-1/2 md:block">
        <div className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2 sm:left-5">
          <button
            type="button"
            className={btnClass}
            aria-label={t("mushaf.nextPage")}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={navDisabled || page >= totalPages}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        </div>
        {onOpenJump && showDesktopJump ? (
          <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <button
              type="button"
              className={btnClass}
              aria-label={t("mushaf.jumpOpen")}
              onClick={onOpenJump}
            >
              <ListTree className="h-6 w-6" aria-hidden />
            </button>
          </div>
        ) : null}
        <div className="pointer-events-auto absolute right-3 top-1/2 -translate-y-1/2 sm:right-5">
          <button
            type="button"
            className={btnClass}
            aria-label={t("mushaf.prevPage")}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={navDisabled || page <= 1}
          >
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>

      {/* Small screens: same mapping — left = next, right = previous */}
      <div
        className={cn(
          "fixed inset-x-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-gray-200 bg-[var(--color-surface)]/95 px-4 py-3 backdrop-blur-sm md:hidden",
          mobileBottomClassName ?? "bottom-0",
        )}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-start">
          <button
            type="button"
            className={btnClass}
            aria-label={t("mushaf.nextPage")}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={navDisabled || page >= totalPages}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        </div>
        <div className="flex justify-center">
          {onOpenJump ? (
            <button
              type="button"
              className={btnClass}
              aria-label={t("mushaf.jumpOpen")}
              onClick={onOpenJump}
            >
              <ListTree className="h-6 w-6" aria-hidden />
            </button>
          ) : (
            <span className="w-px shrink-0" aria-hidden />
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className={btnClass}
            aria-label={t("mushaf.prevPage")}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={navDisabled || page <= 1}
          >
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}
