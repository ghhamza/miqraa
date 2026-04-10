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
  /** Opens surah / juz / page jump UI (bottom sheet). */
  onOpenJump?: () => void;
  /**
   * When false, no center jump button between edge chevrons; use when navigation is shown inline.
   * @default true
   */
  showDesktopJump?: boolean;
}

/**
 * Controls sit on top of the mushaf column (parent must be `relative`).
 * Inset positioning keeps them inside overflow-hidden ancestors (e.g. live session shell).
 * RTL book: physical left = next page, physical right = previous; chevrons point outward (‹ / ›).
 */
export function MushafPageTurnButtons({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  onOpenJump,
  showDesktopJump = true,
}: MushafPageTurnButtonsProps) {
  const { t } = useTranslation();

  const btnClass =
    "rounded-xl border border-gray-200 bg-[var(--color-surface)] p-2 text-[var(--color-text)] shadow-sm hover:bg-gray-50 disabled:opacity-40";
  const navDisabled = disabled;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <button
        type="button"
        className={cn(
          btnClass,
          "pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 shadow-md",
        )}
        aria-label={t("mushaf.nextPage")}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={navDisabled || page >= totalPages}
      >
        <ChevronLeft className="h-6 w-6" aria-hidden />
      </button>
      {onOpenJump && showDesktopJump ? (
        <button
          type="button"
          className={cn(
            btnClass,
            "pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-md",
          )}
          aria-label={t("mushaf.jumpOpen")}
          onClick={onOpenJump}
        >
          <ListTree className="h-6 w-6" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className={cn(
          btnClass,
          "pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 shadow-md",
        )}
        aria-label={t("mushaf.prevPage")}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={navDisabled || page <= 1}
      >
        <ChevronRight className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}
