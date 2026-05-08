// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookMarked, Plus, TrendingUp, Users } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import type {
  SessionPublic,
  User,
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
import { EmptyState } from "../components/ui/EmptyState";
import { LiveNowDashboardCard } from "../components/home/LiveNowDashboardCard";
import { WhatsNewStrip } from "../components/home/WhatsNewStrip";
import { CombinedStreakCard } from "../components/home/CombinedStreakCard";
import { GettingStartedChecklist } from "../components/home/GettingStartedChecklist";
import { StudentEmptyHero } from "../components/home/StudentEmptyHero";
import { TeacherEmptyHero } from "../components/home/TeacherEmptyHero";
import { RoomFormModal } from "../components/rooms/RoomFormModal";
import { sessionNavigatePath } from "../lib/sessionNav";
import { useQfStreak } from "../data/qf";
import { useStudentProgress, useStudentRecitations, useUsersStats } from "../data/users";
import { useRecitationsFeed, useRecitationsStats } from "../data/recitations";
import { useRoomsList, useRoomsStats } from "../data/rooms";
import { useSessionStats, useUpcomingSessions } from "../data/sessions";

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
  const { t } = useTranslation();
  const homeGreeting = useMemo(
    () => (user ? t("home.welcome", { name: user.name }) : ""),
    [t, user],
  );

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
  if (user.role === "admin") return <AdminDashboard homeGreeting={homeGreeting} />;
  if (user.role === "teacher") return <TeacherDashboard user={user} homeGreeting={homeGreeting} />;
  return <StudentDashboard user={user} homeGreeting={homeGreeting} />;
}

