# Cursor Prompt — P1-FIX: Student First-Run + Polish Pass

## Context

Phases 1–8 mostly shipped. A new student logged in for the first time and the screens revealed several gaps. This is one consolidated fix prompt covering all of them. **Most of the structural work is already done** — what's left are surgical fixes to logic gates, missing copy variants, and one rendering bug.

What already exists and is correct:
- `frontend/src/components/ui/EmptyState.tsx` ✅
- `frontend/src/components/home/StudentEmptyHero.tsx` ✅
- `frontend/src/components/home/CombinedStreakCard.tsx` ✅
- `frontend/src/components/home/WhatsNewStrip.tsx` ✅
- `frontend/src/components/home/GettingStartedChecklist.tsx` ✅
- `frontend/src/components/recitations/FilterSheet.tsx` ✅
- `frontend/src/components/recitations/GradeDistributionBar.tsx` ✅ (clean colored-dot legend)
- All filter chips, tabs, calendar empty state, Live page strip ✅

This prompt only fixes what's wrong. **Do not** redo what's already shipped. **Do not** touch Mushaf, live session, LiveKit, or terminology.

---

## Goals

1. **The student empty hero must fire when `total_recitations === 0`, not only when `rooms.length === 0`.** A student with one enrolled room and zero recitations is still a first-time user — that's the case shown in the screenshot.
2. **Student greeting** should match teacher greeting style ("Welcome back, {{name}}"), not the bare "Welcome {{name}}" placeholder.
3. **Suppress the empty 114-surah grid** when no surahs are covered — it's anti-motivating.
4. **Calendar empty-state description** must not tell students to "add a new session." Different copy per role.
5. **Rooms stats cards** are wrong for students — they show admin/teacher metrics. Use role-aware labels and values.
6. **Recitations page has hand-rolled `★ ● ▲ ▼` glyphs** in the grade legend that render as ugly typographic symbols. Replace with the existing `GradeDistributionBar` which has a proper colored-dot legend.

---

## 1. Student dashboard — fire empty hero on zero recitations

File: `frontend/src/pages/HomePage.tsx`

Current code at line 462:

```tsx
if (rooms.length === 0) {
  return (
    <PageShell ...>
      <WhatsNewStrip role="student" />
      <LiveNowDashboardCard />
      <StudentEmptyHero />
    </PageShell>
  );
}
```

This is the wrong condition. Replace with **two** distinct branches:

### 1a. No rooms at all → existing hero, unchanged

Keep the current `rooms.length === 0` branch as-is. It handles "I just signed up, I have no halaqah."

### 1b. Has rooms but no recitations yet → new "starting out" hero

Add a second branch right after, before the existing dashboard render:

```tsx
const hasNoRecitations = (progress?.total_recitations ?? 0) === 0;

if (rooms.length > 0 && hasNoRecitations) {
  return (
    <PageShell
      titleSize="hero"
      title={t("home.studentGreeting", { name: user.name })}
      meta={dateLine}
      description={t("home.studentSubtitle")}
      contentClassName="space-y-8"
    >
      <WhatsNewStrip role="student" />
      <LiveNowDashboardCard />

      {/* Hero card explaining what's next */}
      <EmptyState
        size="large"
        icon={<BookMarked className="h-16 w-16" />}
        title={t("home.studentStartingTitle")}
        description={t("home.studentStartingDescription")}
      />

      {/* Show next session if there is one — this IS the actionable thing */}
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

      {/* Show enrolled rooms below — they need to know which halaqah is theirs */}
      <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("home.studentRooms")}</h2>
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
      </section>
    </PageShell>
  );
}
```

Make sure `BookMarked` is imported from `lucide-react` (already used elsewhere in the file — verify the import).

### 1c. Has rooms AND has recitations → existing full dashboard

The current "return" block from the existing code (line 478 onwards) handles this case. **Leave it unchanged**, except:

**Suppress the surah grid section when `surahs_covered.length === 0`.** The block currently rendered around line 545 (`<section>` containing `<SurahProgressGrid>`) should be wrapped:

```tsx
{progress && progress.surahs_covered.length > 0 ? (
  <section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("recitations.surahsCovered")}</h2>
      <Link to={`/students/${user.id}/progress`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
        {t("home.viewFullProgress")}
      </Link>
    </div>
    <SurahProgressGrid surahBestGrades={progress.surah_best_grades} />
  </section>
) : null}
```

This guard means even if a student lands here with zero coverage somehow, they don't see the grid of 114 grey boxes.

### 1d. Update the existing student "full dashboard" greeting

Currently line 481 uses `t("home.welcome", { name })`. Replace with `t("home.studentGreeting", { name })` to match the new hero. The shared `home.welcomeSubtitle` ("Welcome to the Quran learning platform") is too generic — replace its usage in the student dashboard with `home.studentSubtitle`.

There are 3 places in `StudentDashboard` that pass `title` and `description` to `<PageShell>`:
- The `rooms.length === 0` branch (existing, keep using `home.welcome` — or better, also switch to `home.studentGreeting`).
- The new `hasNoRecitations` branch (uses `home.studentGreeting` + `home.studentSubtitle`).
- The full dashboard branch (switch to `home.studentGreeting` + `home.studentSubtitle`).

