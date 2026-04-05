// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, LogOut, Menu, ScrollText, User } from "lucide-react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import type { RoomStats } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { roleTranslationKey } from "../../lib/roleLabels";
import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "../ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Avatar, AvatarFallback } from "../ui/avatar";

/** Up to two letters: first + last word, or first two chars of a single name. */
function nameToInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[parts.length - 1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }
  const w = parts[0] ?? trimmed;
  if (w.length <= 2) return w.toUpperCase();
  return w.slice(0, 2).toUpperCase();
}

function roleBadgeVariant(role: string): "green" | "blue" | "gold" {
  if (role === "teacher") return "blue";
  if (role === "admin") return "gold";
  return "green";
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const isMushafRoute = location.pathname.startsWith("/mushaf");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [roomCount, setRoomCount] = useState<number | null>(null);

  const localeBase = (i18n.language || "ar").split("-")[0] ?? "ar";
  const isRtl = localeBase === "ar";
  const isAdmin = user?.role === "admin";
  const roomsBadgeCount = user ? roomCount : null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close drawer on route change (incl. back/forward)
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
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
  }, [user]);

  const sheetSide = isRtl ? "right" : "left";

  const roomsLabel = (
    <span className="inline-flex items-center gap-2">
      <span>{t("nav.rooms")}</span>
      {roomsBadgeCount !== null ? (
        <span
          className="min-w-[1.25rem] rounded-full bg-primary/15 px-1.5 py-0.5 text-center text-xs font-semibold text-primary"
          aria-label={`${t("nav.rooms")}: ${roomsBadgeCount}`}
        >
          {roomsBadgeCount > 99 ? "99+" : roomsBadgeCount}
        </span>
      ) : null}
    </span>
  );

  function renderNavLinks(orientation: "row" | "column") {
    const stack = orientation === "column" ? "flex flex-col gap-1" : "";
    const linkWrap = orientation === "column" ? "w-full" : "";

    return (
      <div className={cn(stack)}>
        <NavLink to="/" end className={cn(navLinkClass, linkWrap)} onClick={() => setMobileNavOpen(false)}>
          {t("nav.home")}
        </NavLink>
        {isAdmin ? (
          <NavLink to="/users" className={cn(navLinkClass, linkWrap)} onClick={() => setMobileNavOpen(false)}>
            {t("nav.users")}
          </NavLink>
        ) : null}
        <NavLink to="/rooms" className={cn(navLinkClass, linkWrap)} onClick={() => setMobileNavOpen(false)}>
          {roomsLabel}
        </NavLink>
        <NavLink to="/calendar" className={cn(navLinkClass, linkWrap)} onClick={() => setMobileNavOpen(false)}>
          {t("nav.calendar")}
        </NavLink>
        <NavLink to="/mushaf" className={cn(navLinkClass, linkWrap)} onClick={() => setMobileNavOpen(false)}>
          <span className="inline-flex items-center gap-2">
            <ScrollText className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {t("nav.mushaf")}
          </span>
        </NavLink>
        <NavLink to="/recitations" className={cn(navLinkClass, linkWrap)} onClick={() => setMobileNavOpen(false)}>
          <span className="inline-flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {t("nav.recitations")}
          </span>
        </NavLink>
        <NavLink to="/profile" className={cn(navLinkClass, linkWrap)} onClick={() => setMobileNavOpen(false)}>
          <span className="inline-flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {t("nav.profile")}
          </span>
        </NavLink>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col bg-[var(--color-bg)]">
      <header className="sticky top-0 z-40 w-full min-w-0 border-b border-border bg-[var(--color-surface)] shadow-sm">
        <div className="mx-auto flex w-full max-w-[100%] min-w-0 flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 md:gap-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none md:items-stretch">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                  aria-label={t("common.openMenu")}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={sheetSide} className="flex w-[min(100%,20rem)] flex-col gap-0 bg-[var(--color-surface)] p-0">
                <SheetHeader className="border-b border-border px-4 py-4 text-start">
                  <SheetTitle style={{ fontFamily: "var(--font-quran)" }} className="text-xl font-bold">
                    {t("common.appName")}
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-1 flex-col gap-1 p-4" role="navigation">
                  {renderNavLinks("column")}
                </nav>
                <div className="mt-auto border-t border-border p-4">
                  <LanguageSwitcher fullWidth className="mb-4" />
                  <div className="mb-3 flex flex-col gap-1">
                    <span className="text-sm font-semibold text-foreground">{user?.name}</span>
                    {user ? (
                      <Badge variant={roleBadgeVariant(user.role)} className="w-fit">
                        {t(roleTranslationKey(user.role))}
                      </Badge>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      logout();
                      navigate("/login", { replace: true });
                      setMobileNavOpen(false);
                    }}
                  >
                    {t("auth.logout")}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <h1
              className="min-w-0 truncate text-lg font-bold text-foreground sm:text-xl"
              style={{ fontFamily: "var(--font-quran)" }}
            >
              {t("common.appName")}
            </h1>
          </div>

          <NavigationMenu viewport={false} className="hidden max-w-none flex-1 justify-center md:flex">
            <NavigationMenuList className="flex flex-wrap items-center justify-center gap-0.5">
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <NavLink to="/" end className={navLinkClass}>
                    {t("nav.home")}
                  </NavLink>
                </NavigationMenuLink>
              </NavigationMenuItem>
              {isAdmin ? (
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <NavLink to="/users" className={navLinkClass}>
                      {t("nav.users")}
                    </NavLink>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ) : null}
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <NavLink to="/rooms" className={navLinkClass}>
                    {roomsLabel}
                  </NavLink>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <NavLink to="/calendar" className={navLinkClass}>
                    {t("nav.calendar")}
                  </NavLink>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <NavLink to="/mushaf" className={navLinkClass}>
                    <span className="inline-flex items-center gap-2">
                      <ScrollText className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      {t("nav.mushaf")}
                    </span>
                  </NavLink>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <NavLink to="/recitations" className={navLinkClass}>
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      {t("nav.recitations")}
                    </span>
                  </NavLink>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher className="shrink-0" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "rounded-full outline-none ring-offset-background transition-opacity hover:opacity-95",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  aria-label={user?.name ?? t("common.appName")}
                >
                  <Avatar className="size-9 border border-border">
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {user?.name ? nameToInitials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56" sideOffset={6}>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1.5 py-0.5">
                    <span className="text-sm font-semibold text-foreground">{user?.name}</span>
                    {user ? (
                      <Badge variant={roleBadgeVariant(user.role)} className="w-fit">
                        {t(roleTranslationKey(user.role))}
                      </Badge>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => navigate("/profile")}
                >
                  <User className="h-4 w-4" />
                  {t("nav.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer gap-2"
                  onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "w-full min-w-0 max-w-full flex-1",
          isMushafRoute
            ? "flex min-h-0 flex-col overflow-hidden p-1 sm:p-2 md:p-3 lg:p-4"
            : "p-3 sm:p-4 md:p-6 lg:p-8",
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