function AdminDashboard({ homeGreeting }: { homeGreeting: string }) {
  const { t } = useTranslation();
  const statsQuery = useUsersStats();

  const stats = statsQuery.data ?? null;
  const loading = statsQuery.isPending;

  return (
    <PageShell
      title={t("common.appName")}
      description={homeGreeting}
      meta={t("home.dashboardSubtitle")}
      contentClassName="space-y-8"
    >
      <WhatsNewStrip role="admin" />
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

function TeacherDashboard({ user, homeGreeting }: { user: User; homeGreeting: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dateLine = useTodayDateLine();
  const { mediumTime } = useLocaleDate();

  const [roomFormOpen, setRoomFormOpen] = useState(false);

  const roomsQuery = useRoomsList("teacher-home", undefined, {
    select: (items) => items.filter((r) => r.teacher_id === user.id),
    staleTime: 60_000,
  });

  const roomStatsQuery = useRoomsStats(true);

  const recStatsQuery = useRecitationsStats();

  const recentRecsQuery = useRecitationsFeed("teacher-home-recent", { limit: 5, staleTime: 30_000 });

  const upcomingQuery = useUpcomingSessions(true);

  const sessionStatsQuery = useSessionStats(true);

  const rooms = roomsQuery.data ?? [];
  const roomStats = roomStatsQuery.data ?? null;
  const recStats = recStatsQuery.data ?? null;
  const sessionStats = sessionStatsQuery.data ?? null;
  const recentRecs = recentRecsQuery.data ?? [];
  const upcoming = upcomingQuery.data ?? [];

  const loading =
    roomsQuery.isPending ||
    roomStatsQuery.isPending ||
    recStatsQuery.isPending ||
    recentRecsQuery.isPending ||
    upcomingQuery.isPending ||
    sessionStatsQuery.isPending;

  const myStudents = useMemo(() => rooms.reduce((a, r) => a + r.enrolled_count, 0), [rooms]);
  const todaySession = useMemo(() => findFirstSessionToday(upcoming), [upcoming]);
  const sessionTitle = (s: SessionPublic) => s.title?.trim() || t("sessions.untitledTitle");
  const isEmptyTeacher = (roomStats?.total ?? -1) === 0;

  const headerActions = (
    <Button type="button" variant="primary" onClick={() => setRoomFormOpen(true)}>
      <span className="inline-flex items-center gap-2">
        <Plus className="h-4 w-4" />
        {t("home.createHalaqah")}
      </span>
    </Button>
  );

  const roomModal = (
    <RoomFormModal
      open={roomFormOpen}
      mode="create"
      room={null}
      isAdmin={false}
      onClose={() => setRoomFormOpen(false)}
      onSaved={() => {
        setRoomFormOpen(false);
      }}
    />
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (isEmptyTeacher) {
    return (
      <PageShell
        titleSize="hero"
        title={homeGreeting}
        meta={dateLine}
        description={t("home.teacherDashboard")}
        contentClassName="space-y-8"
        actions={headerActions}
      >
        <WhatsNewStrip role="teacher" />
        <LiveNowDashboardCard />
        <TeacherEmptyHero onCreateClick={() => setRoomFormOpen(true)} />
        <GettingStartedChecklist
          roomTotal={roomStats?.total ?? 0}
          sessionTotal={sessionStats?.total ?? 0}
          hasEnrolledStudent={rooms.some((r) => r.enrolled_count > 0)}
          firstRoomId={rooms[0]?.id ?? null}
        />
        {roomModal}
      </PageShell>
    );
  }

  return (
    <PageShell
      titleSize="hero"
      title={homeGreeting}
      meta={dateLine}
      description={t("home.teacherDashboard")}
      contentClassName="space-y-8"
      actions={headerActions}
    >
      <WhatsNewStrip role="teacher" />
      <LiveNowDashboardCard />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => void navigate("/rooms")}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
        >
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-[var(--color-primary)]" />
            <p className="text-xs text-[var(--color-text-muted)]">{t("home.stats.myHalaqat")}</p>
          </div>
          <div className="mt-2 flex items-end gap-2 text-sm text-[var(--color-text-muted)]">
            <span className="text-2xl font-bold text-[var(--color-gold)]">{roomStats?.total ?? 0}</span>
            <span>{t("home.stats.rooms")}</span>
            <span aria-hidden>·</span>
            <span className="text-2xl font-bold text-[var(--color-gold)]">{myStudents}</span>
            <span>{t("home.stats.students")}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => void navigate("/recitations")}
          className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 text-start shadow-sm transition hover:border-[var(--color-primary)]/30"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-[var(--color-gold)]" />
            <p className="text-xs text-[var(--color-text-muted)]">{t("home.stats.thisWeek")}</p>
          </div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-bold text-[var(--color-gold)]">{recStats?.recent_count ?? 0}</span>
            <span className="text-sm text-[var(--color-text-muted)]">{t("home.stats.recitationsLabel")}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {t("home.stats.completedSessions", { count: sessionStats?.completed ?? 0 })} ·{" "}
            {t("home.stats.attendanceRate", {
              rate: sessionStats != null ? sessionStats.avg_attendance_pct.toFixed(1) : "0.0",
            })}
          </p>
        </button>

        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-xs text-[var(--color-text-muted)]">{t("home.gradeDistribution")}</h2>
          <GradeDistributionBar
            excellent={recStats?.by_grade.excellent ?? 0}
            good={recStats?.by_grade.good ?? 0}
            needs_work={recStats?.by_grade.needs_work ?? 0}
            weak={recStats?.by_grade.weak ?? 0}
          />
        </section>
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

      <UpcomingSessionsWidget
        maxItems={3}
        showViewCalendarLink
        excludeIds={todaySession ? [todaySession.id] : []}
      />
      {roomModal}
    </PageShell>
  );
}

function StudentDashboard({ user, homeGreeting }: { user: User; homeGreeting: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dateLine = useTodayDateLine();
  const { mediumTime } = useLocaleDate();

  const progressQuery = useStudentProgress(user?.id, !!user?.id);

  const enrolledRoomsQuery = useRoomsList("student-home-enrolled", undefined, {
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const recentRecsQuery = useStudentRecitations(user?.id, { enabled: !!user?.id, limit: 3 });

  const upcomingQuery = useUpcomingSessions(!!user?.id);

  const publicRoomsQuery = useRoomsList(
    "student-home-public-discovery",
    { is_public: true, my_status: "none", limit: 4 },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60_000,
    },
  );

  const progress = progressQuery.data ?? null;
  const rooms = enrolledRoomsQuery.data ?? [];
  const recentRecs = recentRecsQuery.data ?? [];
  const upcoming = upcomingQuery.data ?? [];
  const publicRooms = publicRoomsQuery.data ?? [];

  const loading =
    !!user?.id &&
    (progressQuery.isPending ||
      enrolledRoomsQuery.isPending ||
      recentRecsQuery.isPending ||
      upcomingQuery.isPending ||
      publicRoomsQuery.isPending);

  const nextSession = upcoming[0] ?? null;
  const hasNoRecitations = (progress?.total_recitations ?? 0) === 0;
  const gd = progress?.grade_distribution;
  const surahCount = progress?.surahs_covered.length ?? 0;
  const gradeSum =
    (gd?.excellent ?? 0) + (gd?.good ?? 0) + (gd?.needs_work ?? 0) + (gd?.weak ?? 0);
  const { data: qfStreak, loading: qfStreakLoading } = useQfStreak(user.qf_linked === true);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <PageShell
        titleSize="hero"
        title={homeGreeting}
        meta={dateLine}
        description={t("home.studentSubtitle")}
        contentClassName="space-y-8"
      >
        <WhatsNewStrip role="student" />
        <LiveNowDashboardCard />
        <StudentEmptyHero />
      </PageShell>
    );
  }

  if (rooms.length > 0 && hasNoRecitations) {
    return (
      <PageShell
        titleSize="hero"
        title={homeGreeting}
        meta={dateLine}
        description={t("home.studentSubtitle")}
        contentClassName="space-y-8"
      >
        <WhatsNewStrip role="student" />
        <LiveNowDashboardCard />

        <EmptyState
          size="large"
          icon={<BookMarked className="h-16 w-16" />}
          title={t("home.studentStartingTitle")}
          description={t("home.studentStartingDescription")}
        />

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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.discoverHalaqatTitle")}</h2>
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{t("home.discoverHalaqatDescription")}</p>
            </div>
            {publicRooms.length > 0 ? (
              <Link to="/rooms" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                {t("home.discoverHalaqatSeeAll")}
              </Link>
            ) : null}
          </div>
          {publicRooms.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t("home.discoverHalaqatEmpty")}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {publicRooms.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/rooms/${r.id}`}
                    className="block rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
                  >
                    <p className="font-medium text-[var(--color-text)]">{r.name}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{r.teacher_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold ${riwayaBadgeClass(r.riwaya)}`}
                      >
                        {t(`mushaf.${r.riwaya}`)}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        · {t("rooms.enrolledFraction", { enrolled: r.enrolled_count, max: r.max_students })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.quranMapTitle")}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{t("home.quranMapDescription")}</p>
          </div>
          <SurahProgressGrid surahBestGrades={progress?.surah_best_grades ?? []} />
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      titleSize="hero"
      title={homeGreeting}
      meta={dateLine}
      description={t("home.studentSubtitle")}
      contentClassName="space-y-8"
      actions={
        <Button asChild variant="primary" size="lg">
          <Link to={`/students/${user.id}/progress`}>{t("home.myProgress")}</Link>
        </Button>
      }
    >
      <WhatsNewStrip role="student" />
      <LiveNowDashboardCard />
      {progress ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.progressOverview")}</h2>
            <Button asChild variant="secondary" size="sm">
              <Link to={`/students/${user.id}/progress`}>{t("home.viewFullProgress")}</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
              <SurahProgressRing covered={surahCount} />
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">{t("recitations.surahsCovered")}</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                  {t("home.surahsCoveredCount", { count: surahCount })}
                </p>
              </div>
            </div>
            <CombinedStreakCard
              miqraaStreakDays={progress.streak_days}
              qfLinked={user.qf_linked}
              qfStreak={qfStreak}
              qfLoading={qfStreakLoading}
            />
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

      {progress && progress.surahs_covered.length > 0 ? (
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
