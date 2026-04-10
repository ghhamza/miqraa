// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";

export function ReciterChip({ name }: { name: string | null }) {
  const { t } = useTranslation();
  if (!name) return null;
  return (
    <div
      className="pointer-events-auto flex max-w-[min(100%,20rem)] items-center gap-1.5 rounded-lg bg-[#1B5E20]/80 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-[#4CAF50]" />
      <span className="truncate">
        {name} — {t("liveSession.reciting")}
      </span>
    </div>
  );
}
