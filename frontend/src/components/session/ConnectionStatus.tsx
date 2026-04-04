// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import type { SessionWsStatus } from "../../hooks/useSessionWebSocket";
import type { NetworkQuality } from "../../hooks/useWebRTCConnection";

const DOT: Record<SessionWsStatus, { color: string; key: string }> = {
  connected: { color: "#1B5E20", key: "connected" },
  connecting: { color: "#F57F17", key: "connecting" },
  reconnecting: { color: "#F57F17", key: "reconnecting" },
  disconnected: { color: "#EF5350", key: "disconnected" },
  error: { color: "#EF5350", key: "disconnected" },
};

function SignalBars({ quality, qualityLabel }: { quality: NetworkQuality | null; qualityLabel: string }) {
  const bars =
    quality === "good" ? 3 : quality === "fair" ? 2 : quality === "poor" ? 1 : 3;
  const color =
    quality === "poor"
      ? "#EF5350"
      : quality === "fair"
        ? "#F9A825"
        : quality === "good"
          ? "#1B5E20"
          : "#9E9E9E";
  const h = [4, 7, 10] as const;

  return (
    <span className="inline-flex items-end gap-0.5" title={qualityLabel} aria-hidden>
      {h.map((px, i) => (
        <span
          key={i}
          className="w-1 rounded-sm"
          style={{
            height: `${px}px`,
            backgroundColor: i < bars ? color : "#E0E0E0",
          }}
        />
      ))}
    </span>
  );
}

interface ConnectionStatusProps {
  status: SessionWsStatus;
  /** WebRTC audio quality when connected; ignored when not connected. */
  networkQuality?: NetworkQuality | null;
  className?: string;
}

export function ConnectionStatus({ status, networkQuality = null, className = "" }: ConnectionStatusProps) {
  const { t } = useTranslation();
  const cfg = DOT[status] ?? DOT.disconnected;
  const labelKey = `liveSession.${cfg.key}` as const;
  const showBars = status === "connected";
  const qualityLabelKey =
    networkQuality === "good"
      ? "networkGood"
      : networkQuality === "fair"
        ? "networkFair"
        : networkQuality === "poor"
          ? "networkPoor"
          : "networkGood";
  const qualityLabel = t(`liveSession.${qualityLabelKey}`);

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span
        className="inline-block size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: cfg.color }}
        aria-hidden
      />
      {showBars ? <SignalBars quality={networkQuality} qualityLabel={qualityLabel} /> : null}
      <span className="text-[var(--color-text-muted)]">{t(labelKey)}</span>
    </div>
  );
}
