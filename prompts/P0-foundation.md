# Cursor Prompt — Phase 0: Foundation

## Context

This is the foundation phase for a UX/CRUD pass on Miqraa. The goal here is to put primitives in place that all later phases (1–8) will consume. **Do not** start adding empty states to specific pages in this phase — that comes later. Just ship the reusable building blocks.

What already exists:
- `frontend/src/components/layout/PageShell.tsx` — page shell with `actions` slot, breadcrumb, title, etc.
- `frontend/src/components/ui/` — Button, Input, Badge, Modal, Table, dialog, sheet, tabs, etc.
- `backend/src/api/handlers/rooms.rs` — `list_rooms` with `push_room_list_filters` helper. `room_stats` returns `total / active / inactive`.
- `backend/src/api/types.rs` — `RoomPublic`, `RoomStatsResponse`, `Paginated<T>`.

Do **not** touch Mushaf, live session SFU/LiveKit code, or terminology (room/halaqah).

---

## Goal of this phase

1. Build a reusable `<EmptyState>` component used by every page in later phases.
2. Extend the rooms list backend with `halaqah_type`, `riwaya`, `my_status` query params (additive, non-breaking).
3. Extend `room_stats` with `pending_count_total` and `archived_count`.
4. Quick verification pass on `PageShell.actions` usage — no code change expected, just confirm.

---

## 1. Frontend — `<EmptyState>` primitive

Create `frontend/src/components/ui/EmptyState.tsx`. Signature:

```ts
interface EmptyStateProps {
  icon?: React.ReactNode;        // lucide icon or null
  title: string;                  // already-translated string
  description?: string;           // already-translated string
  primaryAction?: { label: string; onClick?: () => void; to?: string };
  secondaryAction?: { label: string; onClick?: () => void; to?: string };
  className?: string;
  size?: "default" | "large";    // large used for hero-style empty states on Home
}
```

Behaviour:
- Centered vertically and horizontally inside a rounded `2xl` card (`bg-[var(--color-surface)]`, `border border-dashed border-gray-200`, generous padding: `py-16 px-6` default, `py-24 px-8` for `size="large"`).
- Icon block above title (40px default, 64px when `size="large"`), `opacity-40 text-[var(--color-text-muted)]`.
- Title: `text-lg font-semibold text-[var(--color-text)]` (`text-2xl` for large).
- Description: `text-sm text-[var(--color-text-muted)] max-w-md`.
- Action buttons row below: primary uses `<Button variant="primary">`, secondary uses `<Button variant="secondary">`. If `to` is set, wrap with `<Link>` via `asChild`.
- Stack actions vertically on `<sm`, side-by-side on `≥sm`.

**Do not** ship any per-page integrations in this phase. Just the component + a small Storybook-free smoke render in a comment.

### i18n keys (shared, used by future phases)

Add to `frontend/src/i18n/locales/{ar,en,fr}.json` under a new top-level `empty` namespace. Do not pre-populate per-page keys — those will be added by their respective phases. Just create the namespace skeleton and one shared example:

```json
"empty": {
  "genericTitle": "Nothing here yet",
  "genericDescription": "Content will appear here once available."
}
```

AR:
```json
"empty": {
  "genericTitle": "لا يوجد شيء هنا بعد",
  "genericDescription": "سيظهر المحتوى هنا عند توفّره."
}
```

FR:
```json
"empty": {
  "genericTitle": "Rien ici pour l'instant",
  "genericDescription": "Le contenu apparaîtra ici dès qu'il sera disponible."
}
```

---

## 2. Backend — extend `GET /api/rooms` filters

File: `backend/src/api/handlers/rooms.rs`

Extend `ListRoomsQuery`:

```rust
#[derive(Deserialize)]
pub struct ListRoomsQuery {
    pub search: Option<String>,
    pub active: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    /// New: filter by halaqah type. One of: hifz | tilawa | muraja | tajweed.
    pub halaqah_type: Option<String>,
    /// New: filter by riwaya. Validate via `parse_riwaya`.
    pub riwaya: Option<String>,
    /// New: student-only filter. One of: approved | pending | rejected | none (no enrollment).
    pub my_status: Option<String>,
}
```

Extend `push_room_list_filters` (in the same file) to handle the three new params:

