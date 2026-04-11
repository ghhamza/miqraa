// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { ConnectionStatus } from "./ConnectionStatus";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";
import type { NetworkQuality } from "../../hooks/useWebRTCConnection";

interface SessionTopBarProps {
  connectionStatus: SessionWsStatus;
  networkQuality?: NetworkQuality | null;
  surahLabel: string;
  sessionTitle: string;
  elapsedLabel: string;
  onLeave: () => void;
  /** Teacher only: ends session for everyone */
  showEndSession?: boolean;
  onEndSession?: () => void;
}

export function SessionTopBar({
  connectionStatus,
  networkQuality = null,
  surahLabel,
  sessionTitle,
  elapsedLabel,
  onLeave,
  showEndSession,
  onEndSession,
}: SessionTopBarProps) {
  const { t } = useTranslation();

  return (
    <header
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-[var(--color-surface)] px-3 py-2 sm:px-4"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
        <ConnectionStatus status={connectionStatus} networkQuality={networkQuality} />
        <span className="truncate text-sm font-medium text-[var(--color-text)]" title={surahLabel}>
          {surahLabel}
        </span>
        <span className="hidden text-sm text-[var(--color-text-muted)] sm:inline">·</span>
        <span className="max-w-[12rem] truncate text-sm text-[var(--color-text-muted)] sm:max-w-md">
          {sessionTitle}
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="tabular-nums text-xs text-[var(--color-text-muted)] sm:text-sm">
          <span className="sr-only">{t("liveSession.elapsed")}</span>
          {elapsedLabel}
        </span>
        {showEndSession && onEndSession ? (
          <Button type="button" variant="danger" size="sm" onClick={onEndSession}>
            {t("liveSession.endSession")}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onLeave}>
          {t("liveSession.leave")}
        </Button>
      </div>
    </header>
  );
}
