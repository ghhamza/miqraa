// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import type { User } from "../../types";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || profileLoading) return;
    setProfileError(null);
    setProfileSuccess(false);
    setProfileLoading(true);
    try {
      const { data } = await api.put<User>("auth/me", {
        name: name.trim(),
        email: email.trim(),
      });
      setUser(data);
      setProfileSuccess(true);
      window.setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err) {
      setProfileError(userFacingApiError(err));
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user || passwordLoading) return;
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("auth.passwordMin"));
      return;
    }
    setPasswordLoading(true);
    try {
      await api.put("auth/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      window.setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err) {
      setPasswordError(userFacingApiError(err));
    } finally {
      setPasswordLoading(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <PageShell
      className="mx-auto max-w-lg"
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("profile.title") },
      ]}
      title={t("profile.title")}
      description={t("profile.subtitle")}
      contentClassName="space-y-10"
    >
      <PageCard>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("profile.accountSection")}</h2>
        <form onSubmit={handleProfile} className="space-y-4">
          <Input
            label={t("auth.name")}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          <Input
            label={t("auth.email")}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {profileError ? (
            <p className="text-sm text-red-600" role="alert">
              {profileError}
            </p>
          ) : null}
          {profileSuccess ? (
            <p className="text-sm text-[var(--color-primary)]" role="status">
              {t("profile.profileSaved")}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={profileLoading}>
            {profileLoading ? t("common.loading") : t("profile.saveProfile")}
          </Button>
        </form>
      </PageCard>

      <PageCard>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("profile.passwordSection")}</h2>
        <form onSubmit={handlePassword} className="space-y-4">
          <Input
            label={t("profile.currentPassword")}
            name="current_password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label={t("profile.newPassword")}
            name="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label={t("profile.confirmPassword")}
            name="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {passwordError ? (
            <p className="text-sm text-red-600" role="alert">
              {passwordError}
            </p>
          ) : null}
          {passwordSuccess ? (
            <p className="text-sm text-[var(--color-primary)]" role="status">
              {t("profile.passwordChanged")}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={passwordLoading || !currentPassword}>
            {passwordLoading ? t("common.loading") : t("profile.changePassword")}
          </Button>
        </form>
      </PageCard>
    </PageShell>
  );
}
