# Cursor Prompt — Phase 6: Recitations (`/recitations`)

## Context

The Recitations page works but has three frictions:
1. Five filter controls + grade tabs in a row eat too much vertical space, especially on mobile.
2. The page title and the Student Progress page title overlap conceptually — users get confused which one to use.
3. Empty states are silent (just a blank table).

We refine without redesigning.

What already exists:
- `frontend/src/pages/recitations/RecitationsPage.tsx` — current page with filters, stats, table.
- `frontend/src/pages/recitations/StudentProgressPage.tsx` — aggregated view per student.
- `frontend/src/components/ui/sheet.tsx` — Radix Sheet primitive (used for the mobile filter sheet).
- `frontend/src/components/ui/EmptyState.tsx` — Phase 0.
- The five filters: surah, grade tabs, date range (from/to), student (teacher only), riwaya.

Do **not** touch Mushaf, live session, terminology. The deeper "log entries vs aggregated progress" rename is deferred — we just clarify with subtitle and a clear cross-link.

---

## Goal

Recitations page works well on mobile (filters not blocking the view), users know how it differs from "Progress," and empty states tell people what to do next.

---

## 1. Filters in a sheet on mobile (P6.1)

On `≥md` viewports, keep the current inline filter layout. On `<md`, collapse the non-grade filters into a single "Filters" button that opens a bottom sheet.

### 1a. Active filter count

Compute:

```ts
const activeFilterCount = [
  surahFilter !== "",
  fromDate !== "",
  toDate !== "",
  studentFilter !== "",
  riwayaFilter !== "",
].filter(Boolean).length;
```

Note: `gradeTab` is **not** counted — it stays inline as tabs above the table.

### 1b. Mobile button

Render only on `<md`:

```tsx
<div className="md:hidden">
  <Button
    type="button"
    variant="secondary"
    onClick={() => setFilterSheetOpen(true)}
  >
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
```

`SlidersHorizontal` from lucide.

### 1c. The sheet

Create `frontend/src/components/recitations/FilterSheet.tsx`:

```ts
interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  // existing filter values
  surahFilter: number | "";
  fromDate: string;
  toDate: string;
  studentFilter: string;
  riwayaFilter: QuranRiwaya | "";
  // option lists (passed in, not refetched)
  students: StudentOption[];
  showStudentFilter: boolean;
  // setters
  onSurahChange: (v: number | "") => void;
  onFromDateChange: (v: string) => void;
  onToDateChange: (v: string) => void;
  onStudentChange: (v: string) => void;
  onRiwayaChange: (v: QuranRiwaya | "") => void;
  onClear: () => void;
  onApply: () => void;
}
```

Layout: Radix `Sheet` with `side="bottom"`, full-width, max-h-[90vh] with internal scroll. Inside:

- Sheet header: title "Filters", close button.
- Body: each filter stacked vertically (Surah picker, From date, To date, Student select if applicable, Riwaya select).
- Footer (sticky): "Clear all" (secondary) on the start, "Apply" (primary) on the end.

The "Apply" button just closes the sheet — filter changes already trigger refetch on every set. So Apply is purely a confirm gesture. "Clear all" calls `onClear` which resets all filter values and closes.

### 1d. Inline filters on desktop

Keep the existing inline layout intact for `≥md`. Wrap it in `<div className="hidden md:block">` so it's hidden on mobile.

### 1e. Grade tabs stay inline always

The grade tabs (excellent/good/needs work/weak) work well on mobile — they're horizontal pills that wrap. Keep them visible at all viewport sizes, above the table. Don't move them into the sheet.

---

## 2. Distinguish Recitations log from Progress (P6.2)

We're not renaming the page (terminology pass deferred). We're disambiguating with a clearer subtitle and a prominent cross-link.

### 2a. Page subtitle

Currently `<PageShell>` for Recitations doesn't pass `description`. Add it:

```tsx
<PageShell
  ...
  description={t("recitations.subtitle")}
  ...
>
```

