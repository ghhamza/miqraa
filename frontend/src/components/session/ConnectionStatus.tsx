// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";

const DOT: Record<SessionWsStatus, { color: string; key: string }> = {
  connected: { color: "#1B5E20", key: "connected" },
  connecting: { color: "#F57F17", key: "connecting" },
  reconnecting: { color: "#F57F17", key: "reconnecting" },
  disconnected: { color: "#EF5350", key: "disconnected" },
  error: { color: "#EF5350", key: "disconnected" },
};

interface ConnectionStatusProps {
  status: SessionWsStatus;
  className?: string;
  /** Light text for dark translucent bars (e.g. immersive live session). */
  variant?: "default" | "onDark";
  /** Dot only (no status text). */
  iconsOnly?: boolean;
}

export function ConnectionStatus({
  status,
  className = "",
  variant = "default",
  iconsOnly = false,
}: ConnectionStatusProps) {
  const { t } = useTranslation();
  const cfg = DOT[status] ?? DOT.disconnected;
  const labelKey = `liveSession.${cfg.key}` as const;

  const labelClass =
    variant === "onDark" ? "text-white/80" : "text-[var(--color-text-muted)]";

  if (iconsOnly) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="sr-only">{t(labelKey)}</span>
        <span
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: cfg.color }}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: cfg.color }}
        aria-hidden
      />
      <span className={labelClass}>{t(labelKey)}</span>
    </div>
  );
}
