// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ReconnectingOverlayProps {
  visible: boolean;
}

export function ReconnectingOverlay({ visible }: ReconnectingOverlayProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-white/55 backdrop-blur-[1px]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200/80 bg-white/90 px-6 py-4 shadow-lg">
        <Wifi
          className="size-10 animate-pulse text-[var(--color-primary)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--color-text)]">{t("liveSession.reconnecting")}</p>
      </div>
    </div>
  );
}
