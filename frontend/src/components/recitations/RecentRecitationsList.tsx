// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import type { RecitationPublic } from "../../types";
import { GradeBadge } from "./GradeBadge";
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
          <GradeBadge grade={r.grade} />
        </li>
      ))}
    </ul>
  );
}
