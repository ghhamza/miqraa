// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Mic, MicOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";
import type { LivekitConnectionStatus } from "../../hooks/useLivekitConnection";
import { ConnectionStatus } from "./ConnectionStatus";

interface SessionStatusCornerProps {
  wsStatus: SessionWsStatus;
  livekitStatus: LivekitConnectionStatus;
  /** Elapsed time label (MM:SS). */
  elapsedLabel: string;
  /**
   * Mic state.
   * - `publishing`: user is a publisher and mic is on -> green mic icon
   * - `muted`: user is a publisher and mic is off -> gray mic-off icon
   * - `listener`: user has no publish grant -> mic indicator hidden entirely
   */
  micState: "publishing" | "muted" | "listener";
}

/**
 * Compact icon-only status cluster for the top of the session page.
 * Shows:
 *   - WebSocket (signaling) status dot
 *   - LiveKit audio status dot
 *   - Mic indicator (only for publishers)
 *   - Elapsed timer
 *
 * All icons have title + aria-label; no visible text labels.
 */
export function SessionStatusCorner({
  wsStatus,
  livekitStatus,
  elapsedLabel,
  micState,
}: SessionStatusCornerProps) {
  const { t } = useTranslation();

  const micLabel =
    micState === "publishing"
      ? t("liveSession.micStatus.on")
      : micState === "muted"
        ? t("liveSession.micStatus.off")
        : "";

  return (
    <div className="relative z-0 flex w-full max-w-full flex-wrap items-center gap-2">
      <ConnectionStatus status={wsStatus} livekitStatus={livekitStatus} iconsOnly />

      {micState !== "listener" && (
        <span
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-sm"
          title={micLabel}
          aria-label={micLabel}
        >
          {micState === "publishing" ? (
            <Mic className="size-3 text-[#1B5E20]" strokeWidth={2.5} aria-hidden />
          ) : (
            <MicOff className="size-3 text-[#6B7280]" strokeWidth={2.5} aria-hidden />
          )}
        </span>
      )}

      <span
        className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] tabular-nums text-[#666] shadow-sm"
        title={t("liveSession.elapsed")}
      >
        {elapsedLabel}
      </span>
    </div>
  );
}
