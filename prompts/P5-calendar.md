# Cursor Prompt — Phase 5: Calendar (`/calendar`)

## Context

The Calendar page works but has four UX traps:
1. Students see "All rooms" by default which is unhelpful when they only have 1–2 rooms.
2. Clicking a day cell opens the Create-Session modal (teacher trap, student frustration) instead of showing that day's sessions.
3. There's no agenda/list view — bad mobile experience.
4. Recurring sessions have no visual indicator and no edit-series/edit-this prompt.
5. (Bonus) When the visible range is empty, the page silently shows blank cells with no CTA.

We fix all five.

What already exists:
- `frontend/src/pages/sessions/CalendarPage.tsx` — month/week views, room filter, session form modal trigger.
- `frontend/src/components/sessions/SessionBlock.tsx` — small clickable session block.
- `frontend/src/components/sessions/SessionFormModal.tsx` — create/edit session form.
- `frontend/src/components/sessions/DeleteSessionModal.tsx` — delete confirmation.
- `frontend/src/lib/calendarUtils.ts` — `toYmdLocal`, `startOfWeekMonday`, etc.
- `frontend/src/components/ui/sheet.tsx` — Radix Sheet primitive (use for day-sessions sheet).
- `frontend/src/components/ui/EmptyState.tsx` — Phase 0.
- `SessionPublic.recurrence_group_id`, `SessionPublic.recurrence_rule` — already on the type.
- Backend already supports the `recurrence_group_id` field. There's a `DELETE /api/sessions/groups/{id}` route used to delete a whole series.

Do **not** touch Mushaf, live session, terminology, or the Calendar's overall layout primitives. We're refining behaviour, not redesigning the calendar.

---

## Goal

A Calendar that's useful for students (not just teachers), readable on mobile, and respects the recurrence model when editing/deleting series.

---

## 1. Default room filter for students (P5.1)

Currently `roomFilter` defaults to `""` (All rooms). For students, this is unhelpful — they're typically in 1–3 rooms.

In `CalendarPage`, after rooms are fetched:

```ts
useEffect(() => {
  if (!user || user.role !== "student") return;
  if (rooms.length === 0) return;
  if (roomFilter !== "") return; // user already chose
  if (rooms.length === 1) {
    setRoomFilter(rooms[0].id);
  }
  // If 2-3 rooms, leave at "" (All) — they'll see all their stuff at once which is fine.
}, [user, rooms, roomFilter]);
```

Don't auto-set for teachers/admins (they may legitimately want to see across all their rooms).

For the room filter dropdown options, also add a "My rooms" pseudo-option for students with 2+ rooms. When selected, send no `room_id` (treat like "All") but visually communicate "All my rooms." This is a label-only change for students:

- Students see: `My rooms` (default, sends no `room_id`) | one option per room
- Teachers/admins see: existing `All rooms` | one option per room

---

## 2. Day cell click: show day, don't create (P5.2)

This is the biggest behaviour change in this phase.

**Current:** clicking the date number in a month-view day cell opens `SessionFormModal` prefilled with that date and a morning preset.

**New:** clicking a day cell (or its date number) opens a **bottom sheet** (mobile) or **side sheet** (desktop) showing all sessions for that day in a vertical list. From inside the sheet, a teacher/admin can tap "Schedule session" to create on that day; the prefill behaviour moves there.

Create `frontend/src/components/sessions/DaySessionsSheet.tsx`:

```ts
interface DaySessionsSheetProps {
  open: boolean;
  date: Date | null;
  sessions: SessionPublic[];
  user: User | null;
  onClose: () => void;
  onSessionClick: (s: SessionPublic) => void;
  onCreateSession: () => void; // opens the existing SessionFormModal prefilled with `date`
}
```

Sheet content:
- Title: full localized date (e.g. "Monday, 5 May 2026").
- If `sessions.length === 0`: an inline EmptyState ("No sessions on this day") with a "Schedule session" CTA visible only to teachers/admins.
- Otherwise, list of session blocks (re-use `SessionBlock`, non-compact mode). Tapping any goes to that session via `onSessionClick`.
- "Schedule session on this day" button at the bottom for teachers/admins.

Use Radix `Sheet` with `side="bottom"` on mobile (`<sm`), `side="end"` on desktop. Easiest: just use `side="bottom"` everywhere — bottom sheets work fine on desktop too and are more universal.

In `CalendarPage`:

- New state: `daySheetDate: Date | null`, `daySheetOpen: boolean`.
- Click handler on the day cell or date number sets `daySheetDate` and opens the sheet.
- Tapping "Schedule session" inside the sheet closes it and opens the existing `SessionFormModal` with `prefillDate = daySheetDate` and `presetMorning = true`. This preserves the existing prefill behaviour without baking it into the day-cell click.

