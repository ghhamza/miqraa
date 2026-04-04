// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function useLocaleDate() {
  const { i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : i18n.language === "fr" ? "fr-FR" : "ar-SA";

  return useMemo(
    () => ({
      medium: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(d)),
      mediumTime: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(d),
        ),
      full: (d: string | Date) =>
        new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(d),
        ),
    }),
    [locale],
  );
}
