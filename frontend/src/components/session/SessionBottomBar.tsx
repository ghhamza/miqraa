// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ReactNode } from "react";
import { Mic, MicOff, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";

interface SessionBottomBarProps {
  activeReciterName: string | null;
  canToggleMute: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenParticipants: () => void;
  /** Teacher-only next/prev ayah controls */
  ayahControls?: ReactNode;
}

export function SessionBottomBar({
  activeReciterName,
  canToggleMute,
  isMuted,
  onToggleMute,
  onOpenParticipants,
  ayahControls,
}: SessionBottomBarProps) {
  const { t } = useTranslation();

  return (
    <footer
      className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-[#FFFFFF] px-3 py-3 sm:px-4"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          disabled={!canToggleMute}
          onClick={onToggleMute}
          title={canToggleMute ? (isMuted ? t("liveSession.unmute") : t("liveSession.mute")) : t("liveSession.micDisabledHint")}
          className={`relative flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
            canToggleMute
              ? "cursor-pointer border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-muted/50"
              : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
          } ${!isMuted && canToggleMute ? "ring-2 ring-[#4CAF50]/40 ring-offset-2" : ""}`}
        >
          {isMuted ? (
            <MicOff className="size-5 text-[#EF5350]" aria-hidden />
          ) : (
            <Mic className="size-5 text-[#4CAF50]" aria-hidden />
          )}
        </button>
        {!canToggleMute && (
          <p className="hidden max-w-[14rem] text-xs text-[var(--color-text-muted)] sm:block">
            {t("liveSession.micDisabledHint")}
          </p>
        )}
        {ayahControls ? <div className="flex shrink-0 items-center">{ayahControls}</div> : null}
      </div>

      <div className="min-w-0 flex-1 text-center">
        <p className="text-xs text-[var(--color-text-muted)]">{t("liveSession.activeReciter")}</p>
        <p
          className="truncate text-sm font-semibold"
          style={{ color: activeReciterName ? "#D4A843" : "var(--color-text-muted)" }}
        >
          {activeReciterName ?? t("liveSession.noReciter")}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={onOpenParticipants}
        aria-label={t("liveSession.participants")}
      >
        <Users className="size-4" />
        <span className="hidden sm:inline">{t("liveSession.participants")}</span>
      </Button>
    </footer>
  );
}
