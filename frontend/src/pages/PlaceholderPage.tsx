// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";

interface PlaceholderPageProps {
  titleKey: "placeholder.calendar";
}

export function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-[var(--color-surface)] p-12 text-center shadow-sm">
      <p className="text-lg text-[var(--color-text-muted)]">
        {t("common.comingSoon")} — {t(titleKey)}
      </p>
    </div>
  );
}
