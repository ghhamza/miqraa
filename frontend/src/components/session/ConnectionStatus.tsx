// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";
import type { LivekitConnectionStatus } from "../../hooks/useLivekitConnection";

const DOT: Record<SessionWsStatus, { color: string; key: string }> = {
  connected: { color: "#1B5E20", key: "connected" },
  connecting: { color: "#F57F17", key: "connecting" },
  reconnecting: { color: "#F57F17", key: "reconnecting" },
  disconnected: { color: "#EF5350", key: "disconnected" },
  error: { color: "#EF5350", key: "disconnected" },
};

interface ConnectionStatusProps {
  status: SessionWsStatus;
  livekitStatus?: LivekitConnectionStatus;
  className?: string;
  /** Light text for dark translucent bars (e.g. immersive live session). */
  variant?: "default" | "onDark";
  /** Dot only (no status text). */
  iconsOnly?: boolean;
}

const LIVEKIT_DOT: Record<
  LivekitConnectionStatus,
  { color: string; key: "idle" | "connecting" | "connected" | "disconnected" | "error" }
> = {
  idle: { color: "#9CA3AF", key: "idle" },
  requesting_token: { color: "#D4A843", key: "connecting" },
  connecting: { color: "#D4A843", key: "connecting" },
  connected: { color: "#1B5E20", key: "connected" },
  disconnected: { color: "#6B7280", key: "disconnected" },
  error: { color: "#EF5350", key: "error" },
};

export function ConnectionStatus({
  status,
  livekitStatus,
  className = "",
  variant = "default",
  iconsOnly = false,
}: ConnectionStatusProps) {
  const { t } = useTranslation();
  const cfg = DOT[status] ?? DOT.disconnected;
  const livekitCfg = livekitStatus ? LIVEKIT_DOT[livekitStatus] : null;
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
        {livekitCfg ? (
          <>
            <span className="sr-only">{t(`liveSession.audio.${livekitCfg.key}`)}</span>
            <span
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: livekitCfg.color }}
              aria-hidden
            />
          </>
        ) : null}
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
      {livekitCfg ? (
        <>
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: livekitCfg.color }}
            aria-hidden
          />
          <span className={labelClass}>{t(`liveSession.audio.${livekitCfg.key}`)}</span>
        </>
      ) : null}
    </div>
  );
}
