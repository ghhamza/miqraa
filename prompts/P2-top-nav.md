# Cursor Prompt — Phase 2: Top Navigation Polish

## Context

Phase 0 added `pending_count_total` to `RoomStatsResponse`. Phase 1 polished the Home page. Now we polish the top navigation:

1. Remove the duplicated "Quran.Foundation" link from the mobile drawer.
2. Make icon usage consistent across primary nav items.
3. Surface a global "pending requests" indicator when teachers/admins have pending enrollments waiting for action.

What already exists:
- `frontend/src/components/layout/AppLayout.tsx` — the top bar, mobile sheet, avatar dropdown.
- The avatar dropdown already has a Settings link to `/settings` (which is the QF account links page) and a Profile link.
- `frontend/src/lib/api.ts` — Axios instance.
- `useAuthStore` — gives current user.
- `RoomStats` type already includes `pending_count_total` (Phase 0).

Do **not** touch Mushaf, live session, terminology, or anything outside `AppLayout.tsx` + a tiny addition to `RoomsPage` for URL-param handling.

---

## Goal

A clean, minimal top nav where every primary item is treated consistently, the mobile drawer doesn't duplicate the avatar menu, and teachers/admins get a visual nudge when pending requests need attention.

---

## 1. Remove "Quran.Foundation" from mobile drawer (P2.1)

In `AppLayout.tsx`, inside `renderNavLinks("column")`, the mobile drawer currently renders a `NavLink to="/settings"` labeled "Quran.Foundation" with a `LinkIcon`. **Remove this `NavLink` entirely** from the column-orientation render.

The `/settings` route remains accessible via the avatar dropdown (which is already there). The desktop nav (`renderNavLinks("row")` path / `NavigationMenu`) does **not** include this link — keep it that way.

The `Profile` link in the mobile drawer also overlaps with the avatar dropdown's Profile entry. Remove it from the mobile drawer too — the avatar is reachable on mobile (it's in the top bar). The mobile drawer should only contain the **primary navigation destinations**, not account/settings.

After this change, the mobile drawer should contain:
- Home
- Users (admin only)
- Rooms (with count badge)
- Calendar
- Recitations
- LIVE chip

That's it. Profile / Quran.Foundation / Logout stay in the avatar dropdown which is reachable via the avatar button in the top bar.

---

## 2. Icon parity in main nav (P2.2)

Currently:
- Home, Users, Rooms, Calendar — no icons
- Recitations — has `BookOpen` icon
- LIVE — special chip

Decision: **every primary nav item gets a small lucide icon** (16px, `opacity-80`), matching the Recitations style. The LIVE chip stays special.

Apply icons consistently to both the desktop `NavigationMenu` rendering and the mobile `renderNavLinks("column")` rendering.

| Nav item | Icon |
|---|---|
| Home | `Home` |
| Users | `Users` |
| Rooms | `DoorOpen` |
| Calendar | `Calendar` |
| Recitations | `BookOpen` (existing — keep) |

Imports go to the existing lucide import block. Wrap in a `<span className="inline-flex items-center gap-2">…</span>` like Recitations already does.

The Rooms count badge already lives inside the Rooms label — keep it inside the same span, after the text:

```tsx
<span className="inline-flex items-center gap-2">
  <DoorOpen className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
  <span>{t("nav.rooms")}</span>
  {roomsBadgeCount !== null ? (
    <span className="...">{...}</span>
  ) : null}
</span>
```

The `aria-hidden` on each icon keeps screen readers reading just the label.

---

## 3. Global pending-requests indicator (P2.3)

Visible only when `user.role === "teacher" || user.role === "admin"` AND `pending_count_total > 0`.

### 3a. Read the count

Already done in Phase 0 — `RoomStats.pending_count_total` is fetched via the existing `useCancellableEffect` in `AppLayout`. Currently only `roomCount` is stored. Add a second piece of state:

```tsx
const [pendingTotal, setPendingTotal] = useState<number | null>(null);
```

In the same effect:

```tsx
setRoomCount(data.total);
setPendingTotal(data.pending_count_total);
```

For students, the backend already returns `0` per Phase 0 — no role-side guard needed in the layout, but we hide the indicator for students in the next step anyway.

### 3b. Render a small dot badge on the avatar

Add an unread-style dot on the avatar button when `pendingTotal && pendingTotal > 0` and the user is teacher/admin:

```tsx
<button
  type="button"
  className="relative ..."   // existing classes + relative
  aria-label={user?.name ?? t("common.appName")}
>
  <Avatar className="size-9 border border-border">…</Avatar>
  {showPendingDot ? (
    <span
      aria-label={t("nav.pendingIndicator", { count: pendingTotal })}
      className="absolute -end-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-gold)] px-1 text-[0.6rem] font-bold leading-none text-[#1A1A1A] ring-2 ring-[var(--color-surface)]"
    >
      {pendingTotal > 9 ? "9+" : pendingTotal}
    </span>
  ) : null}
</button>
```

