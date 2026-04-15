// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Flame } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type {
  Paginated,
  RecitationPublic,
  RecitationStats,
  Room,
  RoomStats,
  SessionPublic,
  SessionStats,
  StudentProgress,
  User,
  UserStats,
} from "../types";
import { Button } from "../components/ui/Button";
import { UpcomingSessionsWidget, sessionCountdownLabel } from "../components/sessions/UpcomingSessionsWidget";
import { RecentRecitationsList } from "../components/recitations/RecentRecitationsList";
import { GradeDistributionBar } from "../components/recitations/GradeDistributionBar";
import { SurahProgressRing } from "../components/recitations/SurahProgressRing";
import { SurahProgressGrid } from "../components/recitations/SurahProgressGrid";
import { useLocaleDate } from "../hooks/useLocaleDate";
import { intlLocaleForAppLanguage } from "../lib/intlLocale";
import { riwayaBadgeClass } from "../lib/riwayaUi";
import { PageShell } from "../components/layout/PageShell";
import { LiveNowDashboardCard } from "../components/home/LiveNowDashboardCard";
import { sessionNavigatePath } from "../lib/sessionNav";

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function findFirstSessionToday(sessions: SessionPublic[]): SessionPublic | null {
  const now = new Date();
  for (const s of sessions) {
    if (isSameLocalDay(s.scheduled_at, now)) return s;
  }
  return null;
}

function useTodayDateLine(): string {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const locale = intlLocaleForAppLanguage(i18n.language);
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
  }, [i18n.language]);
}

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }
  if (!user) {
    return null;
  }
  if (user.role === "admin") return <AdminDashboard user={user} />;
  if (user.role === "teacher") return <TeacherDashboard user={user} />;
  return <StudentDashboard user={user} />;
}

function AdminDashboard({ user }: { user: User }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <PageShell
      title={t("common.appName")}
      description={t("home.welcome", { name: user.name })}
      meta={t("home.dashboardSubtitle")}
      contentClassName="space-y-8"
    >
      <LiveNowDashboardCard />
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

      <UpcomingSessionsWidget />
    </PageShell>
  );
}

