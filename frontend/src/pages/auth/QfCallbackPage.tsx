// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import type { User } from "../../types";

type QfExchangeResponse =
  | { token: string; user: User; redirect_after?: string }
  | { linked: true; qf_email: string | null; redirect_after?: string };

// OAuth state is one-time-use; share an in-flight exchange per code/state key
// so strict-mode double effects don't trigger a second backend consume.
const exchangeRequests = new Map<string, Promise<QfExchangeResponse>>();

export function QfCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const loadUser = useAuthStore((s) => s.loadUser);
  const [error, setError] = useState<string | null>(null);

  const queryError = search.get("error");
  const code = search.get("code");
  const state = search.get("state");

  const initialError = useMemo(() => {
    if (queryError) return `${t("auth.qfCallback.failed")}: ${queryError}`;
    if (!code || !state) return t("auth.qfCallback.invalidState");
    return null;
  }, [code, queryError, state, t]);

  useEffect(() => {
    if (initialError || !code || !state) {
      setError(initialError);
      return;
    }
    const exchangeKey = `${code}:${state}`;
    let cancelled = false;
    void (async () => {
      try {
        let req = exchangeRequests.get(exchangeKey);
        if (!req) {
          req = api
            .post<QfExchangeResponse>("auth/qf/exchange", { code, state })
            .then((res) => res.data)
            .finally(() => {
              exchangeRequests.delete(exchangeKey);
            });
          exchangeRequests.set(exchangeKey, req);
        }
        const data = await req;
        if (cancelled) return;
        if ("token" in data) {
          login(data.token, data.user);
          if (data.redirect_after === "/auth/role-selection") {
            navigate("/auth/role-selection", { replace: true });
          } else {
            navigate(data.redirect_after || "/", { replace: true });
          }
          return;
        }
        await loadUser();
        navigate(data.redirect_after || "/settings", { replace: true });
      } catch (err) {
        if (!cancelled) setError(userFacingApiError(err, "auth.qfCallback.failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, initialError, loadUser, login, navigate, state, t]);

  if (!error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#1B5E20] border-t-transparent" />
        <p className="text-sm text-[var(--color-text-muted)]">{t("auth.qfCallback.verifying")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm text-red-600">{error}</p>
      <Link to="/login" className="text-sm font-semibold text-[var(--color-primary)] underline">
        {t("auth.qfCallback.retry")}
      </Link>
    </div>
  );
}
