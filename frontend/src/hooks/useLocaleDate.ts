// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { intlLocaleForAppLanguage } from "../lib/intlLocale";

export function useLocaleDate() {
  const { i18n } = useTranslation();
  const locale = intlLocaleForAppLanguage(i18n.language);

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
