// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { HalaqahType } from "../types";

const BADGE: Record<HalaqahType, string> = {
  hifz: "border-[#1B5E20]/40 bg-[#1B5E20]/90 text-white",
  tilawa: "border-blue-700/40 bg-blue-600 text-white",
  muraja: "border-amber-700/40 bg-amber-600 text-white",
  tajweed: "border-purple-700/40 bg-purple-600 text-white",
};

export function halaqahBadgeClass(h: HalaqahType): string {
  return BADGE[h] ?? "border-gray-400 bg-gray-500 text-white";
}
