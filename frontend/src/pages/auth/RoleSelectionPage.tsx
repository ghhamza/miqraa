// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api, userFacingApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { RoleChoiceCards, type RoleChoice } from "../../components/auth/RoleChoiceCards";
import { Button } from "../../components/ui/Button";
import type { User } from "../../types";

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
      const { data } = await api.request<User>({
        method: "post",
        url: "auth/role-selection",
        data: { role: selectedRole },
      });
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
        <h1
          id="role-selection-heading"
          className="text-center text-2xl font-bold text-[var(--color-text)]"
        >
          {t("auth.roleSelection.title")}
        </h1>
        <p className="mt-2 text-center text-sm text-[#6B7280]">{t("auth.roleSelection.subtitle")}</p>

        <RoleChoiceCards
          className="mt-6"
          selected={selectedRole}
          onSelect={setSelectedRole}
          legendId="role-selection-heading"
        />

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
