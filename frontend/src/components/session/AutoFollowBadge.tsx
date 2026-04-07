// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface AutoFollowBadgeProps {
  enabled: boolean;
  onToggle: () => void;
  /** When true, omit fixed corner positioning (immersive live layout bottom stack). */
  inline?: boolean;
}

/** Student-only: toggle following teacher ayah/page vs free browse. */
export function AutoFollowBadge({ enabled, onToggle, inline = false }: AutoFollowBadgeProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full border border-gray-200 bg-[var(--color-surface)] px-3 py-2 text-xs font-medium shadow-md backdrop-blur-sm",
        inline
          ? "border-white/20 bg-black/50 text-white"
          : "fixed bottom-28 right-4 z-[26] md:bottom-32",
      )}
      style={{ fontFamily: "var(--font-ui)" }}
      aria-pressed={enabled}
    >
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: enabled ? "#1B5E20" : "#6B7280" }}
        aria-hidden
      />
      <span className={inline ? "text-white" : "text-[var(--color-text)]"}>
        {enabled ? t("liveSession.following") : t("liveSession.freeBrowse")}
      </span>
    </button>
  );
}
