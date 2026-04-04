// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { User } from "../types";

/** i18n key under `auth.*` for role badge labels */
export function roleTranslationKey(role: User["role"]): "auth.student" | "auth.teacher" | "auth.admin" {
  switch (role) {
    case "student":
      return "auth.student";
    case "teacher":
      return "auth.teacher";
    case "admin":
      return "auth.admin";
    default:
      return "auth.student";
  }
}
