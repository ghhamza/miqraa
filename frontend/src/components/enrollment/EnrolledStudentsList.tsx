// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Enrollment } from "../../types";
import { useLocaleDate } from "../../hooks/useLocaleDate";

interface EnrolledStudentsListProps {
  enrollments: Enrollment[];
  maxStudents: number;
  canManage: boolean;
  onRemove: (e: Enrollment) => void;
}

export function EnrolledStudentsList({
  enrollments,
  maxStudents,
  canManage,
  onRemove,
}: EnrolledStudentsListProps) {
  const { t } = useTranslation();
  const { medium } = useLocaleDate();
  const count = enrollments.length;
  const pct = maxStudents > 0 ? Math.min(100, Math.round((count / maxStudents) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--color-text-muted)]">
          {t("enrollment.studentCount", { count })}
        </p>
        <span className="text-sm tabular-nums text-[var(--color-text)]">
          {count}/{maxStudents}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {enrollments.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">{t("enrollment.noStudents")}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-[var(--color-surface)]">
          {enrollments.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--color-text)]">{e.student_name}</p>
                <p className="truncate text-[var(--color-text-muted)]">{e.student_email}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {t("enrollment.enrolledOn")}: {medium(e.enrolled_at)}
                </p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50"
                  aria-label={t("enrollment.removeStudent")}
                  onClick={() => onRemove(e)}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
