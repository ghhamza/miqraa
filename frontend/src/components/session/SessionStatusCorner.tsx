// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import { ConnectionStatus } from "./ConnectionStatus";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";
import type { NetworkQuality } from "../../hooks/useWebRTCConnection";
import type { HalaqahType } from "../../types";

const TYPE_KEYS: Record<string, string> = {
  hifz: "rooms.halaqahHifz",
  tilawa: "rooms.halaqahTilawa",
  muraja: "rooms.halaqahMuraja",
  tajweed: "rooms.halaqahTajweed",
};

interface SessionStatusCornerProps {
  connectionStatus: SessionWsStatus;
  networkQuality?: NetworkQuality | null;
  halaqahType?: HalaqahType;
  activeReciterName: string | null;
  /** Session elapsed time (e.g. MM:SS). */
  elapsedLabel: string;
}

export function SessionStatusCorner({
  connectionStatus,
  networkQuality,
  halaqahType,
  activeReciterName,
  elapsedLabel,
}: SessionStatusCornerProps) {
  const { t } = useTranslation();
  return (
    <div className="relative z-0 flex w-full max-w-full flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <ConnectionStatus status={connectionStatus} networkQuality={networkQuality} />
        {halaqahType ? (
          <span className="rounded-md bg-[#1B5E20] px-2 py-0.5 text-[10px] font-semibold text-white">
            {t(TYPE_KEYS[halaqahType] ?? "rooms.halaqahHifz")}
          </span>
        ) : null}
        <span className="rounded-md bg-[#EF5350] px-2 py-0.5 text-[10px] font-semibold text-white">
          {t("liveSession.live")}
        </span>
        <span
          className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] tabular-nums text-[#666] shadow-sm"
          title={t("liveSession.elapsed")}
        >
          {elapsedLabel}
        </span>
      </div>
      {activeReciterName ? (
        <div className="flex max-w-full items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-[#1B5E20] shadow-sm">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4CAF50]" />
          <span className="truncate">
            {activeReciterName} — {t("liveSession.reciting")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
