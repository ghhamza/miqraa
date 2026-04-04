// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AyahControlsProps {
  disabled: boolean;
  onNext: () => void;
  onPrev: () => void;
}

/** Teacher-only next/previous ayah (RTL: left chevron = next in mushaf). */
export function AyahControls({ disabled, onNext, onPrev }: AyahControlsProps) {
  const { t } = useTranslation();
  const btnClass =
    "flex size-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={btnClass}
        disabled={disabled}
        onClick={onNext}
        aria-label={t("liveSession.nextAyah")}
        title={t("liveSession.nextAyah")}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        className={btnClass}
        disabled={disabled}
        onClick={onPrev}
        aria-label={t("liveSession.prevAyah")}
        title={t("liveSession.prevAyah")}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
