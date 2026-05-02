# Cursor Prompt — Phase 3: Rooms List

## Context

Phase 0 added `halaqah_type`, `riwaya`, `my_status` query params to `GET /api/rooms`, and shipped the `<EmptyState>` primitive. Phase 1 added a "Create halaqah" CTA on Home. Phase 2 added the global pending indicator and `?pending=1` URL param handling.

Now we polish `/rooms` itself:

1. Add halaqah-type and riwaya filter chips (frontend-only — backend already supports them).
2. Add student tabs: All / My rooms / Pending.
3. Make the active-filter visual indicator obvious so the "looks empty but isn't" trap goes away.
4. Replace the generic empty state with the new `<EmptyState>` primitive — different copy per role.
5. A11y cleanup on `RoomCard`: separate card-link navigation from action buttons, eliminate `stopPropagation` cascades.

What already exists:
- `frontend/src/pages/rooms/RoomsPage.tsx` — current page with search + active filter + grid.
- `frontend/src/components/rooms/RoomCard.tsx` — card with `role="link"` on the article, `stopPropagation` on actions.
- `frontend/src/components/ui/EmptyState.tsx` — Phase 0.
- `frontend/src/types/index.ts` — `RoomStats` now includes `pending_count_total` and `archived_count`.
- `RoomPublic.my_status` — `"approved" | "pending" | "rejected" | null`.
- `RoomPublic.halaqah_type`, `RoomPublic.riwaya` — already on the type.

Do **not** touch Mushaf, live session, terminology, or RoomDetailPage (Phase 4).

---

## Goal

A `/rooms` page where a teacher can find an active room fast, a student can clearly see what they're enrolled in vs. what they could join, and filtering is obvious.

---

## 1. Filter chips for halaqah type and riwaya (P3.1)

Create `frontend/src/components/rooms/RoomFilters.tsx`. Pure presentation component:

```ts
type HalaqahType = "hifz" | "tilawa" | "muraja" | "tajweed";
type Riwaya = "hafs" | "warsh" | "qalun";

interface RoomFiltersProps {
  halaqahType: HalaqahType | "";
  riwaya: Riwaya | "";
  activeFilter: "all" | "active" | "inactive";
  onHalaqahTypeChange: (v: HalaqahType | "") => void;
  onRiwayaChange: (v: Riwaya | "") => void;
  onActiveFilterChange: (v: "all" | "active" | "inactive") => void;
}
```