function TeacherDashboard({ user }: { user: User }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dateLine = useTodayDateLine();
  const { mediumTime } = useLocaleDate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomStats, setRoomStats] = useState<RoomStats | null>(null);
  const [recStats, setRecStats] = useState<RecitationStats | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [recentRecs, setRecentRecs] = useState<RecitationPublic[]>([]);
  const [upcoming, setUpcoming] = useState<SessionPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [roomsRes, roomStatsRes, recStatsRes, recentRecsRes, upcomingRes, sessionStatsRes] =
          await Promise.all([
            api.get<Paginated<Room>>("rooms"),
            api.get<RoomStats>("rooms/stats"),
            api.get<RecitationStats>("recitations/stats"),
            api.get<Paginated<RecitationPublic>>("recitations", { params: { limit: 5 } }),
            api.get<SessionPublic[]>("sessions/upcoming"),
            api.get<SessionStats>("sessions/stats"),
          ]);
        if (!cancelled) {
          setRooms(roomsRes.data.items.filter((r) => r.teacher_id === user.id));
          setRoomStats(roomStatsRes.data);
          setRecStats(recStatsRes.data);
          setSessionStats(sessionStatsRes.data);
          setRecentRecs(recentRecsRes.data.items);
          setUpcoming(upcomingRes.data);
        }
      } catch {
        if (!cancelled) {
          setRooms([]);
          setRoomStats(null);
          setRecStats(null);
          setSessionStats(null);
          setRecentRecs([]);
          setUpcoming([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const myStudents = useMemo(() => rooms.reduce((a, r) => a + r.enrolled_count, 0), [rooms]);
  const todaySession = useMemo(() => findFirstSessionToday(upcoming), [upcoming]);
  const sessionTitle = (s: SessionPublic) => s.title?.trim() || t("sessions.untitledTitle");

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <PageShell
      titleSize="hero"
      title={t("home.teacherGreeting", { name: user.name })}
      meta={dateLine}
      description={t("home.teacherDashboard")}
      contentClassName="space-y-8"
    >
      <LiveNowDashboardCard />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => void navigate("/rooms")}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
        >
          <p className="text-xs text-[var(--color-text-muted)]">{t("home.myRooms")}</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
            {roomStats?.total ?? 0}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void navigate("/rooms")}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
        >
          <p className="text-xs text-[var(--color-text-muted)]">{t("home.myStudents")}</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
            {myStudents}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void navigate("/recitations")}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
        >
          <p className="text-xs text-[var(--color-text-muted)]">{t("home.weekRecitations")}</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
            {recStats?.recent_count ?? 0}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void navigate("/recitations")}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
        >
          <p className="text-xs text-[var(--color-text-muted)]">{t("home.totalRecitations")}</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
            {recStats?.total ?? 0}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void navigate("/calendar")}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
        >
          <p className="text-xs text-[var(--color-text-muted)]">{t("home.completedSessions")}</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
            {sessionStats?.completed ?? 0}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void navigate("/calendar")}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
        >
          <p className="text-xs text-[var(--color-text-muted)]">{t("home.attendanceRate")}</p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
            {sessionStats != null ? `${sessionStats.avg_attendance_pct.toFixed(1)}%` : "—"}
          </p>
        </button>
      </div>

      {todaySession ? (
        <div
          className="rounded-2xl border border-[var(--color-primary)]/20 p-5 shadow-sm"
          style={{ backgroundColor: "#E8F5E9" }}
        >
          <p className="text-sm font-semibold text-[var(--color-primary)]">{t("home.todaySession")}</p>
          <p className="mt-1 font-medium text-[var(--color-text)]">{todaySession.room_name}</p>
          <p className="text-sm text-[var(--color-text-muted)]">{sessionTitle(todaySession)}</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{mediumTime(todaySession.scheduled_at)}</p>
          <div className="mt-4">
            <Button type="button" variant="primary" onClick={() => void navigate(sessionNavigatePath(todaySession))}>
              {t("sessions.start")}
            </Button>
          </div>
        </div>
      ) : null}

      {recStats ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("home.gradeDistribution")}</h2>
          <GradeDistributionBar
            excellent={recStats.by_grade.excellent}
            good={recStats.by_grade.good}
            needs_work={recStats.by_grade.needs_work}
            weak={recStats.by_grade.weak}
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.teacherRecentRecitationsTitle")}</h2>
        <div className="mt-4">
          <RecentRecitationsList items={recentRecs} showStudent />
        </div>
        <div className="mt-4 text-center">
          <Link to="/recitations" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
            {t("home.viewAll")}
          </Link>
        </div>
      </section>

      <UpcomingSessionsWidget maxItems={3} showViewCalendarLink />
    </PageShell>
  );
}