Use the new keys consistently across all three.

---

## 2. Calendar empty-state description — split per role

File: `frontend/src/pages/sessions/CalendarPage.tsx`

Currently both branches (agenda empty + period empty) use a single description key that says "or add a new session." Students don't add sessions.

### 2a. Add role-aware description selection

Where the empty states are rendered (around line 308 and 333), change `description` to:

```tsx
description={manage ? t("sessions.monthEmptyDescriptionTeacher") : t("sessions.monthEmptyDescriptionStudent")}
```

For the agenda branch (around line 312):

```tsx
description={manage ? t("sessions.agendaEmptyDescriptionTeacher") : t("sessions.agendaEmptyDescriptionStudent")}
```

### 2b. Update i18n keys

Replace existing `sessions.monthEmptyDescription` and `sessions.agendaEmptyDescription` with two variants each (see i18n section below).

---

## 3. Rooms stats — role-aware labels and values

File: `frontend/src/pages/rooms/RoomsPage.tsx`

Currently around line 176, `statsRow` always renders Total / Active / Inactive. Wrong for students.

Replace with role-aware logic:

```tsx
const statsRow = stats ? (() => {
  if (user?.role === "student") {
    // Students care about: how many they're in, pending requests, total available.
    const myRoomsCount = rooms.filter((r) => r.my_status === "approved").length;
    const pendingMine = rooms.filter((r) => r.my_status === "pending").length;
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          { label: t("rooms.statsMyRoomsLabel"), value: myRoomsCount },
          { label: t("rooms.statsPendingLabel"), value: pendingMine },
          { label: t("rooms.statsAvailableLabel"), value: stats.total },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
            <p className="text-sm text-[var(--color-text-muted)]">{s.label}</p>
            <p className="mt-1 text-3xl font-bold" style={{ color: "var(--color-gold)" }}>{s.value}</p>
          </div>
        ))}
      </div>
    );
  }
  // Teachers and admins keep the existing Total / Active / Inactive view
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {[
        { label: t("rooms.statsTotalLabel"), value: stats.total },
        { label: t("rooms.statsActiveLabel"), value: stats.active },
        { label: t("rooms.statsInactiveLabel"), value: stats.inactive },
      ].map((s) => (
        <div key={s.label} className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm">
          <p className="text-sm text-[var(--color-text-muted)]">{s.label}</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: "var(--color-gold)" }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
})() : null;
```

Note: `myRoomsCount` and `pendingMine` are computed from the **client-side `rooms` array** which is already filtered by backend visibility for students. They reflect what the student can see. The third tile uses `stats.total` to show "halaqat available to you" — the backend's `rooms/stats` for a student already scopes to public + enrollment-visible rooms, which is the right number.

---

## 4. Recitations page — replace ugly inline glyph legend with `GradeDistributionBar`

File: `frontend/src/pages/recitations/RecitationsPage.tsx`

Around line 367–399, the page hand-rolls a colored bar plus a legend with `★ ● ▲ ▼` glyphs. The codebase already has `GradeDistributionBar` (in `components/recitations/GradeDistributionBar.tsx`) that does this properly with colored dots and proper labels.

### 4a. Find the import block

Add (or verify) the import near the top of the file:

```tsx
import { GradeDistributionBar } from "../../components/recitations/GradeDistributionBar";
```

### 4b. Replace the entire grade-bar block

Find the block that starts roughly at line 367 (the `<div>` containing the inline `flex h-3` colored bar, the `(() => { ... })()` IIFE, and the `★ ● ▲ ▼` legend) and replace it with:

```tsx
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
```

Match the wrapper structure of the surrounding stats row so the layout doesn't shift. Verify the parent grid still aligns the three stats cards (Total / This week / Grade distribution) the same way.

The `GradeDistributionBar` component handles the empty-total case internally (renders the muted "no recitations graded yet" message), so no extra guard is needed.

---

## 5. i18n keys

File: `frontend/src/i18n/locales/{ar,en,fr}.json`

### 5a. Add to `home`

| Key | EN | AR | FR |
|---|---|---|---|
| `studentGreeting` | Welcome back, {{name}} | مرحبًا بعودتك، {{name}} | Bon retour, {{name}} |
| `studentSubtitle` | Your Quran journey at a glance. | لمحة عن رحلتك القرآنية. | Votre parcours coranique en un coup d'œil. |
| `studentStartingTitle` | You're all set up | كل شيء جاهز | Vous êtes prêt |
| `studentStartingDescription` | Your recitations and progress will appear here once your teacher logs your first one. | ستظهر هنا تلاواتك وتقدّمك فور تسجيل المعلّم لأول تلاوة. | Vos récitations et progrès apparaîtront ici dès que votre enseignant aura enregistré la première. |

### 5b. Add to `sessions` (replace the existing single `monthEmptyDescription` and `agendaEmptyDescription` keys)

