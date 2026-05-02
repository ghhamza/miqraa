# Cursor Prompt — Phase 4: Room Detail (`/rooms/:id`)

## Context

`RoomDetailPage` is currently a long vertical scroll: info card → student enrollment status → enrolled list → pending requests → sessions calendar/list → recent recitations. It works but a first-time teacher viewing their first room scrolls past most of it without context.

This phase tabs the page into 4 logical sections and gives each tab a proper empty state when relevant.

What already exists:
- `frontend/src/pages/rooms/RoomDetailPage.tsx` — the long page (≈900 lines).
- `frontend/src/components/ui/tabs.tsx` — Radix-based Tabs primitive.
- `frontend/src/components/ui/EmptyState.tsx` — Phase 0.
- All sub-components (`EnrolledStudentsList`, `PendingRequestsList`, `SessionBlock`, `SessionFormModal`, `RecitationFormModal`, `RecentRecitationsList`, calendar utils) — keep using them as-is.
- `useSearchParams` from `react-router-dom`.

Do **not** touch Mushaf, live session, terminology, or anything outside `RoomDetailPage` and its small extracted section components.

---

## Goal

Convert `RoomDetailPage` into a 4-tab layout. URL syncs via `?tab=`. Each tab has a clear empty state. The teacher knows what they can do here.

---

## 1. Tab structure

Four tabs, in this order:

| Tab key | Label key | Contains |
|---|---|---|
| `overview` | `roomDetail.tabOverview` | Info card (name, teacher, riwaya, halaqah type, capacity, created), student enrollment status block (for students viewing public rooms) |
| `students` | `roomDetail.tabStudents` | Enrolled students list + pending requests + Enroll button |
| `sessions` | `roomDetail.tabSessions` | Calendar/list toggle for sessions + Schedule session button |
| `recitations` | `roomDetail.tabRecitations` | Recent recitations + Log recitation button |

Default tab: `overview`.

---

## 2. Refactor approach

The current page is too large to tab inline cleanly. Extract each tab's content into a sibling component file. Suggested layout:

```
frontend/src/pages/rooms/sections/
  RoomOverviewSection.tsx
  RoomStudentsSection.tsx
  RoomSessionsSection.tsx
  RoomRecitationsSection.tsx
```

Each section receives the data and callbacks it needs as props. **Don't** make sections fetch their own data — fetching stays in `RoomDetailPage` (the page is the single source of truth for room state, enrollments, sessions, recitations). This avoids cascading refactors and keeps the existing `useCancellableEffect` data flow.

Section component prop shape (example):

```ts
interface RoomOverviewSectionProps {
  room: Room;
  user: User | null;
  isArchived: boolean;
  studentActionLoading: boolean;
  onStudentJoin: () => void;
  onLeaveRoom: () => void;
  onCancelPendingRequest: () => void;
}
```

---

## 3. URL sync

In `RoomDetailPage`:

```ts
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = (searchParams.get("tab") ?? "overview") as RoomTab;
const setActiveTab = (tab: RoomTab) => {
  setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set("tab", tab);
    return next;
  }, { replace: true });
};
```

`type RoomTab = "overview" | "students" | "sessions" | "recitations"`.

Validate the URL value — if it's not a known tab key, fall back to `overview` without redirecting (just ignore the bad value).

---

## 4. Tabs UI

Below the existing `PageShell` header (breadcrumb + title + actions), render the Tabs component:

```tsx
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RoomTab)}>
  <TabsList className="w-full justify-start overflow-x-auto">
    <TabsTrigger value="overview">{t("roomDetail.tabOverview")}</TabsTrigger>
    <TabsTrigger value="students">
      {t("roomDetail.tabStudents")}
      {room.pending_count > 0 && canManage(user, room) ? (
        <span className="ms-2 rounded-full bg-[var(--color-gold)]/15 px-1.5 py-0.5 text-xs font-semibold text-[var(--color-gold)]">
          {room.pending_count}
        </span>
      ) : null}
    </TabsTrigger>
    <TabsTrigger value="sessions">{t("roomDetail.tabSessions")}</TabsTrigger>
    <TabsTrigger value="recitations">{t("roomDetail.tabRecitations")}</TabsTrigger>
  </TabsList>

  <TabsContent value="overview" className="mt-6">
    <RoomOverviewSection ... />
  </TabsContent>
  <TabsContent value="students" className="mt-6">
    <RoomStudentsSection ... />
  </TabsContent>
  <TabsContent value="sessions" className="mt-6">
    <RoomSessionsSection ... />
  </TabsContent>
  <TabsContent value="recitations" className="mt-6">
    <RoomRecitationsSection ... />
  </TabsContent>
</Tabs>
```

