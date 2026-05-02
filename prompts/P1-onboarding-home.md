# Cursor Prompt — Phase 1: Onboarding & Home

## Context

Phase 0 is done. `<EmptyState>` exists at `frontend/src/components/ui/EmptyState.tsx`. `RoomStats` now includes `pending_count_total` and `archived_count`.

This phase fixes the first-impression problem on the Home page. Right now both teachers and students land on dashboards full of zeros and tiny "browse rooms" links. We're going to:

1. Show a proper hero empty state when a teacher has 0 rooms.
2. Show a proper hero empty state when a student has 0 enrollments.
3. Trim the teacher dashboard from 6 stat tiles to 3 above the fold.
4. Add a "Create halaqah" primary CTA in the teacher Home header.
5. Fix the awkward English greeting copy.
6. Merge the dual streak cards (Miqraa + Quran.com) into one.
7. Promote "Recently graded" above "Upcoming" on the teacher dashboard, and dedupe today's session from the upcoming widget.

What already exists:
- `frontend/src/pages/HomePage.tsx` — three subcomponents: `AdminDashboard`, `TeacherDashboard`, `StudentDashboard`.
- `frontend/src/components/home/LiveNowDashboardCard.tsx`.
- `frontend/src/components/sessions/UpcomingSessionsWidget.tsx` — used on Home and Calendar.
- `frontend/src/components/rooms/RoomFormModal.tsx` — open/close + onSaved props.
- `frontend/src/components/recitations/SurahProgressRing.tsx`, `SurahProgressGrid.tsx`, `GradeDistributionBar.tsx`.
- `frontend/src/hooks/useQfStreak.ts` — returns `{ data, loading }` for QF streak.

Do **not** touch Mushaf, live session, or terminology.

---

## Goal

Restructure HomePage so that a brand-new user lands on a screen that tells them what to do next, and an existing user sees the most relevant info above the fold.

---

## 1. Teacher hero empty state (P1.1)

