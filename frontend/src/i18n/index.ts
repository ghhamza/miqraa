// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/**
 * i18n stack: `i18next` + `react-i18next` are plain JS/React i18n libraries (not Next.js).
 * They work with Vite; see https://react.i18next.com/
 */
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

function applyDocumentLanguage(lng: string) {
  const isRtl = lng === "ar";
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  /** Prefer Western digits (0–9) in Arabic UI; matches `intlLocaleForAppLanguage`. */
  document.documentElement.lang = lng === "ar" ? "ar-u-nu-latn" : lng;
}

const SUPPORTED = ["ar", "en", "fr"] as const;

function normalizeLang(lng: string): string {
  const base = lng.split("-")[0] ?? "ar";
  return (SUPPORTED as readonly string[]).includes(base) ? base : "ar";
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "ar",
    supportedLngs: [...SUPPORTED],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "miqraa_lang",
      caches: ["localStorage"],
      convertDetectedLanguage: (lng) => normalizeLang(lng),
    },
  })
  .then(() => {
    applyDocumentLanguage(normalizeLang(i18n.language || "ar"));
  });

i18n.on("languageChanged", (lng) => {
  const code = normalizeLang(lng);
  applyDocumentLanguage(code);
  try {
    localStorage.setItem("miqraa_lang", code);
  } catch {
    /* ignore */
  }
});

export default i18n;
