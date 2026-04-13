// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";

export function AccountLinksPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const loadUser = useAuthStore((s) => s.loadUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleLink() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.get<{ authorize_url: string }>(
        "auth/qf/start?link=true&redirect_after=/settings",
      );
      window.location.href = data.authorize_url;
    } catch (err) {
      setError(userFacingApiError(err));
      setBusy(false);
    }
  }

  async function handleUnlink() {
    if (busy) return;
    if (!window.confirm(t("settings.qf.unlinkConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("auth/qf/unlink");
      await loadUser();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      className="mx-auto max-w-2xl"
      breadcrumb={[{ label: t("nav.home"), to: "/" }, { label: t("settings.qf.title") }]}
      title={t("settings.qf.title")}
      description={t("settings.qf.description")}
    >
      <PageCard className="space-y-4">
        {user.qf_linked ? (
          <>
            <p className="text-sm text-[#1B5E20]">
              ✓ {t("settings.qf.linkedAs")} {user.qf_email || user.email}
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-[#EF5350] text-[#EF5350] hover:bg-[#EF5350]/10"
              onClick={() => void handleUnlink()}
              disabled={busy}
            >
              {t("settings.qf.unlink")}
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => void handleLink()} disabled={busy}>
            {t("settings.qf.link")}
          </Button>
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </PageCard>
    </PageShell>
  );
}
