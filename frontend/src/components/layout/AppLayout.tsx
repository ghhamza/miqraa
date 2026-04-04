// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Menu, ScrollText, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import type { RoomStats } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { roleTranslationKey } from "../../lib/roleLabels";

function roleBadgeVariant(role: string): "green" | "blue" | "gold" {
  if (role === "teacher") return "blue";
  if (role === "admin") return "gold";
  return "green";
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const isMushafRoute = location.pathname.startsWith("/mushaf");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roomCount, setRoomCount] = useState<number | null>(null);

  const isRtl = i18n.language === "ar";
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) {
      setRoomCount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<RoomStats>("rooms/stats");
        if (!cancelled) setRoomCount(data.total);
      } catch {
        if (!cancelled) setRoomCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
        : "text-[var(--color-text-muted)] hover:bg-gray-100 hover:text-[var(--color-text)]"
    }`;

  const sidebarPosition = isRtl ? "right-0 border-l" : "left-0 border-r";
  const sidebarTranslate = sidebarOpen
    ? "translate-x-0"
    : isRtl
      ? "translate-x-full md:translate-x-0"
      : "-translate-x-full md:translate-x-0";

  return (
    <div
      className={`flex min-h-screen bg-[var(--color-bg)] ${isRtl ? "flex-row-reverse" : "flex-row"}`}
    >
      <aside
        className={`fixed inset-y-0 z-40 flex w-64 flex-col border-gray-200 bg-[var(--color-surface)] shadow-sm transition-transform duration-200 md:static md:translate-x-0 ${sidebarPosition} ${sidebarTranslate}`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <h1
            className="text-xl font-bold text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-quran)" }}
          >
            {t("common.appName")}
          </h1>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--color-text-muted)] md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={t("common.closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <NavLink to="/" end className={navClass} onClick={() => setSidebarOpen(false)}>
            {t("nav.home")}
          </NavLink>
          {isAdmin ? (
            <NavLink to="/users" className={navClass} onClick={() => setSidebarOpen(false)}>
              {t("nav.users")}
            </NavLink>
          ) : null}
          <NavLink to="/rooms" className={navClass} onClick={() => setSidebarOpen(false)}>
            <span className="flex items-center justify-between gap-2">
              <span>{t("nav.rooms")}</span>
              {roomCount !== null ? (
                <span
                  className="min-w-[1.25rem] rounded-full bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-center text-xs font-semibold text-[var(--color-primary)]"
                  aria-label={`${t("nav.rooms")}: ${roomCount}`}
                >
                  {roomCount > 99 ? "99+" : roomCount}
                </span>
              ) : null}
            </span>
          </NavLink>
          <NavLink to="/calendar" className={navClass} onClick={() => setSidebarOpen(false)}>
            {t("nav.calendar")}
          </NavLink>
          <NavLink to="/mushaf" className={navClass} onClick={() => setSidebarOpen(false)}>
            <span className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t("nav.mushaf")}
            </span>
          </NavLink>
          <NavLink to="/recitations" className={navClass} onClick={() => setSidebarOpen(false)}>
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t("nav.recitations")}
            </span>
          </NavLink>
        </nav>

        <div className="border-t border-gray-100 p-4">
          <LanguageSwitcher className="mb-4 w-full justify-center" />
          <div className="mb-3 flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--color-text)]">{user?.name}</span>
            {user ? (
              <Badge variant={roleBadgeVariant(user.role)}>{t(roleTranslationKey(user.role))}</Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            {t("auth.logout")}
          </Button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-label={t("common.close")}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-100 bg-[var(--color-surface)] px-4 py-3 md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--color-text)]"
            onClick={() => setSidebarOpen(true)}
            aria-label={t("common.openMenu")}
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold" style={{ fontFamily: "var(--font-quran)" }}>
            {t("common.appName")}
          </span>
        </header>

        <main
          className={`flex-1 ${isMushafRoute ? "p-3 md:p-4" : "p-4 md:p-8"}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
