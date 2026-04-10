// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { SessionAttendance } from "../../types";
import { Button } from "../ui/Button";

/** Grade color from last recitation (passed in from parent). */
export type GradeColor = "excellent" | "good" | "needs_work" | "weak" | "none";

const GRADE_DOT_COLORS: Record<GradeColor, string> = {
  excellent: "#1B5E20",
  good: "#4CAF50",
  needs_work: "#F57F17",
  weak: "#EF5350",
  none: "#D1D5DB",
};

export interface AttendanceSheetProps {
  sessionId: string;
  items: SessionAttendance[];
  /** Map of student_id → local attended state */
  localState: Record<string, boolean>;
  /** Map of student_id → local attendance note */
  localNotes: Record<string, string>;
  /** Map of student_id → last grade color for the dot */
  studentGrades: Record<string, GradeColor>;
  onToggle: (studentId: string, attended: boolean) => void;
  onNoteChange: (studentId: string, note: string) => void;
  onPresentAll: () => void;
  onAbsentAll: () => void;
  total: number;
  presentCount: number;
}

export function AttendanceSheet({
  sessionId,
  items,
  localState,
  localNotes,
  studentGrades,
  onToggle,
  onNoteChange,
  onPresentAll,
  onAbsentAll,
  total,
  presentCount,
}: AttendanceSheetProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;
  const listDir = i18n.language === "ar" ? "rtl" : "ltr";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="xs" onClick={onPresentAll}>
          {t("sessions.presentAll")}
        </Button>
        <Button type="button" variant="secondary" size="xs" onClick={onAbsentAll}>
          {t("sessions.absentAll")}
        </Button>
        <span className="text-xs text-[var(--color-text-muted)]">
          {t("sessions.studentsAttended", { count: presentCount, total })}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul
        dir={listDir}
        className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-[var(--color-surface)]"
      >
        {items.map((row) => {
          const attended = localState[row.student_id] ?? row.attended;
          const note = localNotes[row.student_id] ?? row.attendance_note ?? "";
          const gradeColor = studentGrades[row.student_id] ?? "none";

          return (
            <li key={row.student_id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: GRADE_DOT_COLORS[gradeColor] }}
                title={t(`sessions.grade_${gradeColor}`)}
              />

              <span className="flex-1 font-medium text-[var(--color-text)]">{row.student_name}</span>

              {attended ? (
                <select
                  className="max-w-[9rem] rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs text-[var(--color-text-muted)]"
                  value={note}
                  onChange={(e) => onNoteChange(row.student_id, e.target.value)}
                  aria-label={t("sessions.attendanceNote")}
                >
                  <option value="">{/* blank */}</option>
                  <option value="late">{t("sessions.noteLate")}</option>
                  <option value="excused">{t("sessions.noteExcused")}</option>
                </select>
              ) : (
                <span className="shrink-0 text-xs text-red-500">{t("sessions.absent")}</span>
              )}

              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={attended}
                  onChange={(e) => onToggle(row.student_id, e.target.checked)}
                />
                <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[var(--color-primary)] peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full" />
              </label>

              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={!attended}
                onClick={() => navigate(`/sessions/${sessionId}/students/${row.student_id}`)}
              >
                {t("sessions.studentSheet")}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
