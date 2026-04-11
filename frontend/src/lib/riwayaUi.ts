// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { QuranRiwaya } from "../types";

const BADGE: Record<QuranRiwaya, string> = {
  hafs: "bg-[#1B5E20] text-white border-[#1B5E20]",
  shubah: "bg-emerald-800 text-white border-emerald-800",
  warsh: "bg-blue-600 text-white border-blue-600",
  qalun: "bg-purple-600 text-white border-purple-600",
  qunbul: "bg-indigo-600 text-white border-indigo-600",
  bazzi: "bg-indigo-800 text-white border-indigo-800",
  doori: "bg-teal-600 text-white border-teal-600",
  susi: "bg-teal-800 text-white border-teal-800",
  hisham: "bg-cyan-700 text-white border-cyan-700",
  ibn_dhakwan: "bg-cyan-900 text-white border-cyan-900",
  khalaf: "bg-amber-700 text-white border-amber-700",
  khallad: "bg-amber-900 text-white border-amber-900",
  doori_kisai: "bg-rose-600 text-white border-rose-600",
  abu_harith: "bg-rose-800 text-white border-rose-800",
};

export function riwayaBadgeClass(r: QuranRiwaya): string {
  return BADGE[r] ?? "bg-gray-500 text-white border-gray-500";
}
