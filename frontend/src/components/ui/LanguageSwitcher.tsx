// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";

const LANGS = ["ar", "en", "fr"] as const;

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSwitcher({ className = "", compact = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();

  return (
    <div
      className={`flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-[var(--color-surface)] p-1 ${className}`}
      role="group"
      aria-label={t("language.label")}
    >
      {LANGS.map((lng) => {
        const active = (i18n.language || "ar").split("-")[0] === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => void i18n.changeLanguage(lng)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-gray-100"
            }`}
          >
            {compact ? (lng === "ar" ? "ع" : lng.toUpperCase()) : t(`language.${lng}`)}
          </button>
        );
      })}
    </div>
  );
}
