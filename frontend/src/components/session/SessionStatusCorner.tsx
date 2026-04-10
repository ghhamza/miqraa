// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import { ConnectionStatus } from "./ConnectionStatus";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";
import type { NetworkQuality } from "../../hooks/useWebRTCConnection";

interface SessionStatusCornerProps {
  connectionStatus: SessionWsStatus;
  networkQuality?: NetworkQuality | null;
  /** Session elapsed time (e.g. MM:SS). */
  elapsedLabel: string;
}

/** Compact status: connection dot + signal bars + elapsed timer only. */
export function SessionStatusCorner({
  connectionStatus,
  networkQuality,
  elapsedLabel,
}: SessionStatusCornerProps) {
  const { t } = useTranslation();
  return (
    <div className="relative z-0 flex w-full max-w-full flex-wrap items-center gap-2">
      <ConnectionStatus status={connectionStatus} networkQuality={networkQuality} iconsOnly />
      <span
        className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] tabular-nums text-[#666] shadow-sm"
        title={t("liveSession.elapsed")}
      >
        {elapsedLabel}
      </span>
    </div>
  );
}
