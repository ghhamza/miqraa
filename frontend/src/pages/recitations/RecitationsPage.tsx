// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookMarked, TrendingUp } from "lucide-react";
import { api } from "../../lib/api";
import type {
  Paginated,
  QuranRiwaya,
  RecitationGrade,
  RecitationPublic,
  RecitationStats,
  Room,
  StudentOption,
} from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/Button";
import { FormSelect } from "../../components/ui/select";
import { Table } from "../../components/ui/Table";
import { GradeBadge } from "../../components/recitations/GradeBadge";
import { AyahRangeAudioButton } from "../../components/recitations/AyahRangeAudioButton";
import { RecitationFormModal } from "../../components/recitations/RecitationFormModal";
import { SurahPicker } from "../../components/recitations/SurahPicker";
import { DeleteRecitationModal } from "../../components/recitations/DeleteRecitationModal";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { getAvailableRiwayat, getSurahNameWithArabic } from "../../lib/quranService";
import { riwayaBadgeClass } from "../../lib/riwayaUi";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { cn } from "@/lib/utils";

/** Align with SurahPicker + native date inputs (Radix trigger defaults include `sm:text-base`). */
const FILTER_FIELD_CLASS =
  "h-11 w-full box-border rounded-xl border border-gray-200 bg-white px-3 py-0 text-sm sm:text-sm text-[var(--color-text)] shadow-sm";

type GradeFilter = "" | RecitationGrade;

