// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import type { UserPublic } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { UserFormModal } from "../../components/users/UserFormModal";
import { DeleteConfirmModal } from "../../components/users/DeleteConfirmModal";
import { BackLink } from "../../components/navigation/BackLink";
import { roleTranslationKey } from "../../lib/roleLabels";
import { useLocaleDate } from "../../hooks/useLocaleDate";

type RoleBadge = "green" | "blue" | "gold";

function badgeVariant(role: UserPublic["role"]): RoleBadge {
  if (role === "teacher") return "blue";
  if (role === "admin") return "gold";
  return "green";
}

export function UserDetailPage() {
  const { t } = useTranslation();
  const { full } = useLocaleDate();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get<UserPublic>(`users/${id}`);
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p className="text-[var(--color-text-muted)]">{t("users.userNotFound")}</p>
        <Link to="/users" className="mt-4 inline-block text-[var(--color-primary)]">
          {t("users.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink to="/users">{t("users.backToList")}</BackLink>

      <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{user.name}</h1>
            <p className="mt-1 text-[var(--color-text-muted)]">{user.email}</p>
            <div className="mt-3">
              <Badge variant={badgeVariant(user.role)}>{t(roleTranslationKey(user.role))}</Badge>
            </div>
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">
              {t("users.registrationDate")}: {full(user.created_at)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </span>
            </Button>
            <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {t("common.delete")}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <UserFormModal
        open={formOpen}
        mode="edit"
        user={user}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        userId={user.id}
        userName={user.name}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate("/users", { replace: true })}
      />
    </div>
  );
}
