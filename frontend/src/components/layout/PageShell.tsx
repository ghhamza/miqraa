// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackLink } from "../navigation/BackLink";

export type PageBreadcrumbItem = { label: string; to?: string };

export interface PageShellProps {
  /** Optional stats or KPI row below the title (e.g. rooms summary cards). */
  stats?: React.ReactNode;
  /** Renders `BackLink` above breadcrumbs/title. */
  backTo?: { to: string; label: string };
  /** Trail: last item typically has no `to` (current page). */
  breadcrumb?: PageBreadcrumbItem[];
  title: React.ReactNode;
  /** Badges or chips next to the title (same row). */
  titleAside?: React.ReactNode;
  description?: React.ReactNode;
  /** Extra lines under description (e.g. date). */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Applied to the block that wraps `children` (default `space-y-6`). */
  contentClassName?: string;
  /** Title size: home/dashboard uses `hero`. */
  titleSize?: "default" | "hero";
}

function PageBreadcrumb({ items }: { items: PageBreadcrumbItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <nav aria-label={t("layout.breadcrumbNav")} className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-[var(--color-text-muted)]">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 ? (
            <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 opacity-45 rtl:rotate-180" aria-hidden />
          ) : null}
          {item.to ? (
            <Link to={item.to} className="text-[var(--color-primary)] hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-[var(--color-text)]">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function PageShell({
  stats,
  backTo,
  breadcrumb,
  title,
  titleAside,
  description,
  meta,
  actions,
  children,
  className,
  contentClassName,
  titleSize = "default",
}: PageShellProps) {
  const titleClasses =
    titleSize === "hero"
      ? "text-3xl font-bold text-[var(--color-text)] md:text-4xl"
      : "text-2xl font-bold text-[var(--color-text)] md:text-3xl";

  return (
    <div className={cn("space-y-6", className)}>
      {backTo ? (
        <BackLink to={backTo.to} className="inline-flex w-fit">
          {backTo.label}
        </BackLink>
      ) : null}

      {breadcrumb && breadcrumb.length > 0 ? <PageBreadcrumb items={breadcrumb} /> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={titleClasses} style={{ fontFamily: "var(--font-quran)" }}>
              {title}
            </h1>
            {titleAside}
          </div>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{description}</p>
          ) : null}
          {meta ? <div className="mt-1 text-sm text-[var(--color-text-muted)]">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>

      {stats ? <div>{stats}</div> : null}

      <div className={cn("space-y-6", contentClassName)}>{children}</div>
    </div>
  );
}
