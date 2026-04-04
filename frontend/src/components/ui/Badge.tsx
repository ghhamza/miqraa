// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ReactNode } from "react";

type Variant = "green" | "blue" | "gold" | "gray";

const styles: Record<Variant, string> = {
  green: "bg-emerald-100 text-emerald-900 border-emerald-200",
  blue: "bg-blue-100 text-blue-900 border-blue-200",
  gold: "bg-amber-100 text-amber-900 border-amber-300",
  gray: "bg-gray-100 text-gray-700 border-gray-200",
};

interface BadgeProps {
  variant: Variant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