Add a small `+` button per day cell (visible on hover/focus on desktop, always visible on mobile) for teachers/admins. This is the **only** affordance that opens the create modal directly without going through the sheet:

```tsx
{canManage ? (
  <button
    type="button"
    aria-label={t("sessions.scheduleOnDay", { date: ... })}
    className="absolute end-1 top-1 hidden h-6 w-6 items-center justify-center rounded-md border border-transparent text-[var(--color-primary)] opacity-0 transition group-hover:opacity-100 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 focus-visible:opacity-100 sm:flex"
    onClick={(e) => { e.stopPropagation(); openCreateForm(d); }}
  >
    <Plus className="h-4 w-4" />
  </button>
) : null}
```

Make the day cell `position: relative` and add `group` class for the hover-reveal.

For the **week view**, keep the existing behaviour for tap-to-create — week view is already a teacher-power tool and the day cells are bigger. Or apply the same sheet pattern if it's simple. Pick the simpler implementation; they should match if you can do it in one component.

---

## 3. Agenda view (P5.3)

Add a third view mode `"agenda"` next to month/week.

In the page header `actions` slot, add a third toggle button:

```tsx
<Button variant={view === "agenda" ? "primary" : "secondary"} onClick={() => setView("agenda")}>
  {t("sessions.agendaView")}
</Button>
```

`type ViewMode = "month" | "week" | "agenda"`.

Default view changes:
- On screens `<sm` (use `window.innerWidth` once at mount, or just always default to agenda when on a mobile-sized viewport), default to `"agenda"`.
- On screens `≥sm`, default to `"month"` (current behaviour).

Easiest detection: a small `useEffect` on mount:

```ts
useEffect(() => {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
    setView("agenda");
  }
}, []);
```

Don't react to resize after mount — that would jerk the user around mid-session.

Create `frontend/src/components/sessions/AgendaView.tsx`:

```ts
interface AgendaViewProps {
  sessions: SessionPublic[];   // already filtered by room and range
  onSessionClick: (s: SessionPublic) => void;
}
```

Render: sessions grouped by day. Each day group has a header (full localized date with "Today"/"Tomorrow" labels for relevant dates) and a vertical list of sessions in chronological order. If two sessions overlap, just list them — no special handling.

Range for agenda: same as month view today. Reuse the existing `range` calculation and the existing `fetchSessions` — no new API call.

Empty agenda branch:

```tsx
{sessions.length === 0 ? (
  <EmptyState
    icon={<Calendar className="h-12 w-12" />}
    title={t("sessions.agendaEmptyTitle")}
    description={t("sessions.agendaEmptyDescription")}
    primaryAction={
      canManage
        ? { label: t("sessions.addSession"), onClick: () => setFormOpen(true) }
        : undefined
    }
  />
) : ...}
```

---

## 4. Recurring-session indicator + edit-series prompt (P5.4)

### 4a. Visual indicator on session blocks

In `SessionBlock.tsx`, when `session.recurrence_group_id != null`, render a small ↻ badge in the corner:

```tsx
{session.recurrence_group_id ? (
  <Repeat
    className="ms-1 h-3 w-3 shrink-0 opacity-70"
    aria-label={t("sessions.recurringIndicator")}
  />
) : null}
```

Use `Repeat` from lucide. `aria-label` for screen readers. Don't add to compact-mode if it causes layout issues.

Also surface it in `AgendaView` rows (same icon next to the title).

### 4b. Edit-series / Edit-this prompt

When the user clicks Edit on a session that has `recurrence_group_id`, show a small modal asking which scope to edit:

- "Only this session" → opens `SessionFormModal` for that single session as today.
- "This and future sessions" → opens form, on submit applies to all sessions in the group with `scheduled_at >= this.scheduled_at`.
- "All sessions in series" → opens form, applies to all in the group.

Same pattern for delete. Both modal flows reuse a single new component:

`frontend/src/components/sessions/RecurrenceScopeModal.tsx`:

```ts
interface RecurrenceScopeModalProps {
  open: boolean;
  mode: "edit" | "delete";
  sessionTitle: string;
  onClose: () => void;
  onChoose: (scope: "this" | "this_and_future" | "all") => void;
}
```

Three radio buttons, one Continue button. Translated copy.

**Backend verification step before implementing:**

