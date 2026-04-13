// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, type ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Direction } from "radix-ui";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { QfCallbackPage } from "./pages/auth/QfCallbackPage";
import { RoleSelectionPage } from "./pages/auth/RoleSelectionPage";
import { ProtectedRoute } from "./components/ui/ProtectedRoute";
import { RoleSelectionGuard } from "./components/auth/RoleSelectionGuard";
import { AdminRoute } from "./components/ui/AdminRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { HomePage } from "./pages/HomePage";
import { UsersPage } from "./pages/users/UsersPage";
import { UserDetailPage } from "./pages/users/UserDetailPage";
import { RoomsPage } from "./pages/rooms/RoomsPage";
import { ArchivedRoomsPage } from "./pages/rooms/ArchivedRoomsPage";
import { RoomDetailPage } from "./pages/rooms/RoomDetailPage";
import { CalendarPage } from "./pages/sessions/CalendarPage";
import { SessionDetailPage } from "./pages/sessions/SessionDetailPage";
import { StudentRecitationPage } from "./pages/sessions/StudentRecitationPage";
import { LiveSessionPage } from "./pages/sessions/LiveSessionPage";
import { LiveSessionsPage } from "./pages/sessions/LiveSessionsPage";
import { RecitationsPage } from "./pages/recitations/RecitationsPage";
import { StudentProgressPage } from "./pages/recitations/StudentProgressPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { AccountLinksPage } from "./pages/settings/AccountLinksPage";
import { MushafPage } from "./pages/mushaf/MushafPage";
import { useAuthStore } from "./stores/authStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LiveSessionsProvider } from "./contexts/LiveSessionsContext";

/** Radix `useDirection()` defaults to LTR unless this provider is set; it does not read `document.dir`. */
function RadixDirectionProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const base = (i18n.language || "ar").split("-")[0] ?? "ar";
  const dir = base === "ar" ? "rtl" : "ltr";
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/auth/qf/callback", element: <QfCallbackPage /> },
  {
    path: "/auth/role-selection",
    element: (
      <ProtectedRoute>
        <RoleSelectionPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/sessions/:id/live",
    element: (
      <ProtectedRoute>
        <RoleSelectionGuard>
          <LiveSessionPage />
        </RoleSelectionGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <RoleSelectionGuard>
          <AppLayout />
        </RoleSelectionGuard>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "users",
        element: (
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        ),
      },
      {
        path: "users/:id",
        element: (
          <AdminRoute>
            <UserDetailPage />
          </AdminRoute>
        ),
      },
      { path: "rooms", element: <RoomsPage /> },
      {
        path: "rooms/archived",
        element: (
          <AdminRoute>
            <ArchivedRoomsPage />
          </AdminRoute>
        ),
      },
      { path: "rooms/:id", element: <RoomDetailPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "sessions/:id", element: <SessionDetailPage /> },
      {
        path: "sessions/:sessionId/students/:studentId",
        element: <StudentRecitationPage />,
      },
      { path: "recitations", element: <RecitationsPage /> },
      { path: "live", element: <LiveSessionsPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <AccountLinksPage /> },
      { path: "students/:id/progress", element: <StudentProgressPage /> },
      { path: "mushaf", element: <Navigate to="/mushaf/1" replace /> },
      { path: "mushaf/:page", element: <MushafPage /> },
    ],
  },
]);

function RouterWithAuth() {
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <RadixDirectionProvider>
      <TooltipProvider delayDuration={300} skipDelayDuration={200}>
        <LiveSessionsProvider>
          <div className="flex min-h-[100dvh] w-full min-w-0 flex-1 flex-col">
            <RouterWithAuth />
          </div>
        </LiveSessionsProvider>
      </TooltipProvider>
    </RadixDirectionProvider>
  );
}