function StudentDashboard({ user }: { user: User }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dateLine = useTodayDateLine();
  const { mediumTime } = useLocaleDate();

  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [recentRecs, setRecentRecs] = useState<RecitationPublic[]>([]);
  const [upcoming, setUpcoming] = useState<SessionPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setProgress(null);
      setRooms([]);
      setRecentRecs([]);
      setUpcoming([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [progressRes, roomsRes, recentRecsRes, upcomingRes] = await Promise.all([
          api.get<StudentProgress>(`students/${user.id}/progress`),
          api.get<Paginated<Room>>("rooms"),
          api.get<Paginated<RecitationPublic>>("recitations", { params: { limit: 3 } }),
          api.get<SessionPublic[]>("sessions/upcoming"),
        ]);
        if (!cancelled) {
          setProgress(progressRes.data);
          setRooms(roomsRes.data.items);
          setRecentRecs(recentRecsRes.data.items);
          setUpcoming(upcomingRes.data);
        }
      } catch {
        if (!cancelled) {
          setProgress(null);
          setRooms([]);
          setRecentRecs([]);
          setUpcoming([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const nextSession = upcoming[0] ?? null;
  const gd = progress?.grade_distribution;
  const surahCount = progress?.surahs_covered.length ?? 0;
  const gradeSum =
    (gd?.excellent ?? 0) + (gd?.good ?? 0) + (gd?.needs_work ?? 0) + (gd?.weak ?? 0);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <PageShell
      titleSize="hero"
      title={t("home.welcome", { name: user.name })}
      meta={dateLine}
      description={t("home.welcomeSubtitle")}
      contentClassName="space-y-8"
      actions={
        <Button asChild variant="primary" size="lg">
          <Link to={`/students/${user.id}/progress`}>{t("home.myProgress")}</Link>
        </Button>
      }
    >
      <LiveNowDashboardCard />
      {progress ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.progressOverview")}</h2>
            <Button asChild variant="secondary" size="sm">
              <Link to={`/students/${user.id}/progress`}>{t("home.viewFullProgress")}</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
            <SurahProgressRing covered={surahCount} />
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">{t("recitations.surahsCovered")}</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                {t("home.surahsCoveredCount", { count: surahCount })}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
            <p className="text-sm text-[var(--color-text-muted)]">{t("recitations.streak")}</p>
            <div className="mt-2 flex items-center gap-2">
              <Flame className="h-8 w-8 shrink-0 text-orange-500" aria-hidden />
              {progress.streak_days > 0 ? (
                <p className="text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
                  {t("home.dayStreak", { days: progress.streak_days })}
                </p>
              ) : (
                <p className="text-sm font-medium text-[var(--color-text)]">{t("home.startStreak")}</p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
            <p className="text-sm text-[var(--color-text-muted)]">{t("home.totalRecitations")}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-gold)" }}>
              {progress.total_recitations}
            </p>
          </div>
        </div>
        </section>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">{t("home.statsLoadError")}</p>
      )}

      {progress && gd ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("home.gradeDistribution")}</h2>
          {gradeSum === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t("home.noGradesYet")}</p>
          ) : (
            <GradeDistributionBar
              excellent={gd.excellent}
              good={gd.good}
              needs_work={gd.needs_work}
              weak={gd.weak}
            />
          )}
        </section>
      ) : null}

      {progress ? (
        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("recitations.surahsCovered")}</h2>
            <Link
              to={`/students/${user.id}/progress`}
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              {t("home.viewFullProgress")}
            </Link>
          </div>
          <SurahProgressGrid surahBestGrades={progress.surah_best_grades} />
        </section>
      ) : null}

      {nextSession ? (
        <div
          className="rounded-2xl border border-[var(--color-primary)]/20 p-5 shadow-sm"
          style={{ backgroundColor: "#E8F5E9" }}
        >
          <p className="text-sm font-semibold text-[var(--color-primary)]">{t("home.nextSession")}</p>
          <p className="mt-1 font-medium text-[var(--color-text)]">{nextSession.room_name}</p>
          <p className="text-sm text-[var(--color-text-muted)]">{mediumTime(nextSession.scheduled_at)}</p>
          <p className="mt-1 text-xs text-[var(--color-primary)]">
            {sessionCountdownLabel(nextSession.scheduled_at, t, intlLocaleForAppLanguage(i18n.language))}
          </p>
          <div className="mt-4">
            <Button type="button" variant="primary" onClick={() => void navigate(sessionNavigatePath(nextSession))}>
              {t("sessions.start")}
            </Button>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.studentRooms")}</h2>
        {rooms.length === 0 ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">{t("home.noRoomsStudent")}</p>
            <Link
              to="/rooms"
              className="mt-2 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              {t("home.browseRooms")}
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rooms.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/rooms/${r.id}`}
                  className="block rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
                >
                  <p className="font-medium text-[var(--color-text)]">{r.name}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{r.teacher_name}</p>
                  <span
                    className={`mt-2 inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${riwayaBadgeClass(r.riwaya)}`}
                  >
                    {t(`mushaf.${r.riwaya}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.studentRecitationWidgetTitle")}</h2>
        {recentRecs.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">{t("home.noRecitationsYet")}</p>
        ) : (
          <div className="mt-4">
            <RecentRecitationsList items={recentRecs} />
          </div>
        )}
        <div className="mt-4 text-center">
          <Link
            to={`/students/${user.id}/progress`}
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("home.viewFullProgress")}
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