The pending-count chip on the Students tab gives teachers a visual nudge inside the page itself, complementing the global indicator from Phase 2.

For students viewing a public room they're not in: hide the Students tab (they shouldn't see the enrolled list anyway — the existing `showActions` logic already handles list visibility, but at the tab level just don't render the trigger if `!showActions && user?.role === "student"`). The Recitations tab is also irrelevant for non-enrolled students — hide it too. They get just Overview and Sessions in that case.

---

## 5. Section content (P4.1 distribution)

### 5a. RoomOverviewSection

Contains:
- The existing **info card** (`PageCard` with name, teacher, riwaya, halaqah type, capacity, created date, public/enrollment-open/requires-approval flags).
- The **student enrollment status block** (`PageCard` showing approved/pending/rejected/join CTA — currently around line 447 of the page).

That's it. The breadcrumb and title stay in the parent's `PageShell`.

### 5b. RoomStudentsSection

Contains:
- The **enrolled students** card with header `t("enrollment.headerCount", ...)` and Enroll button. For students or non-managers, the existing "list restricted" message stays.
- The **pending requests** card (only when `showActions && room.pending_count > 0 && !isArchived`).
- The **Enroll modal** + **Remove modal** trigger states stay in the parent — section just calls callbacks.

### 5c. RoomSessionsSection

Contains the existing sessions block (calendar/list toggle, prev/next month, day cells, session blocks, "Schedule session" button). Big block — just relocate as-is.

### 5d. RoomRecitationsSection

Contains the existing "recent recitations" card with the Log recitation button.

---

## 6. Empty states per tab (P4.2)

Each tab gets a proper EmptyState when its data is empty. Use `<EmptyState>` (size `default`, not `large` — they live inside an already-framed page).

### 6a. Students tab (manager view, zero enrolled)

```tsx
<EmptyState
  icon={<Users className="h-12 w-12" />}
  title={t("roomDetail.studentsEmptyTitle")}
  description={t("roomDetail.studentsEmptyDescription")}
  primaryAction={
    !isArchived
      ? { label: t("enrollment.enrollStudent"), onClick: () => setEnrollOpen(true) }
      : undefined
  }
/>
```

### 6b. Sessions tab (zero sessions in current view)

The current page already shows blank cells when no sessions in the visible range — that's fine for the calendar view. But when **list view** is active and `sessions.length === 0` for the visible month:

```tsx
<EmptyState
  icon={<Calendar className="h-12 w-12" />}
  title={t("roomDetail.sessionsEmptyTitle")}
  description={t("roomDetail.sessionsEmptyDescription")}
  primaryAction={
    canManage(user, room) && !isArchived
      ? { label: t("sessions.addSession"), onClick: () => setSessionFormOpen(true) }
      : undefined
  }
/>
```

For the calendar view, skip the empty state — an empty calendar is self-explanatory and the user might just be navigating to a different month.

### 6c. Recitations tab (zero recitations)

```tsx
<EmptyState
  icon={<BookMarked className="h-12 w-12" />}
  title={t("roomDetail.recitationsEmptyTitle")}
  description={
    canManage(user, room)
      ? t("roomDetail.recitationsEmptyDescriptionTeacher")
      : t("roomDetail.recitationsEmptyDescriptionStudent")
  }
  primaryAction={
    canManage(user, room) && !isArchived
      ? { label: t("recitations.addRecitation"), onClick: () => setRecitationFormOpen(true) }
      : undefined
  }
/>
```

### 6d. Overview tab — no empty state

Overview always has content (room info card always renders). Skip.

---

## 7. Breadcrumb & title

Keep existing breadcrumb: `Home → Rooms → {room.name}`.

The page-level `actions` slot (in `PageShell`) currently has the management buttons (Edit / Archive / Restore). Keep them there — they apply to the whole room, not a specific tab.

---

## 8. Mobile considerations

`TabsList` with `overflow-x-auto` already handles overflow on narrow screens. Verify the labels don't truncate badly. If the pending-count chip pushes the Students tab over, that's acceptable — horizontal scroll handles it.

---

## i18n keys to add

`frontend/src/i18n/locales/{ar,en,fr}.json` under a new `roomDetail` namespace:

