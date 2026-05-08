// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { sessionKeys, roomKeys, recitationKeys } from "../../lib/queryKeys";
import type { Paginated, RecitationPublic, Room, SessionDetail, SessionPublic, TurnType } from "../../types";
import { Button } from "../../components/ui/Button";
import { PageShell } from "../../components/layout/PageShell";
import { RecitationTurnTab } from "../../components/sessions/RecitationTurnTab";

export function StudentRecitationPage() {
  const { sessionId, studentId } = useParams<{ sessionId: string; studentId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [summaryOpen, setSummaryOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TurnType>("dars");

  const sessionQuery = useQuery({
    queryKey: sessionKeys.detail(sessionId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SessionDetail>(`/sessions/${sessionId}`, { signal });
      return data;
    },
    enabled: !!sessionId && !!studentId,
  });

  const session = sessionQuery.data ?? null;
  const roomId = session?.room_id ?? null;

  const roomQuery = useQuery({
    queryKey: roomKeys.detail(roomId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Room>(`/rooms/${roomId}`, { signal });
      return data;
    },
    enabled: !!roomId,
  });

  const room = roomQuery.data ?? null;

  const sessionRecitationsQuery = useQuery({
    queryKey: recitationKeys.list({ student: studentId, session: sessionId }),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<RecitationPublic>>("/recitations", {
        signal,
        params: { student_id: studentId, session_id: sessionId, limit: 10 },
      });
      return data;
    },
    enabled: !!sessionId && !!studentId,
  });

  const roomSessionsQuery = useQuery({
    queryKey: roomKeys.sessions(roomId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<SessionPublic>>("/sessions", {
        signal,
        params: { room_id: roomId, status: "completed", limit: 100 },
      });
      return data;
    },
    enabled: !!roomId,
  });

  const roomRecitationsQuery = useQuery({
    queryKey: recitationKeys.list({ student: studentId, room: roomId ?? undefined }),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<RecitationPublic>>("/recitations", {
        signal,
        params: { student_id: studentId, room_id: roomId, limit: 100 },
      });
      return data;
    },
    enabled: !!roomId && !!studentId,
  });

  const studentName = useMemo(() => {
    if (!session) return "";
    return session.attendance.find((a) => a.student_id === studentId)?.student_name ?? "";
  }, [session, studentId]);

  const existingByType = useMemo<Record<TurnType, RecitationPublic | null>>(() => {
    const result: Record<TurnType, RecitationPublic | null> = { dars: null, tathbit: null, muraja: null };
    const items = sessionRecitationsQuery.data?.items ?? [];
    for (const rec of items) {
      if (rec.turn_type in result) {
        result[rec.turn_type as TurnType] = rec;
      }
    }
    return result;
  }, [sessionRecitationsQuery.data]);

  const periodStats = useMemo(() => {
    const recs = roomRecitationsQuery.data;
    const sessions = roomSessionsQuery.data;
    if (!recs || !sessions) return null;
    const rated = recs.items.filter((r) => r.star_rating != null);
    const avgRating =
      rated.length > 0
        ? rated.reduce((sum, r) => sum + (r.star_rating ?? 0), 0) / rated.length
        : 0;
    return {
      attendanceCount: recs.items.length,
      totalSessions: sessions.total,
      avgStarRating: Math.round(avgRating * 10) / 10,
      totalRecitations: recs.total,
    };
  }, [roomRecitationsQuery.data, roomSessionsQuery.data]);

  const loading = sessionQuery.isPending || (!!roomId && roomQuery.isPending);

  const error = useMemo(() => {
    const firstError =
      sessionQuery.error ??
      roomQuery.error ??
      sessionRecitationsQuery.error ??
      roomSessionsQuery.error ??
      roomRecitationsQuery.error;
    return firstError ? userFacingApiError(firstError) : null;
  }, [
    sessionQuery.error,
    roomQuery.error,
    sessionRecitationsQuery.error,
    roomSessionsQuery.error,
    roomRecitationsQuery.error,
  ]);

  useEffect(() => {
    if (!room) return;
    if (room.halaqah_type === "muraja") setActiveTab("tathbit");
    else setActiveTab("dars");
  }, [room]);

  const activeTabs = useMemo<TurnType[]>(() => {
    if (!room) return ["dars", "tathbit", "muraja"];
    switch (room.halaqah_type) {
      case "hifz":
        return ["dars", "tathbit", "muraja"];
      case "tilawa":
        return ["dars"];
      case "muraja":
        return ["tathbit", "muraja"];
      case "tajweed":
        return ["dars"];
      default:
        return ["dars", "tathbit", "muraja"];
    }
  }, [room]);

  useEffect(() => {
    if (!room) return;
    if (!activeTabs.includes(activeTab)) {
      setActiveTab(activeTabs[0] ?? "dars");
    }
  }, [room, activeTabs, activeTab]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[var(--color-primary)]" />
      </div>
    );
  }

  if (error || !session || !room) {
    return <div className="p-6 text-center text-red-600">{error ?? t("errors.generic")}</div>;
  }

  const roundedStars = Math.min(5, Math.max(0, Math.round(periodStats?.avgStarRating ?? 0)));
  const sessionTitle = session.title?.trim() || t("sessions.untitledTitle");

  return (
    <PageShell
      className="mx-auto max-w-3xl"
      backTo={{ to: `/sessions/${sessionId!}`, label: t("sessions.backToSession") }}
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("sessions.calendar"), to: "/calendar" },
        { label: sessionTitle, to: `/sessions/${sessionId}` },
        { label: studentName || "…" },
      ]}
      title={studentName}
      actions={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/students/${studentId}/progress`)}
        >
          <span className="inline-flex items-center gap-1.5">
            <History className="h-4 w-4" />
            {t("sessions.studentHistory")}
          </span>
        </Button>
      }
    >

      <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between px-6 py-4"
          onClick={() => setSummaryOpen((o) => !o)}
        >
          <span className="text-sm font-semibold text-[var(--color-text)]">
            {t("sessions.periodSummary")}
          </span>
          {summaryOpen ? (
            <ChevronUp className="h-4 w-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
          )}
        </button>
        {summaryOpen && periodStats ? (
          <div className="border-t border-gray-100 px-6 py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{t("sessions.attendance")}</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-text)]">
                  {periodStats.totalRecitations} / {periodStats.totalSessions}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{t("sessions.totalRecitations")}</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-text)]">{periodStats.totalRecitations}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{t("sessions.avgRating")}</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-text)]">
                  {"★".repeat(roundedStars)}
                  {"☆".repeat(5 - roundedStars)}
                  <span className="ms-1 text-sm font-normal text-[var(--color-text-muted)]">
                    {periodStats.avgStarRating.toFixed(1)}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-0 overflow-hidden rounded-xl border border-gray-200">
        {(["dars", "tathbit", "muraja"] as TurnType[]).map((tab) => {
          const isActive = activeTabs.includes(tab);
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              disabled={!isActive}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-center text-sm font-medium transition ${
                isSelected
                  ? "bg-[var(--color-primary)] text-white"
                  : isActive
                    ? "bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-gray-50"
                    : "cursor-not-allowed bg-gray-100 text-gray-400"
              }`}
            >
              {t(`sessions.tab_${tab}`)}
            </button>
          );
        })}
      </div>

      <RecitationTurnTab
        key={activeTab}
        turnType={activeTab}
        sessionId={sessionId!}
        studentId={studentId!}
        roomId={room.id}
        riwaya={room.riwaya}
        existing={existingByType[activeTab]}
        onSaved={() => sessionRecitationsQuery.refetch()}
      />
    </PageShell>
  );
}
