// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAllJuz, getAllSurahs, getPageForJuzStart, getPageForSurahStart } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";

interface MushafNavigationProps {
  page: number;
  totalPages: number;
  riwaya: Riwaya;
  onPageChange: (p: number) => void;
}

export function MushafNavigation({ page, totalPages, riwaya, onPageChange }: MushafNavigationProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";
  const isRtl = i18n.language === "ar";
  const surahs = getAllSurahs();
  const juzMeta = getAllJuz();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="rounded-xl border border-gray-200 p-2 text-[var(--color-text)] hover:bg-gray-50 disabled:opacity-40"
          aria-label={t("mushaf.prevPage")}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft className={`h-6 w-6 ${isRtl ? "" : "rotate-180"}`} />
        </button>
        <button
          type="button"
          className="rounded-xl border border-gray-200 p-2 text-[var(--color-text)] hover:bg-gray-50 disabled:opacity-40"
          aria-label={t("mushaf.nextPage")}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronRight className={`h-6 w-6 ${isRtl ? "" : "rotate-180"}`} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("mushaf.goToSurah")}</label>
          <select
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            style={{ fontFamily: "var(--font-quran)" }}
            defaultValue=""
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 114) {
                onPageChange(getPageForSurahStart(n, riwaya));
              }
              e.target.value = "";
            }}
          >
            <option value="">{t("mushaf.goToSurah")}</option>
            {surahs.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {loc === "ar" ? s.nameAr : loc === "fr" ? s.nameFr : s.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("mushaf.goToJuz")}</label>
          <select
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            defaultValue=""
            onChange={(e) => {
              const j = Number(e.target.value);
              if (j >= 1 && j <= 30) {
                onPageChange(getPageForJuzStart(j, riwaya));
              }
              e.target.value = "";
            }}
          >
            <option value="">{t("mushaf.goToJuz")}</option>
            {juzMeta.map((j) => (
              <option key={j.number} value={j.number}>
                {j.number}. {j.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("mushaf.goToPage")}</label>
          <input
            type="number"
            min={1}
            max={totalPages}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder={String(page)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = Number((e.target as HTMLInputElement).value);
                if (v >= 1 && v <= totalPages) onPageChange(v);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
