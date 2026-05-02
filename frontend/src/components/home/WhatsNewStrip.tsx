// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";

export interface WhatsNewData {
  since: string | null;
  new_recitations: number;
  new_enrollments: number;
  completed_sessions: number;
  pending_requests: number;
}

export interface WhatsNewStripProps {
  role: "student" | "teacher" | "admin";
}

function formatRelative(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const ms = then - now;
  const days = Math.round(ms / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(days) >= 1) return rtf.format(days, "day");
  const hours = Math.round(ms / 3_600_000);
  return rtf.format(hours, "hour");
}

export function WhatsNewStrip({ role }: WhatsNewStripProps) {
  const { t, i18n } = useTranslation();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("whatsNewDismissed") === "1",
  );
  const [data, setData] = useState<WhatsNewData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoadError(false);
    try {
      const { data: d } = await api.get<WhatsNewData>("me/whats-new", { signal });
      setData(d);
    } catch {
      if (!signal.aborted) {
        setLoadError(true);
        setData(null);
      }
    }
  }, []);

  useEffect(() => {
    if (dismissed) return;
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [dismissed, load]);

  const relativeSince = useMemo(() => {
    if (!data?.since) return "";
    return formatRelative(data.since, intlLocaleForAppLanguage(i18n.language));
  }, [data?.since, i18n.language]);

  const summaryParts = useMemo(() => {
    if (!data) return [];
    const parts: string[] = [];
    if (role === "teacher") {
      if (data.new_recitations > 0) {
        parts.push(t("home.whatsNew.recitationsTeacher", { count: data.new_recitations }));
      }
      if (data.new_enrollments > 0) {
        parts.push(t("home.whatsNew.enrollments", { count: data.new_enrollments }));
      }
      if (data.pending_requests > 0) {
        parts.push(t("home.whatsNew.pending", { count: data.pending_requests }));
      }
      if (data.completed_sessions > 0) {
        parts.push(t("home.whatsNew.sessions", { count: data.completed_sessions }));
      }
    } else if (role === "student") {
      if (data.new_recitations > 0) {
        parts.push(t("home.whatsNew.recitationsStudent", { count: data.new_recitations }));
      }
      if (data.completed_sessions > 0) {
        parts.push(t("home.whatsNew.sessionsAttended", { count: data.completed_sessions }));
      }
    }
    return parts;
  }, [data, role, t]);

  if (dismissed || loadError) return null;
  if (!data || data.since == null) return null;
  if (
    data.new_recitations === 0 &&
    data.new_enrollments === 0 &&
    data.completed_sessions === 0 &&
    data.pending_requests === 0
  ) {
    return null;
  }
  if (summaryParts.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("whatsNewDismissed", "1");
  };

  return (
    <div className="rounded-xl border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-[var(--color-gold)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {t("home.whatsNewTitle", { since: relativeSince })}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{summaryParts.join(" · ")}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label={t("common.dismiss")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
