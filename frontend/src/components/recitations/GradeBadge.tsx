// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import type { RecitationGrade } from "../../types";

const styles: Record<RecitationGrade, string> = {
  excellent: "bg-[#1B5E20] text-white border-[#1B5E20]",
  good: "bg-[#4CAF50] text-white border-[#4CAF50]",
  needs_work: "bg-[#F57F17] text-white border-[#F57F17]",
  weak: "bg-[#EF5350] text-white border-[#EF5350]",
};

function gradeKey(g: RecitationGrade): string {
  switch (g) {
    case "needs_work":
      return "needsWork";
    default:
      return g;
  }
}

export function GradeBadge({ grade }: { grade: RecitationGrade | null | undefined }) {
  const { t } = useTranslation();
  if (!grade) {
    return (
      <span className="inline-flex rounded-lg border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-0.5 text-xs font-medium ${styles[grade]}`}
    >
      {t(`recitations.${gradeKey(grade)}`)}
    </span>
  );
}
