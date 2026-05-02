// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick?: () => void; to?: string };
  secondaryAction?: { label: string; onClick?: () => void; to?: string };
  className?: string;
  size?: "default" | "large";
}

/**
 * Smoke: `<EmptyState title="Test" description="Hello" primaryAction={{ label: "Click", onClick: () => {} }} />`
 */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  size = "default",
}: EmptyStateProps) {
  const isLarge = size === "large";
  const pad = isLarge ? "py-24 px-8" : "py-16 px-6";
  const iconWrap = isLarge ? "h-16 w-16 [&>svg]:h-16 [&>svg]:w-16" : "h-10 w-10 [&>svg]:h-10 [&>svg]:w-10";
  const titleCls = isLarge ? "text-2xl font-semibold text-[var(--color-text)]" : "text-lg font-semibold text-[var(--color-text)]";

  function renderAction(
    action: { label: string; onClick?: () => void; to?: string },
    variant: "primary" | "secondary",
  ) {
    if (action.to) {
      return (
        <Button variant={variant} className="w-full sm:w-auto" asChild>
          <Link to={action.to}>{action.label}</Link>
        </Button>
      );
    }
    return (
      <Button type="button" variant={variant} className="w-full sm:w-auto" onClick={action.onClick}>
        {action.label}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-[var(--color-surface)] text-center",
        pad,
        className,
      )}
    >
      {icon ? (
        <div
          className={cn("mb-4 flex shrink-0 items-center justify-center opacity-40 text-[var(--color-text-muted)]", iconWrap)}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <h2 className={titleCls}>{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[var(--color-text-muted)]">{description}</p>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          {primaryAction ? renderAction(primaryAction, "primary") : null}
          {secondaryAction ? renderAction(secondaryAction, "secondary") : null}
        </div>
      ) : null}
    </div>
  );
}