Layout (inside `<PageCard>` from Phase 1's pattern):

- Existing search input at top.
- Below the search, a visual "Filters" label and three rows of chips:
  1. **Status** chips: All / Active / Inactive (existing)
  2. **Halaqah type** chips: All / Hifz / Tilawa / Muraja'a / Tajweed
  3. **Riwaya** chips: All / Hafs / Warsh / Qalun

Reuse the existing chip styling from `RoomsPage` (the rounded pill buttons with `bg-[var(--color-primary)] text-white` when active, `bg-gray-100 text-[var(--color-text-muted)]` otherwise).

Show all three rows on desktop. On mobile (`<sm`) keep them stacked vertically — the existing chip rows already wrap, that's fine.

In `RoomsPage`:

- Add state: `halaqahFilter`, `riwayaFilter`.
- Pass to `RoomFilters` and wire up.
- Include them in the `useQuery` `queryKey` so refetch happens on change.
- Send to backend:

```ts
params: {
  ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
  ...(activeFilter === "all" ? {} : { active: activeFilter === "active" }),
  ...(halaqahFilter ? { halaqah_type: halaqahFilter } : {}),
  ...(riwayaFilter ? { riwaya: riwayaFilter } : {}),
  ...(myStatusFilter ? { my_status: myStatusFilter } : {}),  // see step 2
}
```

Replace the current inline chip row with `<RoomFilters>`. The existing chip styling moves into the new component.

---

## 2. Student tabs: All / My rooms / Pending (P3.2)

Visible only when `user?.role === "student"`.

In `RoomsPage`, above the filter card and below the page header (so they're the first thing students see), render a tab row:

```tsx
{user?.role === "student" ? (
  <div className="flex flex-wrap gap-2 border-b border-gray-100">
    {[
      { value: "", label: t("rooms.tabAll") },
      { value: "approved", label: t("rooms.tabMyRooms") },
      { value: "pending", label: t("rooms.tabPending") },
    ].map(({ value, label }) => (
      <button
        key={value || "all"}
        type="button"
        onClick={() => setMyStatusFilter(value as "" | "approved" | "pending")}
        className={cn(
          "border-b-2 px-3 py-2 text-sm font-medium transition",
          myStatusFilter === value
            ? "border-[var(--color-primary)] text-[var(--color-primary)]"
            : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
        )}
      >
        {label}
      </button>
    ))}
  </div>
) : null}
```

State: `const [myStatusFilter, setMyStatusFilter] = useState<"" | "approved" | "pending">("");`

When the tab is active:
- `""` (All) → no `my_status` param sent.
- `"approved"` → `my_status=approved`. Hide the "Join" CTA on cards (they're already enrolled).
- `"pending"` → `my_status=pending`. Hide Join, show pending state only.

Default tab: `""` (All).

**Rejected rooms:** by default the backend returns rejected rooms in the All tab. Add a small "Show rejected applications" link below the tab row when the **All** tab is active and at least one room in the result has `my_status === "rejected"`. Clicking it toggles a local state `showRejected`. When false, filter rejected rooms out of the rendered list (client-side). When true, show all and toggle text becomes "Hide rejected".

For teachers and admins: tabs are hidden, behaviour unchanged.

---

## 3. Active-filter visual indicator (P3.3)

Today, when `activeFilter !== "all"` and the result is empty, students/teachers see "No rooms yet." That's wrong — they have rooms, just filtered out.

Refine the empty branch in `RoomsPage`. Three states:

- **Result is empty AND no filters are applied** → empty state from step 4 below (role-appropriate hero).
- **Result is empty AND any filter is applied** → "No rooms match your filters" empty state with a "Clear filters" secondary action that resets `search`, `activeFilter` to `"all"`, `halaqahFilter`, `riwayaFilter`, `myStatusFilter`. Plus, for admins, a "View archived rooms" link → `/rooms/archived` if `roomStats?.archived_count && roomStats.archived_count > 0`.
- **Result has items** → render grid as today.

Compute `anyFilterApplied`:

```ts
const anyFilterApplied =
  search.trim() !== "" ||
  activeFilter !== "active" ||  // "active" is the default, treat anything else as "filtered"
  halaqahFilter !== "" ||
  riwayaFilter !== "" ||
  myStatusFilter !== "";
```

Wait — `activeFilter` defaults to `"active"` in the existing code. That **is** a filter. Decision: a user landing on `/rooms` with the default filter and no rooms should see the role-appropriate hero (step 4), not "no matches." So treat `"active"` as the baseline. Use the formula above.

When a user touches any filter beyond the baseline and the result is empty → show "no matches" state with "Clear filters" button.

---

## 4. Empty states using `<EmptyState>` (P3.4)

Replace the existing `DoorOpen` icon + "No rooms yet" block with `<EmptyState>`. Three variants:

### 4a. Teacher, no rooms, no filters

```tsx
<EmptyState
  size="large"
  icon={<DoorOpen className="h-16 w-16" />}
  title={t("rooms.emptyTeacherTitle")}
  description={t("rooms.emptyTeacherDescription")}
  primaryAction={{
    label: t("rooms.addRoom"),
    onClick: openCreate,
  }}
/>
```

### 4b. Student, no rooms, no filters

```tsx
<EmptyState
  size="large"
  icon={<DoorOpen className="h-16 w-16" />}
  title={t("rooms.emptyStudentTitle")}
  description={t("rooms.emptyStudentDescription")}
/>
```

For students, no CTA is needed — they're already on the rooms page. But if the **My rooms** tab is empty specifically, render this instead:

```tsx
<EmptyState
  icon={<DoorOpen className="h-12 w-12" />}
  title={t("rooms.emptyMyRoomsTitle")}
  description={t("rooms.emptyMyRoomsDescription")}
  primaryAction={{
    label: t("rooms.tabAll"),
    onClick: () => setMyStatusFilter(""),
  }}
/>
```

If the **Pending** tab is empty: similar pattern with `t("rooms.emptyPendingTitle")` and a CTA back to All.

### 4c. Admin, no rooms

```tsx
<EmptyState
  size="large"
  icon={<DoorOpen className="h-16 w-16" />}
  title={t("rooms.emptyAdminTitle")}
  description={t("rooms.emptyAdminDescription")}
/>
```

### 4d. "No matches" state (any role, filters applied)

```tsx
<EmptyState
  icon={<DoorOpen className="h-12 w-12" />}
  title={t("rooms.noMatchesTitle")}
  description={t("rooms.noMatchesDescription")}
  primaryAction={{
    label: t("rooms.clearFilters"),
    onClick: clearAllFilters,
  }}
  secondaryAction={
    user?.role === "admin" && (roomStats?.archived_count ?? 0) > 0
      ? { label: t("nav.archivedRooms"), to: "/rooms/archived" }
      : undefined
  }
/>
```

Where `clearAllFilters` resets all filter state.

---

## 5. RoomCard a11y cleanup (P3.5)

Currently the whole `<article role="link">` is the click target, with action buttons calling `e.stopPropagation()`. This works but produces noisy screen-reader output and is brittle.

Refactor `frontend/src/components/rooms/RoomCard.tsx`:

### 5a. Convert article to a real Link

- Drop `role="link"`, `tabIndex={0}`, the `onClick` and `onKeyDown` handlers.
- Wrap the **content** of the card in a `<Link to={`/rooms/${room.id}`} className="block">`. The Join button and management actions live as **siblings**, not inside the Link.

Structure:

```tsx
<article
  data-room-id={room.id}                // from Phase 2
  className="group rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
>
  <Link to={`/rooms/${room.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-xl">
    {/* title row, teacher, capacity, status badge — all the read-only content */}
  </Link>

  {/* Student Join section — outside the Link */}
  {user?.role === "student" && onJoin ? (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {/* existing student status / Join button */}
    </div>
  ) : null}

  {/* Manage actions — outside the Link, in an overflow menu */}
  {canManage ? (
    <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit} className="gap-2">
            <Pencil className="h-4 w-4" /> {t("common.edit")}
          </DropdownMenuItem>
          {room.is_active ? (
            <DropdownMenuItem onClick={onArchive} className="gap-2">
              <Archive className="h-4 w-4" /> {t("common.archive")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onRestore} className="gap-2">
              <RotateCcw className="h-4 w-4" /> {t("common.restore")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null}
</article>
```

### 5b. Remove all `e.stopPropagation()` calls

They're no longer needed because the action buttons are now siblings of the Link, not children of the navigation target.

### 5c. Imports to add

- `MoreVertical` from `lucide-react`
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from `../ui/dropdown-menu`
- `Link` from `react-router-dom`

### 5d. Verify hover state

The card-level `hover:-translate-y-0.5 hover:shadow-md` should still work because hover is on `<article>`. The Link inside picks up the focus ring for keyboard navigation.

---

## i18n keys to add

`frontend/src/i18n/locales/{ar,en,fr}.json` under `rooms`:

| Key | EN | AR | FR |
|---|---|---|---|
| `filterByHalaqahType` | Halaqah type | نوع الحلقة | Type de halaqah |
| `filterByRiwaya` | Riwaya | الرواية | Riwâya |
| `filterByStatus` | Status | الحالة | Statut |
| `tabAll` | All | الكل | Tous |
| `tabMyRooms` | My rooms | حلقاتي | Mes halaqat |
| `tabPending` | Pending | معلّقة | En attente |
| `showRejected` | Show rejected applications | إظهار الطلبات المرفوضة | Afficher les demandes refusées |
| `hideRejected` | Hide rejected applications | إخفاء الطلبات المرفوضة | Masquer les demandes refusées |
| `emptyTeacherTitle` | No halaqat yet | لا توجد حلقات بعد | Aucune halaqah |
| `emptyTeacherDescription` | Create your first halaqah to start teaching. | أنشئ حلقتك الأولى لتبدأ التدريس. | Créez votre première halaqah pour commencer à enseigner. |
| `emptyStudentTitle` | No public halaqat available | لا توجد حلقات متاحة | Aucune halaqah publique disponible |
| `emptyStudentDescription` | Check back soon — teachers create new halaqat regularly. | تحقّق لاحقًا — يُنشئ المعلّمون حلقات جديدة باستمرار. | Revenez plus tard — les enseignants créent régulièrement de nouvelles halaqat. |
| `emptyMyRoomsTitle` | You haven't joined any halaqat yet | لم تنضمّ إلى أي حلقة بعد | Vous n'avez rejoint aucune halaqah |
| `emptyMyRoomsDescription` | Browse public halaqat and request to join. | تصفّح الحلقات العامة وأرسل طلب انضمام. | Parcourez les halaqat publiques et demandez à rejoindre. |
| `emptyPendingTitle` | No pending requests | لا توجد طلبات معلّقة | Aucune demande en attente |
| `emptyPendingDescription` | Your enrollment requests will appear here. | ستظهر طلبات الانضمام الخاصة بك هنا. | Vos demandes d'inscription apparaîtront ici. |
| `emptyAdminTitle` | No halaqat in the system | لا توجد حلقات في النظام | Aucune halaqah dans le système |
| `emptyAdminDescription` | Once teachers create halaqat, they'll appear here. | عندما يُنشئ المعلّمون الحلقات، ستظهر هنا. | Lorsque les enseignants créent des halaqat, elles apparaîtront ici. |
| `noMatchesTitle` | No halaqat match your filters | لا توجد حلقات تطابق المرشحات | Aucune halaqah ne correspond aux filtres |
| `noMatchesDescription` | Try clearing some filters or adjusting your search. | حاول إزالة بعض المرشحات أو تعديل البحث. | Essayez d'effacer des filtres ou de modifier la recherche. |
| `clearFilters` | Clear filters | مسح المرشحات | Effacer les filtres |

---

## Design system reminder

- Filter chips: existing pill style, primary green when active, gray when inactive.
- Student tabs: underline-style tabs (border-b-2), primary color when active.
- EmptyState size: `large` for full-page empty (no rooms at all), default for filtered/empty-tab states.
- RTL: tabs and chip rows wrap correctly; underline indicator follows direction.

---

## Files touched

- `frontend/src/pages/rooms/RoomsPage.tsx` — main edits.
- `frontend/src/components/rooms/RoomFilters.tsx` (new).
- `frontend/src/components/rooms/RoomCard.tsx` — a11y refactor.
- `frontend/src/i18n/locales/{ar,en,fr}.json` — new keys.

---

## Do not touch

- Backend — Phase 0 already exposes the filters.
- `RoomFormModal`, `ArchiveRoomModal` — leave as-is.
- `RoomDetailPage` — Phase 4.
- `ArchivedRoomsPage` — only linked from "no matches" CTA, not modified.
- Mushaf, live session, terminology.

---

## Test instructions

1. **Teacher with rooms:** filter chips visible. Clicking "Hifz" filters. Backend log shows `?halaqah_type=hifz`. Combining with `?riwaya=hafs` works.
2. **Teacher with no rooms:** large EmptyState with "Create halaqah" CTA opens the modal.
3. **Student with no enrollments and no public rooms visible:** large EmptyState ("No public halaqat available").
4. **Student with mixed enrollments:** All / My rooms / Pending tabs. My rooms shows only `approved`. Pending shows only `pending`. All shows everything plus a "Show rejected" toggle if any are rejected.
5. **Filtered to empty:** "No halaqat match your filters" with "Clear filters" CTA. Click → all filters reset including `activeFilter` to `"active"`.
6. **Admin viewing empty filter result:** "No matches" empty state has secondary action "Archived rooms" if archived_count > 0.
7. **RoomCard click navigation:** clicking the card body goes to `/rooms/:id`. Clicking the overflow menu opens the dropdown — does NOT navigate. Clicking Edit in the menu opens the form modal — does NOT navigate. Tab key reaches the Link, then the menu, then the next card.
8. **Screen reader:** `data-room-id` is set; nav reads "Link, Halaqah Al-Fajr, …" once; menu reads "Actions menu" — no double announcement.
9. **`?pending=1` (from Phase 2 dropdown):** still scrolls to the first room with `pending_count > 0`.
10. RTL: tabs underline flips, chip rows wrap correctly, dropdown opens on correct side.
11. `npm run build` clean.
