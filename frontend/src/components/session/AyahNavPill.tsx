// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AyahNavPillProps {
  label: string;
  pageLabel: string;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function AyahNavPill({ label, pageLabel, disabled, onPrev, onNext }: AyahNavPillProps) {
  const { i18n } = useTranslation();
  const rtl = i18n.language?.startsWith("ar");
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  return (
    <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5">
      <div className="flex min-w-0 max-w-full items-center gap-0.5 rounded-full bg-black/60 px-1 py-1 backdrop-blur-sm">
        <button
          type="button"
          disabled={disabled}
          onClick={onPrev}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <Prev className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-0 max-w-[12rem] truncate px-2 text-xs font-medium text-white sm:max-w-[16rem]">
          {label}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onNext}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <Next className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className="shrink-0 rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white/50 backdrop-blur-sm">
        {pageLabel}
      </span>
    </div>
  );
}
