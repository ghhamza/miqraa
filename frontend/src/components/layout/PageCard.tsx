// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageCardProps extends React.ComponentProps<"div"> {
  /** Default: comfortable padding for forms and lists */
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClass: Record<NonNullable<PageCardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-4 md:p-6",
  lg: "p-5 md:p-8",
};

/**
 * Standard white surface card: rounded corners, light border, used for filters, tables, and sections.
 */
export function PageCard({ className, padding = "md", children, ...props }: PageCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-100 bg-[var(--color-surface)] shadow-sm",
        padding !== "none" ? paddingClass[padding] : null,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
