// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MushafPageTurnButtonsProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

/**
 * Mushaf is always read RTL: advancing in the book (higher page #) matches turning toward the
 * left. Left control = next page, right control = previous page.
 */
export function MushafPageTurnButtons({ page, totalPages, onPageChange }: MushafPageTurnButtonsProps) {
  const { t } = useTranslation();

  const btnClass =
    "rounded-xl border border-gray-200 bg-[var(--color-surface)] p-2 text-[var(--color-text)] shadow-sm hover:bg-gray-50 disabled:opacity-40";

  return (
    <>
      {/* md+: next (left) / previous (right) at viewport edges */}
      <div className="pointer-events-none fixed inset-x-0 top-1/2 z-20 hidden -translate-y-1/2 md:block">
        <div className="pointer-events-auto absolute left-3 sm:left-5">
          <button
            type="button"
            className={btnClass}
            aria-label={t("mushaf.nextPage")}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        </div>
        <div className="pointer-events-auto absolute right-3 sm:right-5">
          <button
            type="button"
            className={btnClass}
            aria-label={t("mushaf.prevPage")}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>

      {/* Small screens: same mapping — left = next, right = previous */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-gray-200 bg-[var(--color-surface)]/95 px-4 py-3 backdrop-blur-sm md:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          className={btnClass}
          aria-label={t("mushaf.nextPage")}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <button
          type="button"
          className={btnClass}
          aria-label={t("mushaf.prevPage")}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>
    </>
  );
}
