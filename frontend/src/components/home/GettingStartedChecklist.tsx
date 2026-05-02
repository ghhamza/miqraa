// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface GettingStartedChecklistProps {
  roomTotal: number;
  sessionTotal: number;
  hasEnrolledStudent: boolean;
  firstRoomId: string | null;
}

export function GettingStartedChecklist({
  roomTotal,
  sessionTotal,
  hasEnrolledStudent,
  firstRoomId,
}: GettingStartedChecklistProps) {
  const { t } = useTranslation();
  const step1 = roomTotal > 0;
  const step2 = sessionTotal > 0;
  const step3 = hasEnrolledStudent;
  if (step1 && step2 && step3) return null;

  const row = (opts: { done: boolean; label: string; to: string }) => (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-full border border-gray-200 bg-[var(--color-surface)] px-4 py-2.5 text-sm shadow-sm",
      )}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
            opts.done
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
              : "border-gray-200 text-[var(--color-text-muted)]",
          )}
          aria-hidden
        >
          {opts.done ? <Check className="size-3.5" /> : <span className="text-xs">○</span>}
        </span>
        <span className="font-medium text-[var(--color-text)]">{opts.label}</span>
      </span>
      <Link
        to={opts.to}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-lg space-y-3">
      <p className="text-center text-sm font-semibold text-[var(--color-text-muted)]">
        {t("home.gettingStartedTitle")}
      </p>
      {row({
        done: step1,
        label: t("home.gettingStartedStep1"),
        to: "/rooms",
      })}
      {row({
        done: step2,
        label: t("home.gettingStartedStep2"),
        to: "/calendar",
      })}
      {row({
        done: step3,
        label: t("home.gettingStartedStep3"),
        to: firstRoomId ? `/rooms/${firstRoomId}` : "/rooms",
      })}
    </div>
  );
}
