// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { api } from "../../lib/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import type { Paginated, UserPublic, UserStats } from "../../types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, type TableColumn } from "../../components/ui/Table";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { UserFormModal } from "../../components/users/UserFormModal";
import { DeleteConfirmModal } from "../../components/users/DeleteConfirmModal";
import { roleTranslationKey } from "../../lib/roleLabels";

type RoleFilter = "" | "student" | "teacher" | "admin";

function badgeVariant(role: UserPublic["role"]): "green" | "blue" | "gold" {
  if (role === "teacher") return "blue";
  if (role === "admin") return "gold";
  return "green";
}

export function UsersPage() {
  const { t } = useTranslation();
  const { mediumTime } = useLocaleDate();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<UserPublic | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserPublic | null>(null);

  /** Shared fetch; callers decide when to commit to React state (avoids stale tab overwrites). */
  const fetchUsersPage = useCallback(async () => {
    return Promise.all([
      api.get<UserStats>("users/stats"),
      api.get<Paginated<UserPublic>>("users", {
        params: {
          ...(roleFilter ? { role: roleFilter } : {}),
          ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
        },
      }),
    ]);
  }, [roleFilter, debouncedSearch]);

  const refreshAll = useCallback(async () => {
    const [statsRes, usersRes] = await fetchUsersPage();
    setStats(statsRes.data);
    setUsers(usersRes.data.items);
  }, [fetchUsersPage]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [statsRes, usersRes] = await fetchUsersPage();
        if (cancelled) return;
        setStats(statsRes.data);
        setUsers(usersRes.data.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUsersPage]);

  const openCreate = useCallback(() => {
    setFormMode("create");
    setEditingUser(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((u: UserPublic) => {
    setFormMode("edit");
    setEditingUser(u);
    setFormOpen(true);
  }, []);

  const openDelete = useCallback((u: UserPublic) => {
    setDeleteTarget(u);
    setDeleteOpen(true);
  }, []);

  const columns: TableColumn<UserPublic>[] = [
      {
        key: "name",
        header: t("users.name"),
        render: (row) => (
          <Link to={`/users/${row.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
            {row.name}
          </Link>
        ),
      },
      { key: "email", header: t("users.email"), render: (row) => row.email },
      {
        key: "role",
        header: t("users.role"),
        render: (row) => (
          <Badge variant={badgeVariant(row.role)}>{t(roleTranslationKey(row.role))}</Badge>
        ),
      },
      {
        key: "created_at",
        header: t("users.registrationDate"),
        render: (row) => mediumTime(row.created_at),
      },
      {
        key: "actions",
        header: t("common.actions"),
        render: (row) => (
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
              aria-label={t("common.edit")}
              onClick={() => openEdit(row)}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
              aria-label={t("common.delete")}
              onClick={() => openDelete(row)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ];

  const statsRow = stats ? (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[
        { label: t("home.totalUsers"), value: stats.total },
        { label: t("home.students"), value: stats.students },
        { label: t("home.teachers"), value: stats.teachers },
        { label: t("home.admins"), value: stats.admins },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm"
        >
          <p className="text-sm text-[var(--color-text-muted)]">{s.label}</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: "var(--color-gold)" }}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <PageShell
      stats={statsRow}
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("users.title") },
      ]}
      title={t("users.title")}
      actions={
        <Button type="button" variant="primary" onClick={openCreate}>
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("users.addUser")}
          </span>
        </Button>
      }
    >
      <PageCard>
        <Input
          label={t("common.search")}
          name="search"
          placeholder={t("users.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {(
            [
              ["", t("users.tabsAll")],
              ["student", t("users.tabsStudents")],
              ["teacher", t("users.tabsTeachers")],
              ["admin", t("users.tabsAdmins")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setRoleFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                roleFilter === value
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-gray-100 text-[var(--color-text-muted)] hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </PageCard>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
        <Table
          columns={columns}
          data={users}
          rowKey={(r) => r.id}
          emptyMessage={t("users.noUsers")}
          emptyIcon={<Users className="mx-auto h-12 w-12 text-gray-300" />}
        />
      )}

      <UserFormModal
        open={formOpen}
        mode={formMode}
        user={editingUser}
        onClose={() => setFormOpen(false)}
        onSaved={() => void refreshAll()}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        userId={deleteTarget?.id ?? null}
        userName={deleteTarget?.name ?? ""}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onDeleted={() => void refreshAll()}
      />
    </PageShell>
  );
}
