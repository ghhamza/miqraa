// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

/**
 * BCP 47 locale for `Intl` formatters (dates, times, numbers).
 * Arabic UI uses Western digits (0–9), not Eastern Arabic (٠–٩).
 * @see https://unicode.org/reports/tr35/#Unicode_locale_identifier
 */
export function intlLocaleForAppLanguage(language: string): string {
  const base = language.split("-")[0] ?? "ar";
  if (base === "en") return "en-US";
  if (base === "fr") return "fr-FR";
  return "ar-u-nu-latn";
}
