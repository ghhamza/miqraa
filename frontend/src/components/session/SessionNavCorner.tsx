// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SessionNavCornerProps {
  elapsedLabel: string;
  isTeacher: boolean;
  onEndSession?: () => void;
  surahLabel: string;
  juzLabel: string;
  pageLabel: string;
  ayahLabel: string;
  ayahNavDisabled?: boolean;
  onAyahPrev: () => void;
  onAyahNext: () => void;
}

export function SessionNavCorner({
  elapsedLabel,
  isTeacher,
  onEndSession,
  surahLabel,
  juzLabel,
  pageLabel,
  ayahLabel,
  ayahNavDisabled,
  onAyahPrev,
  onAyahNext,
}: SessionNavCornerProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute end-2 top-2 z-20 flex max-w-[min(100%,12rem)] flex-col items-end gap-1.5 sm:max-w-[min(100%,16rem)]">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] tabular-nums text-[#666] shadow-sm">
          {elapsedLabel}
        </span>
        {isTeacher && onEndSession ? (
          <button
            type="button"
            onClick={onEndSession}
            className="rounded-lg bg-[#EF5350] px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-[#E53935]"
          >
            {t("liveSession.endSession")}
          </button>
        ) : null}
      </div>

      <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
        <span
          className="max-w-[7rem] truncate rounded-md bg-white/90 px-2 py-0.5 text-[10px] text-[#2c5f7c] shadow-sm sm:max-w-[9rem]"
          title={surahLabel}
        >
          {surahLabel}
        </span>
        <span className="shrink-0 rounded-md bg-white/90 px-2 py-0.5 text-[10px] text-[#2c5f7c] shadow-sm">
          {juzLabel}
        </span>
        <span className="shrink-0 rounded-md bg-white/90 px-2 py-0.5 text-[10px] text-[#2c5f7c] shadow-sm">
          {pageLabel}
        </span>
      </div>

      {isTeacher ? (
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            disabled={ayahNavDisabled}
            onClick={onAyahPrev}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#555] shadow-sm transition hover:bg-white disabled:opacity-30"
            title={t("liveSession.prevAyah")}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <span className="max-w-[10rem] truncate rounded-md bg-white/90 px-2 py-0.5 text-center text-[9px] font-medium text-[#2c5f7c] shadow-sm">
            {ayahLabel}
          </span>
          <button
            type="button"
            disabled={ayahNavDisabled}
            onClick={onAyahNext}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#555] shadow-sm transition hover:bg-white disabled:opacity-30"
            title={t("liveSession.nextAyah")}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
