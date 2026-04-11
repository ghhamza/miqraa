// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";

const COLORS = {
  excellent: "#1B5E20",
  good: "#4CAF50",
  needs_work: "#F57F17",
  weak: "#EF5350",
} as const;

export interface GradeDistributionBarProps {
  excellent: number;
  good: number;
  needs_work: number;
  weak: number;
  /** Shown when total is 0 */
  emptyMessage?: string;
}

export function GradeDistributionBar({
  excellent,
  good,
  needs_work,
  weak,
  emptyMessage,
}: GradeDistributionBarProps) {
  const { t } = useTranslation();
  const total = excellent + good + needs_work + weak;

  if (total === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        {emptyMessage ?? t("home.noGradesYet")}
      </p>
    );
  }

  const segments = [
    { key: "excellent" as const, n: excellent, color: COLORS.excellent },
    { key: "good" as const, n: good, color: COLORS.good },
    { key: "needs_work" as const, n: needs_work, color: COLORS.needs_work },
    { key: "weak" as const, n: weak, color: COLORS.weak },
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {segments.map(({ key, n, color }) =>
          n > 0 ? (
            <div
              key={key}
              className="min-w-0 transition-[flex-grow]"
              style={{
                flexGrow: n,
                flexBasis: 0,
                backgroundColor: color,
              }}
              title={`${t(`recitations.${gradeLabelKey(key)}`)}: ${n}`}
            />
          ) : null,
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {segments.map(({ key, n, color }) => (
          <div key={key} className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-semibold text-[var(--color-text)]">{n}</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">{t(`recitations.${gradeLabelKey(key)}`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function gradeLabelKey(g: keyof typeof COLORS): string {
  if (g === "needs_work") return "needsWork";
  return g;
}
