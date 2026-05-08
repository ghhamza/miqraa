// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookMarked, SlidersHorizontal, TrendingUp } from "lucide-react";
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
import { GradeDistributionBar } from "../../components/recitations/GradeDistributionBar";
import { AyahRangeAudioButton } from "../../components/recitations/AyahRangeAudioButton";
import { RecitationFormModal } from "../../components/recitations/RecitationFormModal";
import { SurahPicker } from "../../components/recitations/SurahPicker";
import { DeleteRecitationModal } from "../../components/recitations/DeleteRecitationModal";
import { PageCard } from "../../components/layout/PageCard";
import { PageShell } from "../../components/layout/PageShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { FilterSheet } from "../../components/recitations/FilterSheet";
import { getAvailableRiwayat, getSurahNameWithArabic } from "../../lib/quranService";
import { riwayaBadgeClass } from "../../lib/riwayaUi";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { useApiMutation } from "../../lib/useApiMutation";
import { recitationKeys, roomKeys, userKeys } from "../../lib/queryKeys";
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

  const [surahFilter, setSurahFilter] = useState<number | "">("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [gradeTab, setGradeTab] = useState<GradeFilter>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [riwayaFilter, setRiwayaFilter] = useState<QuranRiwaya | "">("");
  const [formOpen, setFormOpen] = useState(false);
  const [editRec, setEditRec] = useState<RecitationPublic | null>(null);
  const [deleteRec, setDeleteRec] = useState<RecitationPublic | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const isStudent = user?.role === "student";
  const canAdd = user?.role === "teacher" || user?.role === "admin";

  const activeFilterCount = useMemo(
    () =>
      [surahFilter !== "", fromDate !== "", toDate !== "", studentFilter !== "", riwayaFilter !== ""].filter(Boolean)
        .length,
    [surahFilter, fromDate, toDate, studentFilter, riwayaFilter],
  );

  const hasAnyFilter = useMemo(
    () =>
      surahFilter !== "" ||
      gradeTab !== "" ||
      fromDate !== "" ||
      toDate !== "" ||
      studentFilter !== "" ||
      riwayaFilter !== "",
    [surahFilter, gradeTab, fromDate, toDate, studentFilter, riwayaFilter],
  );

  const clearAllFilters = useCallback(() => {
    setSurahFilter("");
    setGradeTab("");
    setFromDate("");
    setToDate("");
    setStudentFilter("");
    setRiwayaFilter("");
  }, []);

  const filters = useMemo(
    () => ({
      surah: surahFilter !== "" ? Number(surahFilter) : undefined,
      grade: gradeTab || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      student:
        studentFilter && (user?.role === "teacher" || user?.role === "admin")
          ? studentFilter
          : undefined,
    }),
    [surahFilter, gradeTab, fromDate, toDate, studentFilter, user?.role],
  );

  const listQuery = useQuery({
    queryKey: [
      ...recitationKeys.list(filters),
      { riwaya: riwayaFilter || null },
    ] as const,
    queryFn: async ({ signal }) => {
      const params: Record<string, string> = {};
      if (surahFilter !== "") params.surah = String(surahFilter);
      if (gradeTab) params.grade = gradeTab;
      if (fromDate) params.from = new Date(fromDate + "T00:00:00").toISOString();
      if (toDate) params.to = new Date(toDate + "T23:59:59").toISOString();
      if (studentFilter && (user?.role === "teacher" || user?.role === "admin")) {
        params.student_id = studentFilter;
      }
      if (riwayaFilter) params.riwaya = riwayaFilter;
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
        signal,
        params,
      });
      return data.items;
    },
    placeholderData: (prev) => prev,
  });

  const statsQuery = useQuery({
    queryKey: recitationKeys.stats(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<RecitationStats>("recitations/stats", { signal });
      return data;
    },
    staleTime: 60_000,
  });

  const rows = listQuery.data ?? [];
  const stats = statsQuery.data ?? null;
  const loading = listQuery.isPending && !listQuery.isPlaceholderData;

  const studentsQuery = useQuery({
    queryKey: [
      ...roomKeys.studentsList(),
      { scope: user?.role === "admin" ? "all" : `teacher:${user?.id ?? ""}` },
    ] as const,
    queryFn: async ({ signal }) => {
      if (!user) return [] as StudentOption[];
      if (user.role === "admin") {
        const { data } = await api.get<StudentOption[]>("students", { signal });
        return data;
      }
      const { data: roomsPage } = await api.get<Paginated<Room>>("rooms", { signal });
      const mine = roomsPage.items.filter((r) => r.teacher_id === user.id);
      const map = new Map<string, StudentOption>();
      for (const r of mine) {
        try {
          const { data: ens } = await api.get<
            { student_id: string; student_name: string; student_email: string }[]
          >(`rooms/${r.id}/enrollments`, { signal });
          for (const e of ens) {
            if (!map.has(e.student_id)) {
              map.set(e.student_id, {
                id: e.student_id,
                name: e.student_name,
                email: e.student_email,
              });
            }
          }
        } catch (err) {
          if ((err as { name?: string })?.name === "CanceledError") throw err;
        }
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!user && user.role !== "student",
    staleTime: 60_000,
  });

  const students = studentsQuery.data ?? [];

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

  const queryClient = useQueryClient();

  const deleteMutation = useApiMutation<void, RecitationPublic>({
    mutationFn: (rec) => api.delete(`recitations/${rec.id}`).then(() => undefined),
    invalidates: [recitationKeys.lists(), recitationKeys.stats()],
    onSuccess: async (_data, rec) => {
      if (rec.student_id) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: userKeys.studentRecitations(rec.student_id) }),
          queryClient.invalidateQueries({ queryKey: userKeys.studentProgress(rec.student_id) }),
        ]);
      }
      setDeleteRec(null);
    },
  });

  const actionLoading = deleteMutation.isPending;

  function confirmDelete() {
    if (!deleteRec) return;
    deleteMutation.mutate(deleteRec);
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
      description={t("recitations.subtitle")}
      actions={
        isStudent && user?.id ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant={canAdd ? "secondary" : "primary"}>
              <Link to={`/students/${user.id}/progress`}>{t("home.myProgress")}</Link>
            </Button>
            {canAdd ? (
              <Button type="button" variant="primary" onClick={() => setFormOpen(true)}>
                {t("recitations.addRecitation")}
              </Button>
            ) : null}
          </div>
        ) : canAdd || studentFilter ? (
          <div className="flex flex-wrap items-center gap-2">
            {!isStudent && studentFilter ? (
              <Button asChild variant="secondary">
                <Link to={`/students/${studentFilter}/progress`}>{t("recitations.viewProgressForStudent")}</Link>
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
            <p className="mb-3 text-xs font-medium text-[var(--color-text-muted)]">
              {t("recitations.gradeDistribution")}
            </p>
            <GradeDistributionBar
              excellent={stats.by_grade.excellent}
              good={stats.by_grade.good}
              needs_work={stats.by_grade.needs_work}
              weak={stats.by_grade.weak}
            />
          </div>
        </div>
      ) : null}

      <PageCard>
        <div className="md:hidden">
          <Button type="button" variant="secondary" onClick={() => setFilterSheetOpen(true)}>
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {t("recitations.filters")}
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-xs font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </span>
          </Button>
        </div>

        <FilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          surahFilter={surahFilter}
          fromDate={fromDate}
          toDate={toDate}
          studentFilter={studentFilter}
          riwayaFilter={riwayaFilter}
          students={students}
          showStudentFilter={!isStudent}
          showRiwayaFilter={hasMultipleRiwayat}
          onSurahChange={setSurahFilter}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onStudentChange={setStudentFilter}
          onRiwayaChange={setRiwayaFilter}
          onClear={() => {
            clearAllFilters();
            setFilterSheetOpen(false);
          }}
          onApply={() => setFilterSheetOpen(false)}
        />

        <div className="hidden md:block">
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
      ) : rows.length === 0 && !hasAnyFilter ? (
        <EmptyState
          icon={<BookMarked className="h-14 w-14" />}
          title={isStudent ? t("recitations.emptyStudentTitle") : t("recitations.emptyTeacherTitle")}
          description={isStudent ? t("recitations.emptyStudentDescription") : t("recitations.emptyTeacherDescription")}
          primaryAction={
            canAdd ? { label: t("recitations.addRecitation"), onClick: () => setFormOpen(true) } : undefined
          }
        />
      ) : rows.length === 0 && hasAnyFilter ? (
        <EmptyState
          icon={<BookMarked className="h-14 w-14" />}
          title={t("recitations.noMatchesTitle")}
          description={t("recitations.noMatchesDescription")}
          primaryAction={{ label: t("rooms.clearFilters"), onClick: clearAllFilters }}
        />
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
        onSaved={() => {
          // No-op: RecitationFormModal invalidates recitation keys itself.
        }}
      />
      <RecitationFormModal
        open={editRec !== null}
        mode="edit"
        recitation={editRec}
        onClose={() => setEditRec(null)}
        onSaved={() => {
          // No-op: RecitationFormModal invalidates recitation keys itself.
        }}
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