Confirm the backend supports these three scopes:
- `"this"`: existing `PUT/DELETE /api/sessions/{id}` already handles single-session updates/deletes.
- `"all"`: existing `DELETE /api/sessions/groups/{group_id}` (verify in `backend/src/api/router.rs`). For edit-all, you may need to send updates to each session in the group sequentially client-side, or add a backend bulk endpoint.
- `"this_and_future"`: not present today. Two implementation options:
  1. **Frontend-only:** fetch all sessions in the group, filter to `scheduled_at >= current.scheduled_at`, send one `PUT/DELETE` per id. Acceptable for ≤ ~20 sessions.
  2. **Backend bulk endpoint:** `DELETE /api/sessions/groups/{group_id}/from/{iso_date}` and `PUT /api/sessions/groups/{group_id}/from/{iso_date}` (with payload). Cleaner, transactional, atomic.

**Recommended:** add the two backend bulk endpoints — simpler client code, atomic semantics, and the schema already has `recurrence_group_id` indexed. Implementation skeleton:

```rust
// backend/src/api/handlers/sessions.rs
pub async fn delete_group_from_date(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path((group_id, iso_date)): Path<(Uuid, String)>,
) -> Result<Json<DeleteGroupResult>, StatusCode> {
    require_teacher_or_admin(&auth)?;
    let from = chrono::DateTime::parse_from_rfc3339(&iso_date)
        .map_err(|_| StatusCode::BAD_REQUEST)?
        .with_timezone(&chrono::Utc);
    // Verify caller owns one of the rooms in this group, or is admin.
    // ... existing ownership check pattern ...
    let res = sqlx::query(
        "DELETE FROM sessions WHERE recurrence_group_id = $1 AND scheduled_at >= $2"
    )
    .bind(group_id)
    .bind(from)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(DeleteGroupResult { deleted: res.rows_affected() as i32 }))
}
```

Wire in `router.rs`: `.route("/api/sessions/groups/{group_id}/from/{iso_date}", delete(...))`.

For edit-from-date, follow the same pattern with `UPDATE` and the existing edit payload shape. Reuse the request struct from the single-session update handler.

If you decide bulk endpoints are too much for this phase, fall back to client-side per-session calls and document the choice as a TODO comment. The user-visible behaviour is the same.

### 4c. Wire it up

In `SessionDetailPage` (where Edit/Delete buttons live) and any other place where a session is edited/deleted:

```tsx
const handleEditClick = () => {
  if (session.recurrence_group_id) {
    setRecurrenceScopeOpen({ mode: "edit" });
  } else {
    setSessionFormOpen(true);
  }
};
```

After the user picks a scope, set a state variable like `editScope: "this" | "this_and_future" | "all"` and pass it into the form modal so the submit handler dispatches to the right API.

### 4d. Surface in calendar contexts

In `DaySessionsSheet` and `AgendaView`, sessions with a recurrence group show the ↻ icon. Tapping them goes to the session detail where the scope prompt appears on Edit/Delete.

---

## 5. Calendar empty state (P5.5)

When `view === "month" || view === "week"` and `sessions.length === 0` and the page is **not** loading:

- Don't replace the whole calendar. The grid is informative even when empty (it's the structure of the month).
- **Do** render an `EmptyState` **above** the grid (or as an overlay banner) with:
  - title: "No sessions in this {{period}}" (period = month or week)
  - description: explanation
  - primary action: "Schedule session" for teachers/admins, none for students

Place it in a `<PageCard padding="md">` block above the grid. Don't over-style — keep it visually quiet so it doesn't compete with the calendar.

For the agenda view, the empty state from step 3 already covers this — no extra work.

---

## i18n keys to add

`frontend/src/i18n/locales/{ar,en,fr}.json` under `sessions`:

| Key | EN | AR | FR |
|---|---|---|---|
| `agendaView` | Agenda | جدول | Agenda |
| `agendaEmptyTitle` | No upcoming sessions | لا توجد حصص قادمة | Aucune séance à venir |
| `agendaEmptyDescription` | Schedule a session to see it here. | جدوِل حصة لتظهر هنا. | Planifiez une séance pour la voir ici. |
| `daySheetTitle` | {{date}} | {{date}} | {{date}} |
| `daySheetEmpty` | No sessions on this day | لا توجد حصص في هذا اليوم | Aucune séance ce jour |
| `scheduleOnDay` | Schedule session on {{date}} | جدوِل حصة في {{date}} | Planifier une séance le {{date}} |
| `recurringIndicator` | Recurring session | حصة متكرّرة | Séance récurrente |
| `recurrenceScopeTitle` | This is a recurring session | هذه حصة متكرّرة | Séance récurrente |
| `recurrenceScopeQuestionEdit` | Which sessions do you want to edit? | أيّ الحصص تريد تعديلها؟ | Quelles séances voulez-vous modifier ? |
| `recurrenceScopeQuestionDelete` | Which sessions do you want to delete? | أيّ الحصص تريد حذفها؟ | Quelles séances voulez-vous supprimer ? |
| `recurrenceScopeThis` | Only this session | هذه الحصة فقط | Cette séance uniquement |
| `recurrenceScopeFuture` | This and future sessions | هذه والحصص اللاحقة | Cette séance et les suivantes |
| `recurrenceScopeAll` | All sessions in series | جميع حصص السلسلة | Toutes les séances de la série |
| `monthEmptyTitle` | No sessions this month | لا توجد حصص هذا الشهر | Aucune séance ce mois-ci |
| `weekEmptyTitle` | No sessions this week | لا توجد حصص هذا الأسبوع | Aucune séance cette semaine |
| `monthEmptyDescription` | Schedule a session or navigate to a different month. | جدوِل حصة أو تنقّل إلى شهر آخر. | Planifiez une séance ou changez de mois. |