`recitations.subtitle`:
- EN: "Detailed log of every recitation entry."
- AR: "سجلّ تفصيلي لكل تلاوة."
- FR: "Journal détaillé de chaque récitation."

### 2b. Prominent "View progress" link

Already exists for students as a button in `actions`. For **teachers**, today only the `RecitationFormModal` action button is visible. Add a secondary "View student progress" navigation:

- If `studentFilter` is set (a teacher filtered to one student): show a secondary button in the page actions slot: `t("recitations.viewProgressForStudent")` → `/students/{studentFilter}/progress`.
- If `studentFilter` is not set: don't show this button.

Resulting `actions`:

```tsx
actions={
  <div className="flex flex-wrap items-center gap-2">
    {isStudent && user?.id ? (
      <Button asChild variant={canAdd ? "secondary" : "primary"}>
        <Link to={`/students/${user.id}/progress`}>{t("home.myProgress")}</Link>
      </Button>
    ) : null}
    {!isStudent && studentFilter ? (
      <Button asChild variant="secondary">
        <Link to={`/students/${studentFilter}/progress`}>
          {t("recitations.viewProgressForStudent")}
        </Link>
      </Button>
    ) : null}
    {canAdd ? (
      <Button type="button" variant="primary" onClick={() => setFormOpen(true)}>
        {t("recitations.addRecitation")}
      </Button>
    ) : null}
  </div>
}
```

### 2c. StudentProgressPage subtitle

Mirror with a clarifying subtitle on `StudentProgressPage`:

```tsx
description={t("recitations.studentProgress")}
```

It's already there — just verify. Then update its translation:

- EN: "Aggregated view of all recitations and progress."
- AR: "نظرة مجمَّعة على جميع التلاوات والتقدّم."
- FR: "Vue agrégée de toutes les récitations et progrès."

This is enough to disambiguate without a full rename.

---

## 3. Empty states (P6.3)

When the table has zero rows, replace it with `<EmptyState>`. Two variants based on whether filters are applied:

### 3a. No filters, no recitations

```tsx
const hasAnyFilter =
  surahFilter !== "" ||
  gradeTab !== "" ||
  fromDate !== "" ||
  toDate !== "" ||
  studentFilter !== "" ||
  riwayaFilter !== "";

{rows.length === 0 && !hasAnyFilter ? (
  <EmptyState
    icon={<BookMarked className="h-14 w-14" />}
    title={isStudent ? t("recitations.emptyStudentTitle") : t("recitations.emptyTeacherTitle")}
    description={isStudent ? t("recitations.emptyStudentDescription") : t("recitations.emptyTeacherDescription")}
    primaryAction={
      canAdd
        ? { label: t("recitations.addRecitation"), onClick: () => setFormOpen(true) }
        : undefined
    }
  />
) : ...}
```

### 3b. Filters applied, no matches

```tsx
{rows.length === 0 && hasAnyFilter ? (
  <EmptyState
    icon={<BookMarked className="h-14 w-14" />}
    title={t("recitations.noMatchesTitle")}
    description={t("recitations.noMatchesDescription")}
    primaryAction={{ label: t("rooms.clearFilters"), onClick: clearAllFilters }}
  />
) : ...}
```

`clearAllFilters` resets all filter state including `gradeTab`. Reuse the `rooms.clearFilters` key from Phase 3 — same string.

### 3c. Where to place

Inside the existing table container, replace `<Table>` with the EmptyState when rows is empty. The stats row above stays — even with no rows the user might be filtered to a slice that legitimately has zero entries.

---

## i18n keys to add

`frontend/src/i18n/locales/{ar,en,fr}.json` under `recitations`:

