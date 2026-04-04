// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { QuranRiwaya } from "../types";

export function riwayaBadgeClass(r: QuranRiwaya): string {
  switch (r) {
    case "hafs":
      return "bg-[#1B5E20] text-white border-[#1B5E20]";
    case "warsh":
      return "bg-blue-600 text-white border-blue-600";
    case "qalun":
      return "bg-purple-600 text-white border-purple-600";
    default:
      return "bg-gray-500 text-white";
  }
}
