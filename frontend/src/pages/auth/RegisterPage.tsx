// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import type { AuthResponse } from "../../types";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [qfError, setQfError] = useState<string | null>(null);
  const [qfLoading, setQfLoading] = useState(false);

  async function handleQfLogin() {
    if (qfLoading) return;
    setQfError(null);
    setQfLoading(true);
    try {
      const res = await api.get<{ authorize_url: string }>("auth/qf/start");
      window.location.href = res.data.authorize_url;
    } catch {
      setQfError(t("auth.qfCallback.failed"));
      setQfLoading(false);
    }
  }

  function validate(): string | null {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      return t("auth.fillAll");
    }
    if (password.length < 8) {
      return t("auth.passwordMin");
    }
    if (password !== confirm) {
      return t("auth.passwordMismatch");
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const v = validate();
    if (v) {
      setFormError(v);
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>("auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      login(data.token, data.user);
      navigate("/", { replace: true });
    } catch {
      setFormError(t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div
        className="relative w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-8 shadow-md"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <div className="absolute end-4 top-4">
          <LanguageSwitcher compact />
        </div>
        <h1
          className="text-center text-4xl font-bold text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-quran)" }}
        >
          {t("common.appName")}
        </h1>
        <p className="mt-2 text-center text-lg text-[var(--color-text-muted)]">{t("auth.newAccountSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Input
            label={t("auth.name")}
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label={t("auth.email")}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label={t("auth.password")}
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label={t("auth.confirmPassword")}
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-[var(--color-text)]">{t("auth.accountType")}</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  checked={role === "student"}
                  onChange={() => setRole("student")}
                  className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span>{t("auth.student")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  checked={role === "teacher"}
                  onChange={() => setRole("teacher")}
                  className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span>{t("auth.teacher")}</span>
              </label>
            </div>
          </fieldset>

          {formError ? (
            <p className="text-center text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {t("auth.createAccount")}
          </Button>

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-[#6B7280]/30" />
            <span className="text-sm text-[#6B7280]">{t("auth.or")}</span>
            <div className="h-px flex-1 bg-[#6B7280]/30" />
          </div>
          <button
            type="button"
            onClick={() => void handleQfLogin()}
            disabled={qfLoading}
            className="w-full rounded-lg border border-[#2c5f7c] bg-white px-4 py-2.5 text-[#2c5f7c] transition hover:bg-[#2c5f7c]/5"
          >
            <span className="flex items-center justify-center gap-2">
              <BookOpen size={18} />
              {t("auth.continueWithQuranFoundation")}
            </span>
          </button>
          {qfError ? (
            <p className="text-center text-sm text-red-600" role="alert">
              {qfError}
            </p>
          ) : null}
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          {t("auth.hasAccount")}{" "}
          <Link to="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
