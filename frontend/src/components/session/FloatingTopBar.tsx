// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConnectionStatus } from "./ConnectionStatus";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";
import type { HalaqahType } from "../../types";

interface FloatingTopBarProps {
  connectionStatus: SessionWsStatus;
  halaqahName: string;
  halaqahType?: HalaqahType;
  elapsedLabel: string;
  participantCount: number;
  isTeacher: boolean;
  onLeave: () => void;
  onEndSession?: () => void;
}

const TYPE_KEYS: Record<string, string> = {
  hifz: "rooms.halaqahHifz",
  tilawa: "rooms.halaqahTilawa",
  muraja: "rooms.halaqahMuraja",
  tajweed: "rooms.halaqahTajweed",
};

export function FloatingTopBar({
  connectionStatus,
  halaqahName,
  halaqahType,
  elapsedLabel,
  participantCount,
  isTeacher,
  onLeave,
  onEndSession,
}: FloatingTopBarProps) {
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-auto flex max-w-[min(100%,28rem)] flex-wrap items-center gap-2 rounded-xl bg-black/70 px-3 py-2 backdrop-blur-sm"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <ConnectionStatus
        status={connectionStatus}
        variant="onDark"
        className="text-xs"
      />
      <span className="max-w-[10rem] truncate text-xs font-semibold text-white">{halaqahName}</span>
      {halaqahType ? (
        <span className="shrink-0 rounded-md bg-[#1B5E20] px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {t(TYPE_KEYS[halaqahType] ?? "rooms.halaqahHifz")}
        </span>
      ) : null}
      <span className="shrink-0 rounded-md bg-[#EF5350] px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {t("liveSession.live")}
      </span>
      <span className="tabular-nums text-xs text-white/60">{elapsedLabel}</span>
      <span className="text-xs text-white/40" title={t("liveSession.participants")}>
        {participantCount}
      </span>
      <button
        type="button"
        onClick={onLeave}
        className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
        title={t("liveSession.leave")}
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
      {isTeacher && onEndSession ? (
        <button
          type="button"
          onClick={onEndSession}
          className="rounded-lg bg-[#EF5350] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#E53935]"
        >
          {t("liveSession.endSession")}
        </button>
      ) : null}
    </div>
  );
}
