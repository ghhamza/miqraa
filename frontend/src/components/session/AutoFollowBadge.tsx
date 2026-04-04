// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";

interface AutoFollowBadgeProps {
  enabled: boolean;
  onToggle: () => void;
}

/** Student-only: toggle following teacher ayah/page vs free browse. */
export function AutoFollowBadge({ enabled, onToggle }: AutoFollowBadgeProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onToggle}
      className="pointer-events-auto fixed bottom-28 right-4 z-[26] flex items-center gap-2 rounded-full border border-gray-200 bg-[var(--color-surface)] px-3 py-2 text-xs font-medium shadow-md backdrop-blur-sm md:bottom-32"
      style={{ fontFamily: "var(--font-ui)" }}
      aria-pressed={enabled}
    >
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: enabled ? "#1B5E20" : "#6B7280" }}
        aria-hidden
      />
      <span className="text-[var(--color-text)]">{enabled ? t("liveSession.following") : t("liveSession.freeBrowse")}</span>
    </button>
  );
}
