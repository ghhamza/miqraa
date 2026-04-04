// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import type { RecitationPublic, StudentProgress } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Badge } from "../../components/ui/Badge";
import { BackLink } from "../../components/navigation/BackLink";
import { SurahProgressGrid } from "../../components/recitations/SurahProgressGrid";
import { RecentRecitationsList } from "../../components/recitations/RecentRecitationsList";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { roleTranslationKey } from "../../lib/roleLabels";

export function StudentProgressPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { full } = useLocaleDate();
  const user = useAuthStore((s) => s.user);

  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [recent, setRecent] = useState<RecitationPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    if (user.role === "student" && user.id !== id) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setForbidden(false);
    setLoading(true);
    void (async () => {
      try {
        const [pRes, rRes] = await Promise.all([
          api.get<StudentProgress>(`students/${id}/progress`),
          api.get<RecitationPublic[]>(`students/${id}/recitations`),
        ]);
        if (!cancelled) {
          setProgress(pRes.data);
          setRecent(rRes.data.slice(0, 10));
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          if (!cancelled) setForbidden(true);
        }
        if (!cancelled) {
          setProgress(null);
          setRecent([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (forbidden || !progress) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p className="text-[var(--color-text-muted)]">{t("errors.noPermission")}</p>
        <Link to="/" className="mt-4 inline-block text-[var(--color-primary)]">
          {t("nav.home")}
        </Link>
      </div>
    );
  }

  const gd = progress.grade_distribution;
  const sum = gd.excellent + gd.good + gd.needs_work + gd.weak;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <BackLink to="/recitations">{t("recitations.title")}</BackLink>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-text)] md:text-3xl"
            style={{ fontFamily: "var(--font-quran)" }}
          >
            {progress.student_name}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("recitations.studentProgress")}</p>
        </div>
        <Badge variant="green">{t(roleTranslationKey("student"))}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="text-xs text-[var(--color-text-muted)]">{t("recitations.totalRecitations")}</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-primary)]">{progress.total_recitations}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="text-xs text-[var(--color-text-muted)]">{t("recitations.surahsCovered")}</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-gold)]">
            {progress.surahs_covered.length} / 114
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Flame className="h-4 w-4 text-orange-500" />
            {t("recitations.streak")}
          </p>
          <p className="mt-1 text-3xl font-bold text-orange-600">{progress.streak_days}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="text-xs text-[var(--color-text-muted)]">{t("recitations.lastRecitationAt")}</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-text)]">
            {progress.last_recitation_date ? full(progress.last_recitation_date) : "—"}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          {t("recitations.gradeDistribution")}
        </h2>
        <div className="flex h-6 overflow-hidden rounded-full bg-gray-100">
          {sum === 0 ? (
            <div className="h-full w-full bg-gray-200" />
          ) : (
            <>
              <div className="h-full bg-[#1B5E20]" style={{ width: `${(gd.excellent / sum) * 100}%` }} />
              <div className="h-full bg-[#4CAF50]" style={{ width: `${(gd.good / sum) * 100}%` }} />
              <div className="h-full bg-[#F57F17]" style={{ width: `${(gd.needs_work / sum) * 100}%` }} />
              <div className="h-full bg-[#EF5350]" style={{ width: `${(gd.weak / sum) * 100}%` }} />
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)]">
          <span>{t("recitations.excellent")}: {gd.excellent}</span>
          <span>{t("recitations.good")}: {gd.good}</span>
          <span>{t("recitations.needsWork")}: {gd.needs_work}</span>
          <span>{t("recitations.weak")}: {gd.weak}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("recitations.surahsCovered")}</h2>
        <SurahProgressGrid surahBestGrades={progress.surah_best_grades} />
      </section>

      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("recitations.recentList")}</h2>
        <RecentRecitationsList items={recent} />
      </section>
    </div>
  );
}