| Key | EN | AR | FR |
|---|---|---|---|
| `tabOverview` | Overview | نظرة عامة | Aperçu |
| `tabStudents` | Students | الطلاب | Élèves |
| `tabSessions` | Sessions | الحصص | Séances |
| `tabRecitations` | Recitations | التلاوات | Récitations |
| `studentsEmptyTitle` | No students enrolled yet | لا يوجد طلاب مسجَّلون بعد | Aucun élève inscrit |
| `studentsEmptyDescription` | Enroll your first student to start running this halaqah. | سجّل أوّل طالب لتبدأ تشغيل هذه الحلقة. | Inscrivez votre premier élève pour commencer cette halaqah. |
| `sessionsEmptyTitle` | No sessions scheduled | لا توجد حصص مجدولة | Aucune séance planifiée |
| `sessionsEmptyDescription` | Schedule the first session for this halaqah. | جدوِل الحصة الأولى لهذه الحلقة. | Planifiez la première séance pour cette halaqah. |
| `recitationsEmptyTitle` | No recitations logged yet | لم تُسجَّل أي تلاوة بعد | Aucune récitation enregistrée |
| `recitationsEmptyDescriptionTeacher` | Recitations you log will appear here. | ستظهر هنا التلاوات التي تسجّلها. | Les récitations que vous enregistrez apparaîtront ici. |
| `recitationsEmptyDescriptionStudent` | Your recitations will appear here once your teacher grades them. | ستظهر تلاواتك هنا فور تقييمها من المعلّم. | Vos récitations apparaîtront ici une fois évaluées par votre enseignant. |

---

## Design system reminder

- TabsList background uses the existing primitive defaults from `tabs.tsx`. Don't restyle.
- Pending count chip on Students tab: gold background, matches the rest of the app.
- EmptyState components inside tab panels use default size, sit inside `PageCard` if it makes the design consistent — or stand alone if the surrounding section already has a card. Pick whichever reads better in each section.
- Mobile: tabs scroll horizontally, content stacks naturally.

---

## Files touched

- `frontend/src/pages/rooms/RoomDetailPage.tsx` — major refactor: replace long scroll with Tabs.
- `frontend/src/pages/rooms/sections/RoomOverviewSection.tsx` (new).
- `frontend/src/pages/rooms/sections/RoomStudentsSection.tsx` (new).
- `frontend/src/pages/rooms/sections/RoomSessionsSection.tsx` (new).
- `frontend/src/pages/rooms/sections/RoomRecitationsSection.tsx` (new).
- `frontend/src/i18n/locales/{ar,en,fr}.json` — `roomDetail.*` keys.

---

## Do not touch

- `EnrolledStudentsList`, `PendingRequestsList`, `SessionBlock`, `SessionFormModal`, `RoomFormModal`, `ArchiveRoomModal`, `EnrollStudentModal`, `RemoveStudentModal`, `RecitationFormModal`, `RecentRecitationsList` — use them as-is, just relocate where they render.
- Calendar logic (`calendarUtils.ts`, week/month grid) — keep as-is.
- Backend — Phase 4 is frontend-only.
- Mushaf, live session, LiveKit.
- Terminology (room/halaqah/etc).

---

## Test instructions

1. **Teacher viewing own room with 5 students, 3 pending, 4 sessions, 12 recitations:** all 4 tabs visible, Students tab shows pending count chip "3". Switching tabs updates `?tab=` in URL. Refresh keeps the active tab. Back/forward browser buttons work.
2. **Direct URL `/rooms/abc?tab=sessions`:** lands on Sessions tab.
3. **Bad tab `?tab=banana`:** falls back to Overview without error.
4. **Teacher viewing brand-new room:** Students tab shows EmptyState with "Enroll student" CTA. Sessions list view shows EmptyState with "Schedule session" CTA. Recitations tab shows EmptyState with "Add recitation" CTA. Overview tab shows the info card normally.
5. **Student viewing public room they're not in:** only Overview and Sessions tabs visible. No Students/Recitations.
6. **Student enrolled (approved):** all 4 tabs visible. Students tab shows the "list restricted" message (as today). Recitations tab shows their own recitations or its empty state.
7. **Archived room:** all CTAs disabled or hidden as currently. Empty state CTAs respect `isArchived`.
8. **Modals:** Edit / Archive / Enroll / Remove / Schedule / Add Recitation all open and behave as before. Saving refreshes the page data and stays on the same tab.
9. **Mobile (narrow viewport):** TabsList scrolls horizontally. All content reflows correctly.
10. **RTL:** tab order flips, pending chip sits on the trailing edge, calendar arrows still rotate.
11. `npm run build` clean.

**Bulk import / broadcast messaging are deferred** — do not add. Add a single line `// TODO: bulk enrollment & broadcast (deferred to post-hackathon)` near the Enroll button in `RoomStudentsSection.tsx`.
