// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import type { JoinResult, SessionLivePublicItem, SessionPublic } from "../../types";
import { PageShell } from "../../components/layout/PageShell";
import { PageCard } from "../../components/layout/PageCard";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { liveSessionPath, sessionNavigatePath } from "../../lib/sessionNav";
import { cn } from "@/lib/utils";

function canEnterLiveSession(
  item: SessionLivePublicItem,
  role: "student" | "teacher" | "admin" | undefined,
): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  if (item.is_room_teacher) return true;
  if (role === "student" && item.my_enrollment_status === "approved") return true;
  return false;
}

export function LiveSessionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { mediumTime, full } = useLocaleDate();
  const [live, setLive] = useState<SessionLivePublicItem[]>([]);
  const [upcoming, setUpcoming] = useState<SessionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinRoomId, setJoinRoomId] = useState<string | null>(null);
  const [joinRoomError, setJoinRoomError] = useState<{ roomId: string; message: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setJoinRoomError(null);
    try {
      const [liveRes, upRes] = await Promise.all([
        api.get<SessionLivePublicItem[]>("sessions/live-public"),
        api.get<SessionPublic[]>("sessions/upcoming"),
      ]);
      setLive(liveRes.data);
      setUpcoming(upRes.data);
    } catch {
      setLive([]);
      setUpcoming([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const titleOf = (s: SessionPublic) => s.title?.trim() || t("sessions.untitledTitle");

  async function handleJoinRoom(item: SessionLivePublicItem) {
    setJoinRoomId(item.room_id);
    setJoinRoomError(null);
    try {
      await api.post<JoinResult>(`rooms/${item.room_id}/join`);
      await reload();
    } catch (e) {
      setJoinRoomError({ roomId: item.room_id, message: userFacingApiError(e) });
    } finally {
      setJoinRoomId(null);
    }
  }

  function renderLiveActions(item: SessionLivePublicItem) {
    const role = user?.role;
    if (canEnterLiveSession(item, role)) {
      return (
        <Button
          type="button"
          variant="primary"
          className="h-10 shrink-0 bg-red-600 font-semibold hover:bg-red-600/90"
          onClick={() => navigate(liveSessionPath(item.id))}
        >
          {t("liveSession.dashboard.join")}
        </Button>
      );
    }

    if (role === "teacher" && !item.is_room_teacher) {
      return (
        <p className="max-w-xs text-end text-sm text-[var(--color-text-muted)]">{t("livePage.cannotJoinOtherTeacher")}</p>
      );
    }

    if (role === "student") {
      if (item.my_enrollment_status === "pending") {
        return (
          <p className="max-w-xs text-end text-sm text-[var(--color-text-muted)]">{t("enrollment.pendingMessage")}</p>
        );
      }
      if (item.my_enrollment_status === "rejected") {
        return (
          <p className="max-w-xs text-end text-sm text-[var(--color-text-muted)]">{t("enrollment.rejectedMessage")}</p>
        );
      }
      if (!item.my_enrollment_status) {
        if (!item.enrollment_open) {
          return (
            <p className="max-w-xs text-end text-sm text-[var(--color-text-muted)]">{t("enrollment.enrollmentClosed")}</p>
          );
        }
        return (
          <div className="flex w-full max-w-xs flex-col items-stretch gap-2 sm:items-end">
            {joinRoomError?.roomId === item.room_id ? (
              <p className="text-end text-sm text-destructive">{joinRoomError.message}</p>
            ) : null}
            <Button
              type="button"
              variant="primary"
              className="h-10 shrink-0 font-semibold"
              loading={joinRoomId === item.room_id}
              onClick={() => void handleJoinRoom(item)}
            >
              {item.requires_approval ? t("enrollment.requestJoin") : t("enrollment.joinRoom")}
            </Button>
          </div>
        );
      }
    }

    return null;
  }

  return (
    <PageShell
      title={t("nav.live")}
      description={t("livePage.subtitle")}
      contentClassName="space-y-6"
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
        <>
          <PageCard>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("livePage.liveNow")}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("livePage.liveNowHint")}</p>
            {live.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">{t("livePage.noLive")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {live.map((s) => (
                  <li
                    key={s.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/40 dark:bg-red-950/30",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--color-text)]">{titleOf(s)}</p>
                        <Badge
                          variant="destructive"
                          className="h-5 shrink-0 border-0 bg-red-600 px-1.5 py-0 text-[0.65rem] font-bold uppercase leading-none text-white"
                        >
                          {t("liveSession.badge")}
                        </Badge>
                        <Badge variant="outline" className="h-5 shrink-0 text-[0.65rem] font-medium">
                          {t("livePage.publicRoom")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{s.room_name}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{full(s.scheduled_at)}</p>
                    </div>
                    {renderLiveActions(s)}
                  </li>
                ))}
              </ul>
            )}
          </PageCard>

          <PageCard>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("livePage.upcoming")}</h2>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">{t("livePage.noUpcoming")}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {upcoming.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => navigate(sessionNavigatePath(s))}
                      className="flex w-full flex-col gap-1 rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 text-start transition hover:border-[var(--color-primary)]/30 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text)]">{titleOf(s)}</p>
                        <p className="text-sm text-[var(--color-text-muted)]">{s.room_name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{mediumTime(s.scheduled_at)}</p>
                      </div>
                      <span className="mt-2 shrink-0 text-sm font-semibold text-[var(--color-primary)] sm:mt-0">
                        {t("livePage.open")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PageCard>
        </>
      )}
    </PageShell>
  );
}
