// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { BookOpen, GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type RoleChoice = "student" | "teacher";

export interface RoleChoiceCardsProps {
  /** Highlighted card; `null` means none selected (e.g. role-selection flow before choosing). */
  selected: RoleChoice | null;
  onSelect: (role: RoleChoice) => void;
  className?: string;
  /** Optional id for radiogroup aria-labelledby */
  legendId?: string;
}

export function RoleChoiceCards({ selected, onSelect, className, legendId }: RoleChoiceCardsProps) {
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-labelledby={legendId}
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected === "student"}
        onClick={() => onSelect("student")}
        className={`rounded-xl border p-6 text-start transition hover:shadow-sm ${
          selected === "student"
            ? "border-2 border-[#1B5E20] bg-[rgba(27,94,32,0.05)]"
            : "border-[#E5E7EB] bg-white"
        }`}
      >
        <GraduationCap
          size={32}
          className={selected === "student" ? "text-[#D4A843]" : "text-[#6B7280]"}
          aria-hidden
        />
        <h2 className="mt-3 text-lg font-semibold">{t("auth.roleSelection.student")}</h2>
        <p className="mt-1 text-sm text-[#6B7280]">{t("auth.roleSelection.studentDesc")}</p>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={selected === "teacher"}
        onClick={() => onSelect("teacher")}
        className={`rounded-xl border p-6 text-start transition hover:shadow-sm ${
          selected === "teacher"
            ? "border-2 border-[#1B5E20] bg-[rgba(27,94,32,0.05)]"
            : "border-[#E5E7EB] bg-white"
        }`}
      >
        <BookOpen
          size={32}
          className={selected === "teacher" ? "text-[#D4A843]" : "text-[#6B7280]"}
          aria-hidden
        />
        <h2 className="mt-3 text-lg font-semibold">{t("auth.roleSelection.teacher")}</h2>
        <p className="mt-1 text-sm text-[#6B7280]">{t("auth.roleSelection.teacherDesc")}</p>
      </button>
    </div>
  );
}
