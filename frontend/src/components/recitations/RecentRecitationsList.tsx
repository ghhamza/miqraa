// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { RecitationPublic } from "../../types";
import { GradeBadge } from "./GradeBadge";
import { AyahRangeAudioButton } from "./AyahRangeAudioButton";
import { getSurahNameWithArabic } from "../../lib/quranService";
import { useLocaleDate } from "../../hooks/useLocaleDate";

interface RecentRecitationsListProps {
  items: RecitationPublic[];
  showStudent?: boolean;
}

export function RecentRecitationsList({ items, showStudent }: RecentRecitationsListProps) {
  const { t, i18n } = useTranslation();
  const { medium } = useLocaleDate();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{t("recitations.noRecitations")}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-gray-100 bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1 text-start">
            {showStudent ? (
              <p className="font-medium text-[var(--color-text)]">
                {r.student_name ?? t("recitations.deletedStudent")}
              </p>
            ) : null}
            <p style={{ fontFamily: "var(--font-quran)" }} className="text-[var(--color-text)]">
              {getSurahNameWithArabic(r.surah, loc)} · {r.ayah_start}–{r.ayah_end}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{medium(r.created_at)}</p>
            {r.teacher_notes ? (
              <p dir="auto" className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">
                {r.teacher_notes}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            {r.qf_synced_at ? (
              <span
                title={t("recitations.qfSynced")}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
              >
                <Check size={10} />
                Quran.com
              </span>
            ) : null}
            <AyahRangeAudioButton surah={r.surah} ayahStart={r.ayah_start} ayahEnd={r.ayah_end} variant="icon" />
            <GradeBadge grade={r.grade} />
          </div>
        </li>
      ))}
    </ul>
  );
}
