// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export function RoleSelectionGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (user?.role_selection_pending && location.pathname !== "/auth/role-selection") {
    return <Navigate to="/auth/role-selection" replace />;
  }

  return <>{children}</>;
}
