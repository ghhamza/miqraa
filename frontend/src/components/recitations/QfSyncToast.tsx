// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  kind: "success" | "error";
  relinkNeeded?: boolean;
  onDismiss: () => void;
  durationMs?: number;
}

export function QfSyncToast({ kind, relinkNeeded = false, onDismiss, durationMs = 5000 }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  const isSuccess = kind === "success";
  const borderClass = isSuccess ? "border-blue-300" : "border-amber-300";
  const bgClass = isSuccess ? "bg-blue-50" : "bg-amber-50";
  const textClass = isSuccess ? "text-blue-900" : "text-amber-900";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed left-4 right-4 top-[max(4.5rem,env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-xl border-2 p-4 shadow-lg md:left-auto md:right-6 md:top-24 ${borderClass} ${bgClass} ${textClass}`}
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <p className="text-sm font-semibold">
        {isSuccess ? t("recitations.qfSyncSuccess") : t("recitations.qfSyncFailed")}
      </p>
      {!isSuccess && relinkNeeded ? (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("recitations.qfRelinkNeeded")}</p>
      ) : null}
    </div>
  );
}