| Key | EN | AR | FR |
|---|---|---|---|
| `monthEmptyDescriptionTeacher` | Schedule a session or navigate to a different month. | جدوِل حصة أو تنقّل إلى شهر آخر. | Planifiez une séance ou changez de mois. |
| `monthEmptyDescriptionStudent` | No sessions are scheduled in this view. Try a different month. | لا توجد حصص مجدولة في هذه الفترة. جرّب شهرًا آخر. | Aucune séance planifiée dans cette vue. Essayez un autre mois. |
| `agendaEmptyDescriptionTeacher` | Schedule a session to see it here. | جدوِل حصة لتظهر هنا. | Planifiez une séance pour la voir ici. |
| `agendaEmptyDescriptionStudent` | No upcoming sessions in your halaqat right now. | لا توجد حصص قادمة في حلقاتك حاليًا. | Aucune séance à venir dans vos halaqat. |

If the existing `monthEmptyDescription` and `agendaEmptyDescription` keys are referenced elsewhere, leave them in the JSON but stop using them — easier to delete in a future cleanup than to risk a missing-key crash.

### 5c. Add to `rooms`

| Key | EN | AR | FR |
|---|---|---|---|
| `statsMyRoomsLabel` | My halaqat | حلقاتي | Mes halaqat |
| `statsPendingLabel` | Pending | معلّقة | En attente |
| `statsAvailableLabel` | Available halaqat | حلقات متاحة | Halaqat disponibles |

---

## Files touched

- `frontend/src/pages/HomePage.tsx` — student dashboard branching, surah grid guard, greeting key swaps.
- `frontend/src/pages/sessions/CalendarPage.tsx` — role-aware description on the two EmptyState calls.
- `frontend/src/pages/rooms/RoomsPage.tsx` — role-aware `statsRow`.
- `frontend/src/pages/recitations/RecitationsPage.tsx` — replace inline grade legend with `GradeDistributionBar`.
- `frontend/src/i18n/locales/{ar,en,fr}.json` — keys above.

---

## Do not touch

- Any of the new components: `StudentEmptyHero`, `CombinedStreakCard`, `WhatsNewStrip`, `GettingStartedChecklist`, `EmptyState`, `RoomFilters`, `FilterSheet`, `AgendaView`, `DaySessionsSheet`, `RecurrenceScopeModal`, `GradeDistributionBar`. They're correct.
- The student tabs (All / My rooms / Pending) on `RoomsPage` — already correct.
- The Live page subtitle and public-strip — already correct.
- Mushaf, live session shell, LiveKit, QF, terminology.
- Backend — this is frontend-only.

---

## Test instructions

### Student with one enrolled room and zero recitations (the screenshot scenario)

1. Log in as a student named "Student" (or any name) who has 1 approved enrollment and 0 recitations.
2. **Home page:**
   - Title reads "Welcome back, Student" (not "Welcome Student").
   - Subtitle reads "Your Quran journey at a glance." (not "Welcome to the Quran learning platform").
   - Hero EmptyState: "You're all set up" with the BookMarked icon and the description about teacher logging first recitation.
   - **No** progress overview card with empty rings.
   - **No** empty grade-distribution card.
   - **No** 114-surah grid of grey boxes.
   - "Next session" green card is shown if there's an upcoming session.
   - "My rooms" section lists their enrolled halaqah(s).

### Student with one enrolled room and at least one recitation

3. Log a recitation for the same student via teacher action, refresh.
4. Student now sees the **full dashboard**:
   - Greeting reads "Welcome back, {name}".
   - Progress overview card with ring, streak, total recitations.
   - Grade distribution card (with real numbers).
   - 114-surah grid (now visible because `surahs_covered.length > 0`).

### Student with zero enrolled rooms

5. Unenroll the student from all rooms.
6. Home page shows the existing "Find your first halaqah" empty hero (`StudentEmptyHero`). Unchanged from before.

### Calendar empty-state copy

7. As a student, open `/calendar`. With no sessions in the visible month, the empty state description reads "No sessions are scheduled in this view. Try a different month." — not the teacher-oriented "or add a new session."
8. As a teacher, same view, description reads "Schedule a session or navigate to a different month."
9. Switch to Agenda view, same role-aware split.

### Rooms stats per role

10. As a student on `/rooms`: stats cards read "My halaqat" / "Pending" / "Available halaqat" with appropriate counts.
11. As a teacher: stats cards still read "Total rooms" / "Active" / "Inactive".
12. As an admin: same as teacher.

### Recitations page

13. Open `/recitations` as any role. The grade-distribution stat card shows the proper colored bar plus the four-column legend with colored dots and translated labels (Excellent / Good / Needs work / Weak). No more `★ ● ▲ ▼` glyphs.
14. With zero recitations, the grade card shows the muted "No recitations graded yet" line via `GradeDistributionBar`'s built-in empty handling.

### General

15. RTL: switch to Arabic. Greeting reads "مرحبًا بعودتك، Student". Subtitle and hero description read in Arabic.
16. `npm run build` clean.
