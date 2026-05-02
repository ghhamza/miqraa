// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { QfStreak } from "../../hooks/useQfStreak";
import { cn } from "@/lib/utils";

export interface CombinedStreakCardProps {
  miqraaStreakDays: number;
  qfLinked: boolean;
  qfStreak: QfStreak | null;
  qfLoading: boolean;
}

export function CombinedStreakCard({ miqraaStreakDays, qfLinked, qfStreak, qfLoading }: CombinedStreakCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
      <p className="text-sm text-[var(--color-text-muted)]">{t("home.streakTitle")}</p>
      <div
        className={cn(
          "mt-3 grid gap-4",
          qfLinked ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t("home.miqraaStreak")}</p>
          <div className="mt-1 flex items-center gap-2">
            <Flame className="h-8 w-8 shrink-0 text-orange-500" aria-hidden />
            {miqraaStreakDays > 0 ? (
              <p className="text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
                {t("home.dayStreak", { days: miqraaStreakDays })}
              </p>
            ) : (
              <p className="text-sm font-medium text-[var(--color-text)]">{t("home.startStreak")}</p>
            )}
          </div>
        </div>
        {qfLinked ? (
          <div className="min-w-0 border-t border-gray-100 pt-3 sm:border-s sm:border-t-0 sm:pt-0 sm:ps-4">
            <p className="text-xs font-medium text-blue-700">{t("home.qfStreak")}</p>
            <div className="mt-1 flex items-center gap-2">
              <Flame className="h-8 w-8 shrink-0 text-blue-600" aria-hidden />
              {qfStreak ? (
                <p className="text-2xl font-bold text-blue-900">{t("home.dayStreak", { days: qfStreak.days })}</p>
              ) : (
                <p className="text-sm font-medium text-blue-900">{qfLoading ? t("common.loading") : "—"}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
