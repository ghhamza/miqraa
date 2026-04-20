// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { Info, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AudioMigrationBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-[#EDEBDD] bg-[#FAFAF5] p-3 text-sm text-[#6B7280] md:p-4"
      style={{ borderInlineStart: "3px solid #D4A843", fontFamily: "var(--font-ui)" }}
      role="status"
      aria-live="polite"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
      <p className="min-w-0 flex-1">{t("liveSession.audioMigrationBanner")}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-[#6B7280] transition hover:bg-black/5"
        aria-label={t("common.close")}
        title={t("common.close")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
