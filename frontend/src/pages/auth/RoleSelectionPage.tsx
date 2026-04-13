// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { BookOpen, GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api, userFacingApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import type { User } from "../../types";

type RoleChoice = "student" | "teacher";

export function RoleSelectionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [selectedRole, setSelectedRole] = useState<RoleChoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selectedRole) {
      setError(t("auth.roleSelection.selectFirst"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<User>("auth/role-selection", { role: selectedRole });
      setUser(data);
      navigate("/", { replace: true });
    } catch (err) {
      setError(userFacingApiError(err, "auth.roleSelection.saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div className="w-full max-w-[480px] rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-[var(--color-text)]">
          {t("auth.roleSelection.title")}
        </h1>
        <p className="mt-2 text-center text-sm text-[#6B7280]">{t("auth.roleSelection.subtitle")}</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelectedRole("student")}
            className={`rounded-xl border p-6 text-start transition hover:shadow-sm ${
              selectedRole === "student"
                ? "border-2 border-[#1B5E20] bg-[rgba(27,94,32,0.05)]"
                : "border-[#E5E7EB] bg-white"
            }`}
          >
            <GraduationCap
              size={32}
              className={selectedRole === "student" ? "text-[#D4A843]" : "text-[#6B7280]"}
            />
            <h2 className="mt-3 text-lg font-semibold">{t("auth.roleSelection.student")}</h2>
            <p className="mt-1 text-sm text-[#6B7280]">{t("auth.roleSelection.studentDesc")}</p>
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("teacher")}
            className={`rounded-xl border p-6 text-start transition hover:shadow-sm ${
              selectedRole === "teacher"
                ? "border-2 border-[#1B5E20] bg-[rgba(27,94,32,0.05)]"
                : "border-[#E5E7EB] bg-white"
            }`}
          >
            <BookOpen
              size={32}
              className={selectedRole === "teacher" ? "text-[#D4A843]" : "text-[#6B7280]"}
            />
            <h2 className="mt-3 text-lg font-semibold">{t("auth.roleSelection.teacher")}</h2>
            <p className="mt-1 text-sm text-[#6B7280]">{t("auth.roleSelection.teacherDesc")}</p>
          </button>
        </div>

        {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}

        <Button
          type="button"
          variant="primary"
          fullWidth
          className="mt-6"
          disabled={!selectedRole || loading}
          onClick={() => void handleContinue()}
        >
          {t("auth.roleSelection.continue")}
        </Button>
      </div>
    </div>
  );
}