export function RecitationsPage() {
  const { t, i18n } = useTranslation();
  const { medium } = useLocaleDate();
  const user = useAuthStore((s) => s.user);
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const [stats, setStats] = useState<RecitationStats | null>(null);
  const [rows, setRows] = useState<RecitationPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [surahFilter, setSurahFilter] = useState<number | "">("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [gradeTab, setGradeTab] = useState<GradeFilter>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [riwayaFilter, setRiwayaFilter] = useState<QuranRiwaya | "">("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editRec, setEditRec] = useState<RecitationPublic | null>(null);
  const [deleteRec, setDeleteRec] = useState<RecitationPublic | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isStudent = user?.role === "student";
  const canAdd = user?.role === "teacher" || user?.role === "admin";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (surahFilter !== "") params.surah = String(surahFilter);
      if (gradeTab) params.grade = gradeTab;
      if (fromDate) params.from = new Date(fromDate + "T00:00:00").toISOString();
      if (toDate) params.to = new Date(toDate + "T23:59:59").toISOString();
      if (studentFilter && (user?.role === "teacher" || user?.role === "admin")) {
        params.student_id = studentFilter;
      }
      if (riwayaFilter) params.riwaya = riwayaFilter;
      const [statsRes, listRes] = await Promise.all([
        api.get<RecitationStats>("recitations/stats"),
        api.get<Paginated<RecitationPublic>>("recitations", { params }),
      ]);
      setStats(statsRes.data);
      setRows(listRes.data.items);
    } catch {
      setStats(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [surahFilter, gradeTab, fromDate, toDate, studentFilter, riwayaFilter, user?.role]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user || user.role === "student") return;
    let cancelled = false;
    void (async () => {
      try {
        if (user.role === "admin") {
          const { data } = await api.get<StudentOption[]>("students");
          if (!cancelled) setStudents(data);
        } else {
          const { data: roomsPage } = await api.get<Paginated<Room>>("rooms");
          const mine = roomsPage.items.filter((r) => r.teacher_id === user.id);
          const map = new Map<string, StudentOption>();
          for (const r of mine) {
            try {
              const { data: ens } = await api.get<
                { student_id: string; student_name: string; student_email: string }[]
              >(`rooms/${r.id}/enrollments`);
              for (const e of ens) {
                if (!map.has(e.student_id)) {
                  map.set(e.student_id, {
                    id: e.student_id,
                    name: e.student_name,
                    email: e.student_email,
                  });
                }
              }
            } catch {
              /* */
            }
          }
          if (!cancelled) setStudents([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch {
        if (!cancelled) setStudents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const canEditRow = useCallback(
    (r: RecitationPublic) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      return user.role === "teacher" && r.teacher_id === user.id;
    },
    [user],
  );

  const hasMultipleRiwayat = useMemo(() => new Set(rows.map((r) => r.riwaya)).size > 1, [rows]);

  const columns = useMemo(() => {
    const base = [
      ...(isStudent
        ? []
        : [
            {
              key: "student",
              header: t("recitations.student"),
              render: (r: RecitationPublic) => (
                <div className="flex flex-col gap-1">
                  <span>{r.student_name ?? t("recitations.deletedStudent")}</span>
                  {r.student_id ? (
                    <Link
                      to={`/students/${r.student_id}/progress`}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t("recitations.progress")}
                    </Link>
                  ) : null}
                </div>
              ),
            },
          ]),
      {
        key: "surah",
        header: t("recitations.surah"),
        render: (r: RecitationPublic) => (
          <span style={{ fontFamily: "var(--font-quran)" }}>
            {r.surah}. {getSurahNameWithArabic(r.surah, loc)}
          </span>
        ),
      },
      {
        key: "ayah",
        header: t("recitations.ayahRange"),
        render: (r: RecitationPublic) => (
          <span style={{ fontFamily: "var(--font-quran)" }}>
            {r.ayah_start}–{r.ayah_end}
          </span>
        ),
      },
      {
        key: "riwaya",
        header: t("recitations.riwaya"),
        render: (r: RecitationPublic) => (
          <span
            className={`inline-flex rounded-lg border px-2 py-0.5 text-[0.65rem] font-semibold ${riwayaBadgeClass(r.riwaya)}`}
          >
            {t(`mushaf.${r.riwaya}`)}
          </span>
        ),
      },
      {
        key: "grade",
        header: t("recitations.grade"),
        render: (r: RecitationPublic) => <GradeBadge grade={r.grade} />,
      },
      {
        key: "notes",
        header: t("recitations.teacherNotes"),
        render: (r: RecitationPublic) => (
          <span
            dir="auto"
            className="line-clamp-2 max-w-[12rem] text-xs text-[var(--color-text-muted)]"
            title={r.teacher_notes ?? undefined}
          >
            {r.teacher_notes ?? "—"}
          </span>
        ),
      },
      {
        key: "date",
        header: t("recitations.date"),
        render: (r: RecitationPublic) => <span>{medium(r.created_at)}</span>,
      },
      {
        key: "actions",
        header: t("common.actions"),
        render: (r: RecitationPublic) => (
          <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <AyahRangeAudioButton surah={r.surah} ayahStart={r.ayah_start} ayahEnd={r.ayah_end} variant="icon" />
            {canEditRow(r) ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="!py-1 !px-2 text-xs"
                  onClick={() => setEditRec(r)}
                >
                  {t("common.edit")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="!py-1 !px-2 text-xs"
                  onClick={() => setDeleteRec(r)}
                >
                  {t("common.delete")}
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    ];
    return base;
  }, [t, isStudent, loc, medium, canEditRow]);

  async function confirmDelete() {
    if (!deleteRec) return;
    setActionLoading(true);
    try {
      await api.delete(`recitations/${deleteRec.id}`);
      setDeleteRec(null);
      void fetchAll();
    } finally {
      setActionLoading(false);
    }
  }

  const gradeTabs: { id: GradeFilter; label: string }[] = [
    { id: "", label: t("common.all") },
    { id: "excellent", label: t("recitations.excellent") },
    { id: "good", label: t("recitations.good") },
    { id: "needs_work", label: t("recitations.needsWork") },
    { id: "weak", label: t("recitations.weak") },
  ];

  return (
    <PageShell
      breadcrumb={[
        { label: t("nav.home"), to: "/" },
        { label: t("recitations.title") },
      ]}
      title={t("recitations.title")}
      actions={
        (isStudent && user?.id) || canAdd ? (
          <div className="flex flex-wrap items-center gap-2">
            {isStudent && user?.id ? (
              <Button asChild variant={canAdd ? "secondary" : "primary"}>
                <Link to={`/students/${user.id}/progress`}>{t("home.myProgress")}</Link>
              </Button>
            ) : null}
            {canAdd ? (
              <Button type="button" variant="primary" onClick={() => setFormOpen(true)}>
                {t("recitations.addRecitation")}
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm">
            <BookMarked className="h-8 w-8 text-[var(--color-primary)]" />
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">{t("recitations.totalRecitations")}</p>
              <p className="text-2xl font-bold text-[var(--color-text)]">{stats.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm">
            <TrendingUp className="h-8 w-8 text-[var(--color-gold)]" />
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">{t("recitations.recentRecitations")}</p>
              <p className="text-2xl font-bold text-[var(--color-text)]">{stats.recent_count}</p>
            </div>
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
              {t("recitations.gradeDistribution")}
            </p>
            <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
              {(() => {
                const sum =
                  stats.by_grade.excellent +
                  stats.by_grade.good +
                  stats.by_grade.needs_work +
                  stats.by_grade.weak;
                if (sum === 0) return <div className="h-full w-full bg-gray-200" />;
                const parts = [
                  { c: stats.by_grade.excellent, cl: "bg-[#1B5E20]" },
                  { c: stats.by_grade.good, cl: "bg-[#4CAF50]" },
                  { c: stats.by_grade.needs_work, cl: "bg-[#F57F17]" },
                  { c: stats.by_grade.weak, cl: "bg-[#EF5350]" },
                ];
                return parts.map((p, i) => (
                  <div
                    key={i}
                    className={`${p.cl} h-full transition-all`}
                    style={{ width: `${(p.c / sum) * 100}%` }}
                  />
                ));
              })()}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[0.65rem] text-[var(--color-text-muted)]">
              <span>★ {stats.by_grade.excellent}</span>
              <span>● {stats.by_grade.good}</span>
              <span>▲ {stats.by_grade.needs_work}</span>
              <span>▼ {stats.by_grade.weak}</span>
            </div>
          </div>
        </div>
      ) : null}

      <PageCard>
        {hasMultipleRiwayat ? (
          <div className="max-w-xs">
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.riwaya")}</label>
            <FormSelect
              triggerClassName={FILTER_FIELD_CLASS}
              value={riwayaFilter || ""}
              onValueChange={(v) => setRiwayaFilter((v || "") as QuranRiwaya | "")}
              options={[
                { value: "", label: t("common.all") },
                ...getAvailableRiwayat().map((r) => ({
                  value: r.id,
                  label: t(`mushaf.${r.id}`),
                })),
              ]}
            />
          </div>
        ) : null}
        <div
          className={cn(
            "grid gap-3 md:grid-cols-2 lg:grid-cols-4",
            hasMultipleRiwayat ? "mt-4" : null,
          )}
        >
          <div className="space-y-2">
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.selectSurah")}</label>
            <SurahPicker
              value={surahFilter === "" ? null : surahFilter}
              onChange={(n) => setSurahFilter(n === null ? "" : n)}
              riwaya={riwayaFilter || "hafs"}
              allowClear
            />
          </div>
          {!isStudent ? (
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                {t("recitations.filterStudent")}
              </label>
              <FormSelect
                triggerClassName={FILTER_FIELD_CLASS}
                value={studentFilter}
                onValueChange={setStudentFilter}
                options={[
                  { value: "", label: t("recitations.allStudents") },
                  ...students.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.dateFrom")}</label>
            <input
              type="date"
              className={cn(FILTER_FIELD_CLASS, "min-h-11")}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.dateTo")}</label>
            <input
              type="date"
              className={cn(FILTER_FIELD_CLASS, "min-h-11")}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {gradeTabs.map((tab) => (
            <button
              key={tab.id || "all"}
              type="button"
              onClick={() => setGradeTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                gradeTab === tab.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-gray-100 text-[var(--color-text-muted)] hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </PageCard>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
        <Table<RecitationPublic>
          columns={columns}
          data={rows}
          emptyMessage={t("recitations.noRecitations")}
          rowKey={(r) => r.id}
          onRowClick={(r) => setExpandedRowId((prev) => (prev === r.id ? null : r.id))}
          isRowExpanded={(r) => expandedRowId === r.id}
          renderExpandedRow={(r) => (
            <div className="text-start">
              <p className="text-xs font-semibold text-[var(--color-text-muted)]">{t("recitations.expandNotes")}</p>
              <p dir="auto" className="mt-1 whitespace-pre-wrap text-[var(--color-text)]">
                {r.teacher_notes?.trim() || "—"}
              </p>
            </div>
          )}
        />
      )}

      <RecitationFormModal
        open={formOpen}
        mode="create"
        recitation={null}
        onClose={() => setFormOpen(false)}
        onSaved={() => void fetchAll()}
      />
      <RecitationFormModal
        open={editRec !== null}
        mode="edit"
        recitation={editRec}
        onClose={() => setEditRec(null)}
        onSaved={() => void fetchAll()}
      />
      <DeleteRecitationModal
        open={deleteRec !== null}
        recitation={deleteRec}
        onClose={() => setDeleteRec(null)}
        onConfirm={() => void confirmDelete()}
        loading={actionLoading}
      />
    </PageShell>
  );
}
