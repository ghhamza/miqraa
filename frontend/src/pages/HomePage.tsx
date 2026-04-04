// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type { RecitationPublic, StudentProgress, UserStats } from "../types";
import { Button } from "../components/ui/Button";
import { UpcomingSessionsWidget } from "../components/sessions/UpcomingSessionsWidget";
import { GradeBadge } from "../components/recitations/GradeBadge";
import { RecentRecitationsList } from "../components/recitations/RecentRecitationsList";

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentProgress, setStudentProgress] = useState<StudentProgress | null>(null);
  const [studentRecLoading, setStudentRecLoading] = useState(false);
  const [lastRecitation, setLastRecitation] = useState<RecitationPublic | null>(null);
  const [teacherRecent, setTeacherRecent] = useState<RecitationPublic[]>([]);
  const [teacherRecentLoading, setTeacherRecentLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      setStats(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data } = await api.get<UserStats>("users/stats");
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "student" || !user?.id) {
      setStudentProgress(null);
      setLastRecitation(null);
      return;
    }
    let cancelled = false;
    setStudentRecLoading(true);
    void (async () => {
      try {
        const [progRes, recRes] = await Promise.all([
          api.get<StudentProgress>(`students/${user.id}/progress`),
          api.get<RecitationPublic[]>("recitations", { params: { limit: 1 } }),
        ]);
        if (!cancelled) {
          setStudentProgress(progRes.data);
          setLastRecitation(recRes.data[0] ?? null);
        }
      } catch {
        if (!cancelled) {
          setStudentProgress(null);
          setLastRecitation(null);
        }
      } finally {
        if (!cancelled) setStudentRecLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.id]);

  useEffect(() => {
    if (user?.role !== "teacher") {
      setTeacherRecent([]);
      return;
    }
    let cancelled = false;
    setTeacherRecentLoading(true);
    void (async () => {
      try {
        const { data } = await api.get<RecitationPublic[]>("recitations", { params: { limit: 5 } });
        if (!cancelled) setTeacherRecent(data);
      } catch {
        if (!cancelled) setTeacherRecent([]);
      } finally {
        if (!cancelled) setTeacherRecentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.id]);

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-quran)" }}
        >
          {t("common.appName")}
        </h1>
        <p className="mt-2 text-xl text-[var(--color-text)]" style={{ fontFamily: "var(--font-ui)" }}>
          {t("home.welcome", { name: user?.name ?? "" })}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {user?.role === "admin" ? t("home.dashboardSubtitle") : t("home.welcomeSubtitle")}
        </p>
      </div>

      {user?.role === "admin" ? (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("home.adminStatsTitle")}</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: t("home.totalUsers"), value: stats.total },
                { label: t("home.students"), value: stats.students },
                { label: t("home.teachers"), value: stats.teachers },
                { label: t("home.admins"), value: stats.admins },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm"
                >
                  <p className="text-sm text-[var(--color-text-muted)]">{s.label}</p>
                  <p className="mt-1 text-3xl font-bold" style={{ color: "var(--color-gold)" }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--color-text-muted)]">{t("home.statsLoadError")}</p>
          )}
        </div>
      ) : null}

      {user?.role === "student" ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.studentRecitationWidgetTitle")}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("home.studentHint")}</p>
          {studentRecLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : studentProgress ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4">
                  <p className="text-sm text-[var(--color-text-muted)]">{t("recitations.surahsCovered")}</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
                    {t("home.surahsCoveredCount", { count: studentProgress.surahs_covered.length })}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4">
                  <p className="text-sm text-[var(--color-text-muted)]">{t("recitations.streak")}</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
                    {t("home.dayStreak", { days: studentProgress.streak_days })}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4">
                  <p className="text-sm text-[var(--color-text-muted)]">{t("home.lastGradeLabel")}</p>
                  <div className="mt-2">
                    <GradeBadge grade={lastRecitation?.grade ?? null} />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void navigate(`/students/${user.id}/progress`)}
                >
                  {t("home.viewFullProgress")}
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">{t("home.statsLoadError")}</p>
          )}
        </section>
      ) : null}

      {user?.role === "teacher" ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.teacherRecentRecitationsTitle")}</h2>
          {teacherRecentLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : (
            <div className="mt-4">
              <RecentRecitationsList items={teacherRecent} showStudent />
            </div>
          )}
        </section>
      ) : null}

      <UpcomingSessionsWidget />

      {user?.role === "teacher" ? (
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={() => void navigate("/calendar")}>
            {t("sessions.addSession")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