- `halaqah_type` — validate via `parse_halaqah_type`. If invalid → return `Err(StatusCode::BAD_REQUEST)`. If valid, `qb.push(" AND r.halaqah_type::text = "); qb.push_bind(value);`.
- `riwaya` — validate via `parse_riwaya`. If invalid → `Err(StatusCode::BAD_REQUEST)`. Then `qb.push(" AND r.riwaya::text = "); qb.push_bind(value);`.
- `my_status` — student role only. Server-side ignore for non-students (don't error). For student:
  - `"approved" | "pending" | "rejected"` → `qb.push(" AND e_my.status = "); qb.push_bind(value);`
  - `"none"` → `qb.push(" AND e_my.status IS NULL");`
  - Anything else → `Err(StatusCode::BAD_REQUEST)`.

The `e_my` left join already exists in the student branch — `my_status` filtering re-uses it. **Do not** add a new join.

Make sure all four list call paths (`student` count, `student` select, `non-student` count, `non-student` select) keep working. The shared filter helper handles them uniformly.

---

## 3. Backend — extend `GET /api/rooms/stats`

File: `backend/src/api/types.rs`

Extend `RoomStatsResponse`:

```rust
#[derive(Serialize)]
pub struct RoomStatsResponse {
    pub total: i64,
    pub active: i64,
    pub inactive: i64,
    /// New: total pending enrollment requests across rooms visible to the caller.
    pub pending_count_total: i64,
    /// New: total archived (is_active=false) rooms visible to the caller.
    pub archived_count: i64,
}
```

File: `backend/src/api/handlers/rooms.rs` — `room_stats` handler.

Compute with the same role-scoping rules already used by `list_rooms`:

- **Admin:** all rooms.
- **Teacher:** rooms where `teacher_id = auth.id`.
- **Student:** public OR rooms where the student has any enrollment row. Active-only is **not** required for the stats — we want to count archived rooms too.

`pending_count_total`:
- Admin: `SELECT COUNT(*) FROM enrollments WHERE status = 'pending'`.
- Teacher: `SELECT COUNT(*) FROM enrollments e JOIN rooms r ON r.id = e.room_id WHERE r.teacher_id = $1 AND e.status = 'pending'`.
- Student: `0` (students never see "pending count" globally).

`archived_count`:
- Admin: `SELECT COUNT(*) FROM rooms WHERE is_active = false`.
- Teacher: `... AND teacher_id = $1`.
- Student: `0`.

`active` and `inactive` keep their current scoping. **Do not** break their current values.

---

## 4. Frontend — types

File: `frontend/src/types/index.ts`

Extend `RoomStats`:

```ts
export interface RoomStats {
  total: number;
  active: number;
  inactive: number;
  pending_count_total: number;
  archived_count: number;
}
```

This is the only frontend type change in Phase 0. **Do not** start consuming `pending_count_total` in the layout yet — that's Phase 2. **Do not** add `RoomFilters` props yet — that's Phase 3.

---

## 5. Verify, don't change — `PageShell.actions`

Open `frontend/src/components/layout/PageShell.tsx`. Confirm the `actions` slot renders to the right of the title and is responsive. **Do not modify.** If anything looks off, report back instead of changing it — Phase 1 will use this slot heavily for the new "Create halaqah" CTA and we want it stable.

---

## Design system reminder

- Background `#FAFAF5`, surface `#FFFFFF`, primary `#1B5E20`, primary-light `#4CAF50`, gold `#D4A843`, text `#1A1A1A`, muted `#6B7280`.
- Rounded `8–12px`, soft shadows, generous padding.
- RTL is the default.
- All UI text via `t()` keys.
- Use existing `<Button>` / `<Badge>` primitives.

---

## Do not touch

- Mushaf rendering, QCF fonts, live session pages, LiveKit hooks.
- Existing migrations or any database schema (this phase has **no** migrations).
- Terminology (room vs halaqah). Keep current strings as-is.
- Per-page empty states (Phase 1+ will add them using P0.1).

---

## Test instructions

Backend:
1. `cargo check` from `backend/`.
2. Manual: `curl 'localhost:8080/api/rooms?halaqah_type=hifz' -H 'Authorization: Bearer …'` → returns only hifz rooms.
3. `curl 'localhost:8080/api/rooms?riwaya=hafs'` → only Hafs rooms.
4. As a student: `curl 'localhost:8080/api/rooms?my_status=approved'` → only rooms the student is enrolled in (approved).
5. `curl 'localhost:8080/api/rooms?halaqah_type=banana'` → 400.
6. `curl 'localhost:8080/api/rooms/stats'` → response now includes `pending_count_total` and `archived_count`. Existing fields unchanged.

Frontend:
1. `npm run build` succeeds.
2. Render `<EmptyState title="Test" description="Hello" primaryAction={{ label: "Click", onClick: () => {} }} />` in any throwaway page — confirms layout, RTL, button styles.
3. Set language to AR — verify RTL flips icon/title alignment correctly.

---

## Out of scope for this phase (so don't sneak it in)

- Filter chips on `RoomsPage` — Phase 3.
- Empty states on individual pages — Phase 1+.
- Pending badge on top nav — Phase 2.
- Tabs on RoomDetailPage — Phase 4.
