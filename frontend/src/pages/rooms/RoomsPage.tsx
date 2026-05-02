// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, DoorOpen } from "lucide-react";
import { api, userFacingApiError } from "../../lib/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { HalaqahType, JoinResult, Paginated, Room, RoomStats } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { RoomCard } from "../../components/rooms/RoomCard";
import { RoomFormModal } from "../../components/rooms/RoomFormModal";
import { ArchiveRoomModal } from "../../components/rooms/ArchiveRoomModal";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { RoomFilters, type FilterRiwaya, type ActiveFilter } from "../../components/rooms/RoomFilters";
import { cn } from "@/lib/utils";

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
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [halaqahFilter, setHalaqahFilter] = useState<HalaqahType | "">("");
  const [riwayaFilter, setRiwayaFilter] = useState<FilterRiwaya | "">("");
  const [myStatusFilter, setMyStatusFilter] = useState<"" | "approved" | "pending">("");
  const [showRejected, setShowRejected] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Room | null>(null);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const scrolledPendingRef = useRef(false);

  const roomsQuery = useQuery({
    queryKey: ["rooms", debouncedSearch, activeFilter, halaqahFilter, riwayaFilter, myStatusFilter, user?.role] as const,
    queryFn: async ({ signal }) => {
      const [statsRes, roomsRes] = await Promise.all([
        api.get<RoomStats>("rooms/stats", { signal }),
        api.get<Paginated<Room>>("rooms", {
          signal,
          params: {
            ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
            ...(activeFilter === "all" ? {} : { active: activeFilter === "active" }),
            ...(halaqahFilter ? { halaqah_type: halaqahFilter } : {}),
            ...(riwayaFilter ? { riwaya: riwayaFilter } : {}),
            ...(user?.role === "student" && myStatusFilter
              ? { my_status: myStatusFilter }
              : {}),
          },
        }),
      ]);
      return { stats: statsRes.data, rooms: roomsRes.data.items };
    },
  });

  const stats = roomsQuery.data?.stats ?? null;
  const rooms = roomsQuery.data?.rooms ?? [];
  const loading = roomsQuery.isPending;

  const displayRooms = useMemo(() => {
    if (user?.role !== "student" || myStatusFilter !== "" || showRejected) return rooms;
    return rooms.filter((r) => r.my_status !== "rejected");
  }, [rooms, user?.role, myStatusFilter, showRejected]);

  const anyFilterApplied =
    debouncedSearch.trim() !== "" ||
    activeFilter !== "active" ||
    halaqahFilter !== "" ||
    riwayaFilter !== "" ||
    myStatusFilter !== "";

  const allHiddenRejected =
    user?.role === "student" &&
    myStatusFilter === "" &&
    !showRejected &&
    rooms.length > 0 &&
    rooms.every((r) => r.my_status === "rejected");

  useEffect(() => {
    if (searchParams.get("pending") !== "1") {
      scrolledPendingRef.current = false;
      return;
    }
    if (loading || displayRooms.length === 0) return;
    if (scrolledPendingRef.current) return;
    scrolledPendingRef.current = true;
    requestAnimationFrame(() => {
      document.querySelector("[data-room-id]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [searchParams, loading, displayRooms.length]);

  const refreshAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["rooms"] });
  }, [queryClient]);

  function clearAllFilters() {
    setSearch("");
    setActiveFilter("active");
    setHalaqahFilter("");
    setRiwayaFilter("");
    setMyStatusFilter("");
    setShowRejected(false);
  }

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
      /* optional */
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

  const hasRejectedInResults =
    user?.role === "student" && myStatusFilter === "" && rooms.some((r) => r.my_status === "rejected");

  const statsRow = stats
    ? (() => {
        if (user?.role === "student") {
          // Students don't need stat cards — the tabs and the room grid already show this info.
          return null;
        }
        return (
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
        );
      })()
    : null;

  function renderMainContent() {
    if (loading) {
      return (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      );
    }

    if (user?.role === "student" && myStatusFilter === "approved" && rooms.length === 0) {
      return (
        <EmptyState
          icon={<DoorOpen className="h-12 w-12" />}
          title={t("rooms.emptyMyRoomsTitle")}
          description={t("rooms.emptyMyRoomsDescription")}
          primaryAction={{
            label: t("rooms.tabAll"),
            onClick: () => setMyStatusFilter(""),
          }}
        />
      );
    }

    if (user?.role === "student" && myStatusFilter === "pending" && rooms.length === 0) {
      return (
        <EmptyState
          icon={<DoorOpen className="h-12 w-12" />}
          title={t("rooms.emptyPendingTitle")}
          description={t("rooms.emptyPendingDescription")}
          primaryAction={{
            label: t("rooms.tabAll"),
            onClick: () => setMyStatusFilter(""),
          }}
        />
      );
    }

    if (rooms.length === 0) {
      if (anyFilterApplied) {
        return (
          <EmptyState
            icon={<DoorOpen className="h-12 w-12" />}
            title={t("rooms.noMatchesTitle")}
            description={t("rooms.noMatchesDescription")}
            primaryAction={{
              label: t("rooms.clearFilters"),
              onClick: clearAllFilters,
            }}
            secondaryAction={
              isAdmin && (stats?.archived_count ?? 0) > 0
                ? { label: t("nav.archivedRooms"), to: "/rooms/archived" }
                : undefined
            }
          />
        );
      }

      if (user?.role === "admin") {
        return (
          <EmptyState
            size="large"
            icon={<DoorOpen className="h-16 w-16" />}
            title={t("rooms.emptyAdminTitle")}
            description={t("rooms.emptyAdminDescription")}
          />
        );
      }

      if (user?.role === "teacher") {
        return (
          <EmptyState
            size="large"
            icon={<DoorOpen className="h-16 w-16" />}
            title={t("rooms.emptyTeacherTitle")}
            description={t("rooms.emptyTeacherDescription")}
            primaryAction={{
              label: t("rooms.addRoom"),
              onClick: openCreate,
            }}
          />
        );
      }

      return (
        <EmptyState
          size="large"
          icon={<DoorOpen className="h-16 w-16" />}
          title={t("rooms.emptyStudentTitle")}
          description={t("rooms.emptyStudentDescription")}
        />
      );
    }

    if (displayRooms.length === 0) {
      if (allHiddenRejected) {
        return (
          <EmptyState
            icon={<DoorOpen className="h-12 w-12" />}
            title={t("rooms.noMatchesTitle")}
            description={t("rooms.rejectedHiddenHint")}
            primaryAction={{
              label: t("rooms.showRejected"),
              onClick: () => setShowRejected(true),
            }}
          />
        );
      }
      if (anyFilterApplied) {
        return (
          <EmptyState
            icon={<DoorOpen className="h-12 w-12" />}
            title={t("rooms.noMatchesTitle")}
            description={t("rooms.noMatchesDescription")}
            primaryAction={{
              label: t("rooms.clearFilters"),
              onClick: clearAllFilters,
            }}
            secondaryAction={
              isAdmin && (stats?.archived_count ?? 0) > 0
                ? { label: t("nav.archivedRooms"), to: "/rooms/archived" }
                : undefined
            }
          />
        );
      }
      return (
        <EmptyState
          icon={<DoorOpen className="h-12 w-12" />}
          title={t("rooms.noMatchesTitle")}
          description={t("rooms.noMatchesDescription")}
          primaryAction={{
            label: t("rooms.clearFilters"),
            onClick: clearAllFilters,
          }}
          secondaryAction={
            isAdmin && (stats?.archived_count ?? 0) > 0
              ? { label: t("nav.archivedRooms"), to: "/rooms/archived" }
              : undefined
          }
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {displayRooms.map((r) => (
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
    );
  }

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
      {user?.role === "student" ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 border-b border-gray-100">
            {(
              [
                { value: "" as const, label: t("rooms.tabAll") },
                { value: "approved" as const, label: t("rooms.tabMyRooms") },
                { value: "pending" as const, label: t("rooms.tabPending") },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setMyStatusFilter(value)}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition",
                  myStatusFilter === value
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {hasRejectedInResults ? (
            <button
              type="button"
              onClick={() => setShowRejected((v) => !v)}
              className="w-fit text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
            >
              {showRejected ? t("rooms.hideRejected") : t("rooms.showRejected")}
            </button>
          ) : null}
        </div>
      ) : null}

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
        <div className="mt-4">
          <RoomFilters
            halaqahType={halaqahFilter}
            riwaya={riwayaFilter}
            activeFilter={activeFilter}
            onHalaqahTypeChange={setHalaqahFilter}
            onRiwayaChange={setRiwayaFilter}
            onActiveFilterChange={setActiveFilter}
          />
        </div>
      </PageCard>

      {renderMainContent()}

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
