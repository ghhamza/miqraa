// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { RecitationGrade } from "../../types";
import { GradeBadge } from "../recitations/GradeBadge";

const BORDER: Record<RecitationGrade, string> = {
  excellent: "border-[#1B5E20]",
  good: "border-[#4CAF50]",
  needs_work: "border-[#F57F17]",
  weak: "border-[#EF5350]",
};

function parseGrade(g: string): RecitationGrade | null {
  if (g === "excellent" || g === "good" || g === "needs_work" || g === "weak") return g;
  return null;
}

interface GradeToastProps {
  grade: string;
  notes?: string;
  onDismiss: () => void;
  durationMs?: number;
}

export function GradeToast({ grade, notes, onDismiss, durationMs = 5000 }: GradeToastProps) {
  const { t } = useTranslation();
  const parsed = parseGrade(grade);

  useEffect(() => {
    const tmr = window.setTimeout(onDismiss, durationMs);
    return () => clearTimeout(tmr);
  }, [durationMs, onDismiss]);

  const borderClass = parsed ? BORDER[parsed] : "border-gray-300";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-xl border-2 bg-[var(--color-surface)] p-4 shadow-lg md:left-auto md:right-6 md:top-24 ${borderClass}`}
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">{t("liveSession.yourGrade")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {parsed ? <GradeBadge grade={parsed} /> : <span className="text-sm">{grade}</span>}
        {notes ? (
          <p dir="auto" className="text-sm text-[var(--color-text-muted)]">
            {notes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