Where `showPendingDot = (user?.role === "teacher" || user?.role === "admin") && (pendingTotal ?? 0) > 0`.

### 3c. Add a "Pending requests" item to the avatar dropdown

Inside `<DropdownMenuContent>`, before the Profile item, add:

```tsx
{showPendingDot ? (
  <>
    <DropdownMenuItem
      className="cursor-pointer gap-2"
      onClick={() => navigate("/rooms?pending=1")}
    >
      <Bell className="h-4 w-4" />
      <span className="flex-1">{t("nav.pendingRequests")}</span>
      <span className="rounded-full bg-[var(--color-gold)]/15 px-1.5 py-0.5 text-xs font-semibold text-[var(--color-gold)]">
        {pendingTotal}
      </span>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
  </>
) : null}
```

`Bell` from lucide. Add it to the existing lucide import block.

### 3d. Handle `?pending=1` on RoomsPage

In `frontend/src/pages/rooms/RoomsPage.tsx`:

- Read `?pending=1` from the URL using `useSearchParams` (already imported in some pages — bring it in).
- When present, **don't** add a server-side filter (Phase 3 will add proper filters). Just scroll to the first room with `pending_count > 0`. Quickest implementation:

```tsx
useEffect(() => {
  if (params.get("pending") !== "1") return;
  if (loading || rooms.length === 0) return;
  const target = rooms.find((r) => r.pending_count > 0);
  if (!target) return;
  document
    .querySelector<HTMLElement>(`[data-room-id="${target.id}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}, [params, loading, rooms]);
```

Add `data-room-id={room.id}` to the `<RoomCard>` wrapper (in `RoomCard.tsx`, on the outer `<article>`). This is the only edit to `RoomCard.tsx` in this phase.

If no rooms have pending requests when `?pending=1` is present, do nothing — the user just lands on the rooms list as normal. Don't show an error.

---

## i18n keys to add

`frontend/src/i18n/locales/{ar,en,fr}.json` under `nav`:

| Key | EN | AR | FR |
|---|---|---|---|
| `pendingRequests` | Pending requests | طلبات معلّقة | Demandes en attente |
| `pendingIndicator` | {{count}} pending requests | {{count}} طلبات معلّقة | {{count}} demandes en attente |

---

## Design system reminder

- The pending dot uses gold (`#D4A843`), matching the existing `pending_count` chips on RoomCard.
- The dot is `4px` ring offset (`ring-2 ring-[var(--color-surface)]`) so it pops against the avatar.
- Icon sizing in nav: `h-4 w-4` everywhere.
- RTL: `-end-0.5` ensures the dot sits on the trailing edge regardless of direction.

---

## Files touched

- `frontend/src/components/layout/AppLayout.tsx` — main edits.
- `frontend/src/components/rooms/RoomCard.tsx` — add `data-room-id` only.
- `frontend/src/pages/rooms/RoomsPage.tsx` — add `?pending=1` scroll handling.
- `frontend/src/i18n/locales/{ar,en,fr}.json` — keys above.

---

## Do not touch

- `RoomsPage` filter UI / chips — that's Phase 3.
- `RoomCard` actions or layout — only add `data-room-id`.
- The LIVE chip — leave its styling as-is.
- The desktop `NavigationMenu` `viewport` setting and structure.
- Mushaf, live session, LiveKit.
- Backend code — this phase is frontend-only and consumes Phase 0's stats endpoint.

---

## Test instructions

1. **Mobile drawer (resize <768px):** open hamburger → only Home / Users (admin) / Rooms / Calendar / Recitations / LIVE chip visible. No "Quran.Foundation" or "Profile" inside the drawer.
2. **Desktop nav:** every primary nav item shows an icon. Spacing matches the existing Recitations item.
3. **Teacher with 3 pending requests across 2 rooms:** gold dot showing "3" appears on the avatar button. Avatar dropdown has "Pending requests" item with gold count chip. Click it → goes to `/rooms?pending=1` and scrolls to the first room with pending requests.
4. **Teacher with 0 pending:** no dot, no dropdown item.
5. **Student logged in:** no pending dot regardless (backend returns `0`).
6. **Admin with pending across multiple teachers' rooms:** dot appears, count is system-wide.
7. **`pending_count_total > 9`:** dot shows "9+".
8. RTL: dot sits on the correct edge, dropdown layout flips correctly.
9. `npm run build` clean.