| Key | EN | AR | FR |
|---|---|---|---|
| `subtitle` | Detailed log of every recitation entry. | سجلّ تفصيلي لكل تلاوة. | Journal détaillé de chaque récitation. |
| `filters` | Filters | المرشحات | Filtres |
| `clearAllFilters` | Clear all | مسح الكل | Tout effacer |
| `apply` | Apply | تطبيق | Appliquer |
| `viewProgressForStudent` | View student progress | عرض تقدّم الطالب | Voir progrès de l'élève |
| `emptyStudentTitle` | No recitations yet | لا توجد تلاوات بعد | Aucune récitation pour l'instant |
| `emptyStudentDescription` | Your recitations will appear here once your teacher grades them. | ستظهر تلاواتك هنا فور تقييمها من المعلّم. | Vos récitations apparaîtront ici une fois évaluées par votre enseignant. |
| `emptyTeacherTitle` | No recitations logged yet | لم تُسجَّل أي تلاوة بعد | Aucune récitation enregistrée |
| `emptyTeacherDescription` | Log a recitation after a session to track student progress. | سجّل تلاوةً بعد كل حصة لتتبّع تقدّم الطلاب. | Enregistrez une récitation après une séance pour suivre les progrès. |
| `noMatchesTitle` | No recitations match your filters | لا توجد تلاوات تطابق المرشحات | Aucune récitation ne correspond aux filtres |
| `noMatchesDescription` | Try clearing some filters to broaden the results. | حاول إزالة بعض المرشحات لتوسيع النتائج. | Essayez d'effacer des filtres pour élargir les résultats. |

Update existing key:

| Key | EN | AR | FR |
|---|---|---|---|
| `studentProgress` | Aggregated view of all recitations and progress. | نظرة مجمَّعة على جميع التلاوات والتقدّم. | Vue agrégée de toutes les récitations et progrès. |

---

## Design system reminder

- Filter sheet: bottom sheet on mobile, no sheet on desktop.
- Sticky footer in sheet: subtle top border, white background, two buttons.
- Active filter count chip: primary green background, white text.
- Grade tabs stay inline at all viewports.
- EmptyState placement: inside the same content area where the table would sit.

---

## Files touched

- `frontend/src/pages/recitations/RecitationsPage.tsx` — main edits.
- `frontend/src/pages/recitations/StudentProgressPage.tsx` — subtitle key swap (one line).
- `frontend/src/components/recitations/FilterSheet.tsx` (new).
- `frontend/src/i18n/locales/{ar,en,fr}.json` — keys above.

---

## Do not touch

- `RecitationFormModal`, `DeleteRecitationModal`, `SurahPicker`, `AyahRangeAudioButton`, `GradeBadge`, `RecentRecitationsList` — leave as-is.
- Stats row at top of page — keep showing even when empty.
- Backend — Phase 6 is frontend-only.
- Mushaf, live session, LiveKit.
- Terminology rename — explicitly deferred.

---

## Test instructions

1. **Desktop (≥md):** inline filters visible, grade tabs above the table, no "Filters" button. Behaves as today.
2. **Mobile (<md):** "Filters" button visible with chip showing active count. Tapping opens the bottom sheet. Inside: all 5 non-grade filters. Apply closes sheet. Clear all resets filters and closes.
3. **Grade tabs:** always inline (mobile and desktop). Selecting "needs work" filters the table.
4. **No recitations, no filters:**
   - Student: EmptyState "No recitations yet — your recitations will appear here…", no CTA.
   - Teacher: EmptyState with "Add recitation" CTA.
5. **Filters applied, zero results:** "No recitations match your filters" with "Clear filters" CTA. Click → all filters reset.
6. **Teacher with `studentFilter` set:** "View student progress" secondary button appears in actions. Click → `/students/{id}/progress`.
7. **Teacher with no `studentFilter`:** no progress link in actions.
8. **Subtitle:** "Detailed log of every recitation entry." rendered under the page title.
9. **StudentProgressPage subtitle:** updated copy "Aggregated view…".
10. RTL: filter sheet slides up correctly, sticky footer buttons swap sides per direction. Grade tabs wrap correctly.
11. `npm run build` clean.