For `myRoomsFilterLabel` (the "My rooms" pseudo-option for students): use `rooms.tabMyRooms` from Phase 3 — already exists.

---

## Design system reminder

- ↻ recurrence icon: `text-[var(--color-text-muted)]` opacity 70%.
- Day-cell `+` button: appears on hover only on desktop, always visible on mobile (touch).
- Agenda day groups: subtle border-bottom under the date header, sessions stacked.
- Bottom sheet: full-width on mobile, max-w-md centered on desktop. Uses existing Radix Sheet styling.

---

## Files touched

### Frontend
- `frontend/src/pages/sessions/CalendarPage.tsx` — main edits.
- `frontend/src/pages/sessions/SessionDetailPage.tsx` — wire recurrence scope modal into Edit/Delete.
- `frontend/src/components/sessions/DaySessionsSheet.tsx` (new).
- `frontend/src/components/sessions/AgendaView.tsx` (new).
- `frontend/src/components/sessions/RecurrenceScopeModal.tsx` (new).
- `frontend/src/components/sessions/SessionBlock.tsx` — add ↻ icon when `recurrence_group_id`.
- `frontend/src/components/sessions/SessionFormModal.tsx` — accept optional `editScope` prop and apply to PUT request.
- `frontend/src/components/sessions/DeleteSessionModal.tsx` — accept optional `deleteScope` prop.
- `frontend/src/i18n/locales/{ar,en,fr}.json` — keys above.

### Backend (only for P5.4 if you choose the bulk-endpoint path)
- `backend/src/api/handlers/sessions.rs` — add `delete_group_from_date` and `update_group_from_date` handlers.
- `backend/src/api/router.rs` — wire two new routes.
- `backend/src/api/types.rs` — reuse `DeleteGroupResult`. Add an `UpdateGroupResult { updated: i32 }` if needed.

---

## Do not touch

- The calendar grid math (`calendarUtils.ts`) — keep as-is.
- `SessionFormModal`'s form fields — only its submit handler dispatches to the right API based on `editScope`.
- Mushaf, live session, LiveKit.
- Terminology.

---

## Test instructions

1. **Student with one room:** roomFilter auto-selects that room. With 2+ rooms, defaults to "My rooms" pseudo-option.
2. **Day-cell click on month view:** opens day sheet with that day's sessions. No SessionFormModal opens directly.
3. **Day with no sessions:** sheet says "No sessions on this day". Teacher sees "Schedule session" CTA inside.
4. **Hover desktop day cell as teacher:** small `+` button appears top-right; clicking opens SessionFormModal with that date prefilled, no sheet.
5. **Mobile viewport on first load:** Agenda view is the default. List of day-grouped sessions. Tapping one navigates to detail.
6. **Empty agenda:** EmptyState with "Schedule session" CTA (teacher) or no CTA (student).
7. **Recurring session block:** shows ↻ icon. Click → detail page. Click Edit → RecurrenceScopeModal asks scope. Choose "Only this" → form opens for one session. Choose "All in series" → form opens, submit applies to all in group. Choose "This and future" → applies from current `scheduled_at` onwards.
8. **Delete on a recurring session:** same scope modal, three options.
9. **Backend (if bulk endpoints implemented):** `cargo check` clean. `curl -X DELETE "/api/sessions/groups/{id}/from/2026-05-15T00:00:00Z"` returns `{ "deleted": N }`.
10. **Empty month grid:** small empty-state card above the grid with "No sessions this month" and a "Schedule session" CTA for teachers.
11. RTL: arrows rotate, agenda day headers align right, sheet opens from bottom.
12. `npm run build` clean.
