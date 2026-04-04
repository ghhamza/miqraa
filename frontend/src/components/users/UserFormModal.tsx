// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { UserPublic } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

interface UserFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  user: UserPublic | null;
  onClose: () => void;
  onSaved: () => void;
}

export function UserFormModal({
  open,
  mode,
  user,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "teacher" | "admin">("student");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setPassword("");
    } else {
      setName("");
      setEmail("");
      setRole("student");
      setPassword("");
    }
  }, [open, mode, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "create") {
        if (password.length < 8) {
          setError(t("auth.passwordMin"));
          setLoading(false);
          return;
        }
        await api.post("users", {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        });
      } else if (user) {
        await api.put(`users/${user.id}`, {
          name: name.trim(),
          email: email.trim(),
          role,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(userFacingApiError(err, "users.saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? t("users.addUserModal") : t("users.editUserModal")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t("auth.name")}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label={t("auth.email")}
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
            {t("users.roleField")}
          </label>
          <select
            className="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] px-3 py-2.5 text-start focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="student">{t("auth.student")}</option>
            <option value="teacher">{t("auth.teacher")}</option>
            <option value="admin">{t("auth.admin")}</option>
          </select>
        </div>
        {mode === "create" ? (
          <Input
            label={t("auth.password")}
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        ) : null}
        {error ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
