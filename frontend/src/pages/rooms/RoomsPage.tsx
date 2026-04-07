// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, DoorOpen } from "lucide-react";
import { api, userFacingApiError } from "../../lib/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { JoinResult, Paginated, Room, RoomStats } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { RoomCard } from "../../components/rooms/RoomCard";
import { RoomFormModal } from "../../components/rooms/RoomFormModal";
import { ArchiveRoomModal } from "../../components/rooms/ArchiveRoomModal";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";

type ActiveFilter = "all" | "active" | "inactive";

function canManageRoom(user: { id: string; role: string } | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

function canAddRoom(user: { role: string } | null): boolean {
  if (!user) return false;
  return user.role === "teacher" || user.role === "admin";
}

export function RoomsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [stats, setStats] = useState<RoomStats | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Room | null>(null);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);

  const fetchRoomsPage = useCallback(async () => {
    return Promise.all([
      api.get<RoomStats>("rooms/stats"),
      api.get<Paginated<Room>>("rooms", {
        params: {
          ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
          ...(activeFilter === "all" ? {} : { active: activeFilter === "active" }),
        },
      }),
    ]);
  }, [debouncedSearch, activeFilter]);

  const refreshAll = useCallback(async () => {
    const [statsRes, roomsRes] = await fetchRoomsPage();
    setStats(statsRes.data);
    setRooms(roomsRes.data.items);
  }, [fetchRoomsPage]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [statsRes, roomsRes] = await fetchRoomsPage();
        if (cancelled) return;
        setStats(statsRes.data);
        setRooms(roomsRes.data.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRoomsPage]);

  function openCreate() {
    setFormMode("create");
    setEditingRoom(null);
    setFormOpen(true);
  }

  function openEdit(r: Room) {
    setFormMode("edit");
    setEditingRoom(r);
    setFormOpen(true);
  }

  function openArchive(r: Room) {
    setArchiveTarget(r);
    setArchiveOpen(true);
  }

  async function restoreRoom(r: Room) {
    try {
      await api.put(`rooms/${r.id}`, { is_active: true });
      await refreshAll();
    } catch {
      /* toast or surface error — optional */
    }
  }

  async function handleJoin(room: Room) {
    if (joinLoading) return;
    setJoinLoading(room.id);
    setJoinMessage(null);
    try {
      const { data } = await api.post<JoinResult>(`rooms/${room.id}/join`);
      setJoinMessage(data.status === "pending" ? t("enrollment.requestSent") : t("enrollment.joinedSuccess"));
      await refreshAll();
    } catch (err) {
      setJoinMessage(userFacingApiError(err));
    } finally {
      setJoinLoading(null);
      setTimeout(() => setJoinMessage(null), 4000);
    }
  }

  const statsRow = stats ? (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {[
        { label: t("rooms.statsTotalLabel"), value: stats.total },
        { label: t("rooms.statsActiveLabel"), value: stats.active },
        { label: t("rooms.statsInactiveLabel"), value: stats.inactive },
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
        { label: t("rooms.title") },
      ]}
      title={t("rooms.title")}
      actions={
        isAdmin || canAddRoom(user) ? (
          <>
            {isAdmin ? (
              <Button type="button" variant="secondary" asChild>
                <Link to="/rooms/archived">{t("nav.archivedRooms")}</Link>
              </Button>
            ) : null}
            {canAddRoom(user) ? (
              <Button type="button" variant="primary" onClick={openCreate}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t("rooms.addRoom")}
                </span>
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {joinMessage ? (
        <div
          className="rounded-xl border border-gray-200 bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)]"
          role="status"
        >
          {joinMessage}
        </div>
      ) : null}

      <PageCard>
        <Input
          label={t("common.search")}
          name="search"
          placeholder={t("rooms.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {(
            [
              ["all", t("common.all")],
              ["active", t("common.active")],
              ["inactive", t("common.inactive")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeFilter === value
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
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-[var(--color-surface)] py-16 text-center text-[var(--color-text-muted)]">
          <DoorOpen className="mb-4 h-14 w-14 opacity-40" />
          <p>{t("rooms.noRooms")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              canManage={canManageRoom(user, r)}
              user={user}
              onJoin={user?.role === "student" ? handleJoin : undefined}
              joinLoadingId={joinLoading}
              onEdit={() => openEdit(r)}
              onArchive={() => openArchive(r)}
              onRestore={() => void restoreRoom(r)}
            />
          ))}
        </div>
      )}

      <RoomFormModal
        open={formOpen}
        mode={formMode}
        room={editingRoom}
        isAdmin={isAdmin}
        onClose={() => setFormOpen(false)}
        onSaved={() => void refreshAll()}
      />

      <ArchiveRoomModal
        open={archiveOpen}
        roomId={archiveTarget?.id ?? null}
        roomName={archiveTarget?.name ?? ""}
        onClose={() => {
          setArchiveOpen(false);
          setArchiveTarget(null);
        }}
        onArchived={() => void refreshAll()}
      />
    </PageShell>
  );
}
