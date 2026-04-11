// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useLiveSessions } from "../../contexts/LiveSessionsContext";
import { liveSessionPath } from "../../lib/sessionNav";
import { Button } from "../ui/Button";

function minutesSinceScheduled(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

export function LiveSessionBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasLiveSession, primaryLiveSession, pollVersion } = useLiveSessions();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [pollVersion]);

  if (location.pathname.includes("/live")) return null;
  if (!hasLiveSession || !primaryLiveSession || dismissed) return null;

  const title = primaryLiveSession.title?.trim() || t("sessions.untitledTitle");
  const minutes = minutesSinceScheduled(primaryLiveSession.scheduled_at);

  return (
    <div
      role="status"
      className="sticky top-16 z-30 flex h-12 w-full min-w-0 items-center gap-3 border-b border-border bg-background px-3 shadow-sm sm:px-4 md:px-6"
    >
      <div className="min-w-0 flex-1 text-start">
        <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
          {t("liveSession.banner.title")}
        </p>
        <p className="truncate text-[0.7rem] text-muted-foreground sm:text-xs">
          {title} · {primaryLiveSession.room_name} · {t("liveSession.banner.startedAgo", { minutes })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="h-8 px-3 text-xs"
          onClick={() => navigate(liveSessionPath(primaryLiveSession.id))}
        >
          {t("liveSession.banner.join")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={t("liveSession.banner.dismiss")}
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
