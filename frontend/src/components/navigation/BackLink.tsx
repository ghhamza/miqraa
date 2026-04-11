// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Link, type LinkProps } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** “Back” navigation: arrow points left in LTR, right in RTL (reading-direction). */
export function BackLink({ className, children, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline",
        className,
      )}
      {...props}
    >
      <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
      {children}
    </Link>
  );
}