When `roomStats?.total === 0`, **replace** the current stat tiles + sections with a hero empty state. Keep `LiveNowDashboardCard` at the top (it's harmless when empty — it returns `null` when no live sessions).

Create `frontend/src/components/home/TeacherEmptyHero.tsx`:

- Uses `<EmptyState size="large">`.
- Icon: `BookOpen` from lucide, 64px.
- Title: `t("home.teacherEmptyTitle")` → "Welcome to Miqraa" / "مرحبًا بك في المقرأ" / "Bienvenue sur Miqraa".
- Description: `t("home.teacherEmptyDescription")` → "Create your first halaqah to start teaching students." (≈1 sentence in each language).
- Primary action: `t("home.teacherEmptyCta")` → "Create your first halaqah". `onClick` opens `RoomFormModal` (lift modal state to `TeacherDashboard`).

Below the EmptyState (still inside the empty-state branch), render a **getting-started checklist** using a new component `frontend/src/components/home/GettingStartedChecklist.tsx`:

- Three steps as horizontal pill rows:
  1. ✅/⬜ "Create your first halaqah" (checked when `roomStats.total > 0`)
  2. ⬜ "Schedule your first session" (checked when `sessionStats.total > 0`)
  3. ⬜ "Enroll your first student" (checked when at least one room has `enrolled_count > 0` — fetched from `rooms` list).
- Each row has the step label, checkmark on the leading edge, and a "→" link to the relevant page (rooms / calendar / first room detail).
- Once all three are checked, the whole checklist hides itself (returns `null`).

The checklist takes its data from props passed from `TeacherDashboard` — don't refetch.

When `roomStats.total > 0`, keep the existing dashboard layout (stat tiles + sections), but apply the rest of the changes below.

---

## 2. Student hero empty state (P1.2)

When the student has **zero approved/pending enrollments** (i.e. `rooms.length === 0`), **replace** the dashboard sections with a hero EmptyState.

Create `frontend/src/components/home/StudentEmptyHero.tsx`:

- Uses `<EmptyState size="large">`.
- Icon: `Users` from lucide, 64px.
- Title: `t("home.studentEmptyTitle")` → "Find your first halaqah".
- Description: `t("home.studentEmptyDescription")` → "Browse public halaqat and join one to start your Quran journey." (one sentence each language).
- Primary action: `t("home.studentEmptyCta")` → "Browse halaqat". Routes to `/rooms` — Phase 3 will add the proper student tabs there.

Keep `LiveNowDashboardCard` at the top, hide everything else (progress overview, grade distribution, surah grid, next session, rooms list, recitations widget).

When `rooms.length > 0`, keep the existing dashboard with the streak/grade/grid sections, plus the changes below.

---

## 3. Trim teacher dashboard tiles (P1.3)

In `TeacherDashboard`, currently there are 6 stat tile buttons in a `grid-cols-2 lg:grid-cols-3`. Reduce above-the-fold to 3:

- **My rooms** → `/rooms`
- **My students** → `/rooms`
- **This week's recitations** → `/recitations`

Wrap the remaining 3 (`Total recitations`, `Completed sessions`, `Attendance rate`) in a native HTML `<details>` disclosure:

```tsx
<details className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm">
  <summary className="cursor-pointer text-sm font-medium text-[var(--color-text-muted)]">
    {t("home.moreStats")}
  </summary>
  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
    {/* the three remaining tiles */}
  </div>
</details>
```

Closed by default. Use existing tile JSX, just relocate.

---

## 4. "Create halaqah" CTA in teacher Home header (P1.4)

In `TeacherDashboard`, pass `actions` to `<PageShell>`:

```tsx
actions={
  <Button type="button" variant="primary" onClick={() => setRoomFormOpen(true)}>
    <span className="inline-flex items-center gap-2">
      <Plus className="h-4 w-4" />
      {t("home.createHalaqah")}
    </span>
  </Button>
}
```

The same `setRoomFormOpen` is shared with the empty hero CTA. Render `<RoomFormModal open={roomFormOpen} mode="create" room={null} isAdmin={false} onClose={...} onSaved={...} />` once at the bottom of the dashboard. On `onSaved`, refetch the dashboard data (re-run the existing `useCancellableEffect` data load — easiest path: lift `loadData` into a `useCallback` and call it from `onSaved`).

Always show the button — even when rooms exist. (When rooms is 0, the empty hero also has a CTA — that's fine, redundant CTAs are OK here.)

---

## 5. Fix English greeting (P1.5)

In `frontend/src/i18n/locales/en.json`:

```json
"home": {
  "teacherGreeting": "Welcome back, {{name}}"
}
```

AR keep current: `"مرحبًا يا معلّم {{name}}"` — already natural. Or change to `"مرحبًا بعودتك، {{name}}"` if you prefer no role mention. **Pick one and apply consistently across ar/fr.**

FR: `"Bon retour, {{name}}"`.

---

## 6. Merge dual streak cards (P1.6)

Currently in `StudentDashboard` there are two streak cards rendered side-by-side when QF is linked:
- "Streak" (Miqraa local streak with orange flame).
- "Quran.com streak" (blue card with blue flame).

Replace both with a single `frontend/src/components/home/CombinedStreakCard.tsx`:

- One card.
- Header: `t("home.streakTitle")` → "Streak".
- Two columns inside (or stacked on `<sm`):
  - Left: orange `Flame`, label `t("home.miqraaStreak")` → "Miqraa", big number = `progress.streak_days`.
  - Right (only when `user.qf_linked`): blue `Flame`, label `t("home.qfStreak")` → "Quran.com", big number = `qfStreak?.days ?? "—"`.
- When QF not linked, show only the left column.
- When `progress.streak_days === 0`, show "Start your streak today" copy in the left column instead of the number.

Replace the two existing card blocks in `StudentDashboard` with this single component. Drop the now-unused 4-column grid and adjust to a 3-column layout (`SurahProgressRing` card / `CombinedStreakCard` / `Total recitations`).

---

## 7. Promote "Recently graded" + dedupe today vs upcoming (P1.7)

In `TeacherDashboard`:

- Move the "Recently graded recitations" section **above** `<UpcomingSessionsWidget />`.
- Pass an `excludeIds` prop to `UpcomingSessionsWidget` so today's session (if shown in the green "Today's session" card above) doesn't appear duplicated below.

Add the prop to `UpcomingSessionsWidget`:

```ts
interface UpcomingSessionsWidgetProps {
  maxItems?: number;
  showViewCalendarLink?: boolean;
  excludeIds?: string[];   // new
}
```

Filter out excluded IDs from the rendered list (still fetch all from backend; client-side filter).

In `TeacherDashboard`, compute `excludeIds = todaySession ? [todaySession.id] : []` and pass through.

---

## i18n keys to add

`frontend/src/i18n/locales/{ar,en,fr}.json` under `home`:

| Key | EN | AR | FR |
|---|---|---|---|
| `teacherEmptyTitle` | Welcome to Miqraa | مرحبًا بك في المقرأ | Bienvenue sur Miqraa |
| `teacherEmptyDescription` | Create your first halaqah to start teaching students. | أنشئ حلقتك الأولى لتبدأ تدريس الطلاب. | Créez votre première halaqah pour commencer à enseigner. |
| `teacherEmptyCta` | Create your first halaqah | أنشئ حلقتك الأولى | Créer ma première halaqah |
| `studentEmptyTitle` | Find your first halaqah | ابحث عن حلقتك الأولى | Trouvez votre première halaqah |
| `studentEmptyDescription` | Browse public halaqat and join one to start your Quran journey. | تصفّح الحلقات المتاحة وانضمّ إلى إحداها لتبدأ رحلتك القرآنية. | Parcourez les halaqat publiques et rejoignez-en une pour commencer votre parcours coranique. |
| `studentEmptyCta` | Browse halaqat | تصفّح الحلقات | Parcourir les halaqat |
| `gettingStartedTitle` | Getting started | للبدء | Pour commencer |
| `gettingStartedStep1` | Create your first halaqah | أنشئ حلقتك الأولى | Créer ma première halaqah |
| `gettingStartedStep2` | Schedule your first session | جدوِل حصتك الأولى | Planifier ma première séance |
| `gettingStartedStep3` | Enroll your first student | سجّل طالبك الأول | Inscrire mon premier élève |
| `moreStats` | More stats | المزيد من الإحصاءات | Plus de statistiques |
| `createHalaqah` | Create halaqah | إنشاء حلقة | Créer une halaqah |
| `streakTitle` | Streak | السلسلة | Série |
| `miqraaStreak` | Miqraa | المقرأ | Miqraa |

Existing keys to **change** (not add):

| Key | EN | AR | FR |
|---|---|---|---|
| `teacherGreeting` | Welcome back, {{name}} | مرحبًا بعودتك، {{name}} | Bon retour, {{name}} |

Existing AR/FR `qfStreak` is fine — don't duplicate.

---

## Design system reminder

- Use `<EmptyState size="large">` for both heroes.
- Primary buttons in primary green (`#1B5E20`), gold for emphasis only.
- Streak card: orange `text-orange-500` for the Miqraa flame, blue `text-blue-600` for QF.
- Stat tiles keep their current style — gold numbers, muted labels.
- RTL: layouts flip automatically; verify the streak card columns reverse correctly in AR.

---

## Files touched

- `frontend/src/pages/HomePage.tsx` — the main edits.
- `frontend/src/components/home/TeacherEmptyHero.tsx` (new).
- `frontend/src/components/home/StudentEmptyHero.tsx` (new).
- `frontend/src/components/home/GettingStartedChecklist.tsx` (new).
- `frontend/src/components/home/CombinedStreakCard.tsx` (new).
- `frontend/src/components/sessions/UpcomingSessionsWidget.tsx` — add `excludeIds` prop.
- `frontend/src/i18n/locales/{ar,en,fr}.json` — keys above.

---

## Do not touch

- `AdminDashboard` — leave as-is.
- The 114-surah grid (`SurahProgressGrid`) — only its container layout might shift slightly when `CombinedStreakCard` changes the row above; that's fine.
- `LiveNowDashboardCard` itself — keep top of dashboards unchanged.
- Any backend code — Phase 1 is frontend-only.
- `frontend/src/contexts/LiveSessionsContext.tsx` — no changes.
- Mushaf, live session shell, LiveKit, QF backend.

---

## Test instructions

1. **Teacher with zero rooms:** log in as fresh teacher. Should see hero empty state ("Welcome to Miqraa") with one big CTA + 3-step checklist below. Clicking CTA opens `RoomFormModal`. After saving, dashboard reloads and the hero/checklist disappears.
2. **Teacher with rooms:** dashboard renders. Header has "Create halaqah" button. Only 3 tiles above the fold; "More stats" disclosure is closed; expanding it reveals the other 3 tiles. Greeting reads "Welcome back, X" in EN.
3. **Student with zero enrollments:** hero empty state with "Browse halaqat" CTA → `/rooms`. No empty rings/grids visible.
4. **Student with enrollments + QF linked:** single combined streak card with two columns (Miqraa + Quran.com).
5. **Student with enrollments + no QF:** single streak card, only Miqraa column.
6. **Today's session present:** today card shows it. The Upcoming widget below does **not** show the same session.
7. RTL: switch to AR — empty hero, checklist, streak card all flip layout correctly.
8. `npm run build` clean.
