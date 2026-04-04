// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import type { SessionAttendance } from "../../types";
import { Button } from "../ui/Button";

interface AttendanceListProps {
  items: SessionAttendance[];
  localState: Record<string, boolean>;
  onToggle: (studentId: string, attended: boolean) => void;
  onPresentAll: () => void;
  onAbsentAll: () => void;
  total: number;
  presentCount: number;
}

export function AttendanceList({
  items,
  localState,
  onToggle,
  onPresentAll,
  onAbsentAll,
  total,
  presentCount,
}: AttendanceListProps) {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="!py-2 !px-3 text-xs" onClick={onPresentAll}>
          {t("sessions.presentAll")}
        </Button>
        <Button type="button" variant="secondary" className="!py-2 !px-3 text-xs" onClick={onAbsentAll}>
          {t("sessions.absentAll")}
        </Button>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        {t("sessions.studentsAttended", { count: presentCount, total })}
      </p>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-[var(--color-surface)]">
        {items.map((row) => {
          const attended = localState[row.student_id] ?? row.attended;
          return (
            <li
              key={row.student_id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span className="font-medium text-[var(--color-text)]">{row.student_name}</span>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)]"
                  checked={attended}
                  onChange={(e) => onToggle(row.student_id, e.target.checked)}
                />
                <span className="text-[var(--color-text-muted)]">
                  {attended ? t("sessions.present") : t("sessions.absent")}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
