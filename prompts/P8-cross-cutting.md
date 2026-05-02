# Cursor Prompt — Phase 8: Cross-cutting Polish

## Context

Phases 0–7 covered the major page-level work. This phase is the cleanup pass:

1. Empty-state audit on every list page that wasn't covered explicitly (Users, ArchivedRooms, StudentProgress, SessionDetail, Profile, etc.) — make sure they all use `<EmptyState>` consistently.
2. Add a "What's new since last visit" strip on Home — a subtle, dismissible banner showing what changed since the user last logged in.

Item 2 is the only invasive change in this plan: it requires a new migration, a new endpoint, and a `last_seen_at` column on the users table.

What already exists:
- `frontend/src/components/ui/EmptyState.tsx` — Phase 0.
- `frontend/src/pages/users/UsersPage.tsx`, `UserDetailPage.tsx`.
- `frontend/src/pages/rooms/ArchivedRoomsPage.tsx`.
- `frontend/src/pages/recitations/StudentProgressPage.tsx`.
- `frontend/src/pages/sessions/SessionDetailPage.tsx`.
- `frontend/src/pages/profile/ProfilePage.tsx`.
- `frontend/src/pages/settings/AccountLinksPage.tsx`.
- `backend/migrations/` — last migration is `015_qf_sync_tracking.sql`. New: `016_user_last_seen.sql`.
- `backend/src/api/handlers/auth.rs` — has `me` handler. We'll update `last_seen_at` from there.

Do **not** touch Mushaf, live session, terminology, or anything inside the per-page improvements already shipped in Phases 1–7.

---

## Goal

A consistent empty-state experience across every list page in the app, plus a small strip on Home that says "since you were last here, X happened" so returning users immediately see what's new.

---

## 1. Empty-state audit pass (P8.1)

For each page below, verify the empty state uses `<EmptyState>` and adjust if not. Don't refactor pages that are already correct from earlier phases.

### 1a. UsersPage (`pages/users/UsersPage.tsx`)

Admin-only list of users. When the search/filter returns nothing or there are no users at all (unlikely except in fresh dev environments).

- Empty (no filters): `<EmptyState>` with "No users yet" + description. No CTA — admin creates users elsewhere or via registration. (If there's already a "Create user" button, wire it as the primary action.)
- Empty (filtered): "No users match your search" with "Clear filters" CTA.

### 1b. ArchivedRoomsPage (`pages/rooms/ArchivedRoomsPage.tsx`)

Admin-only.

- Empty: `<EmptyState>` icon `Archive`, title `t("rooms.archivedRoomsEmpty")` (already exists). Description: "Archived rooms will appear here." No CTA.

Today the page already shows a small text-only message — replace with `<EmptyState>`.

### 1c. StudentProgressPage (`pages/recitations/StudentProgressPage.tsx`)

When a student has zero recitations, the page currently still renders rings and grids (all at zero). After Phase 6 the Recitations log page handles its own empty state. For Progress:

- When `progress.total_recitations === 0`: replace the "Recent recitations" card and the surahs-covered grid empty space with a single inline `<EmptyState>` after the four stat tiles:

```tsx
{progress.total_recitations === 0 ? (
  <EmptyState
    icon={<BookMarked className="h-12 w-12" />}
    title={t("recitations.progressEmptyTitle")}
    description={t("recitations.progressEmptyDescription")}
  />
) : (
  // existing grade distribution + surah grid + recent list
)}
```

The four stat tiles at the top (Total / Surahs / Streak / Last) always render — they show zeros which is honest.

### 1d. SessionDetailPage (`pages/sessions/SessionDetailPage.tsx`)

When attendance list is empty (only happens for very freshly-created sessions before the auto-create runs):

- Inside the attendance section: `<EmptyState>` with title "No attendance recorded yet" — CTA "Mark attendance" if teacher.

When recitations attached to the session are empty — same EmptyState pattern as Phase 4's `RoomRecitationsSection` empty state.

If these sections are already conditionally rendered with text-only "No data" — replace with `<EmptyState>`. If they're not present at all in the page, skip — no need to add new sections.

### 1e. ProfilePage / AccountLinksPage

Profile is a form, not a list. Skip.

AccountLinksPage shows the QF link state — also not a list. Skip.

### 1f. Don't break

- HomePage: covered by Phase 1. Don't touch.
- RoomsPage: covered by Phase 3. Don't touch.
- RoomDetailPage: covered by Phase 4. Don't touch.
- CalendarPage: covered by Phase 5. Don't touch.
- RecitationsPage: covered by Phase 6. Don't touch.
- LiveSessionsPage: existing "no live / no upcoming" copy is fine for now — if you want to upgrade to `<EmptyState>` it's a small extra; keep it consistent if other text-only states exist.

### 1g. i18n keys

Add only if missing:

| Key (path) | EN | AR | FR |
|---|---|---|---|
| `users.emptyTitle` | No users yet | لا يوجد مستخدمون بعد | Aucun utilisateur |
| `users.emptyDescription` | Users created in the system will appear here. | سيظهر هنا المستخدمون الذين تمّ إنشاؤهم في النظام. | Les utilisateurs créés dans le système apparaîtront ici. |
| `users.noMatchesTitle` | No users match your search | لا يوجد مستخدمون يطابقون البحث | Aucun utilisateur ne correspond à la recherche |
| `users.noMatchesDescription` | Try adjusting your search or filters. | حاول تعديل البحث أو المرشحات. | Essayez d'ajuster votre recherche ou vos filtres. |
| `rooms.archivedEmptyDescription` | Archived rooms will appear here. | ستظهر هنا الحلقات المؤرشفة. | Les halaqat archivées apparaîtront ici. |
| `recitations.progressEmptyTitle` | No progress yet | لا يوجد تقدّم بعد | Aucun progrès pour l'instant |
| `recitations.progressEmptyDescription` | Once recitations are logged, the progress overview will populate. | فور تسجيل التلاوات ستظهر نظرة عامة على التقدّم. | Une fois les récitations enregistrées, l'aperçu des progrès apparaîtra. |
| `sessions.attendanceEmptyTitle` | No attendance recorded yet | لم يُسجَّل أي حضور بعد | Aucune présence enregistrée |
| `sessions.attendanceEmptyDescription` | Mark attendance from the session controls. | سجّل الحضور من خلال أدوات الحصة. | Enregistrez la présence depuis les contrôles de séance. |

---

## 2. "What's new since last visit" strip (P8.2)

A subtle, dismissible banner on the Home page showing how things changed since the user's previous login.

### 2a. Backend — migration

Create `backend/migrations/016_user_last_seen.sql`:

```sql
-- Track the previous "last seen" so we can show a "what's new" strip on Home.
-- We need TWO timestamps: last_seen_at (current session start) and prev_seen_at
-- (the value of last_seen_at before this login). The "what's new" calculation is
-- always relative to prev_seen_at, never the live moving target.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prev_seen_at TIMESTAMPTZ;
```

No backfill needed. Existing users will simply have `NULL` for both until their next login — first response from `/whats-new` returns zero counts when `prev_seen_at IS NULL`.

### 2b. Backend — update `last_seen_at` on login + `me`

In `backend/src/api/handlers/auth.rs`:

In the `login` handler (or wherever the JWT is minted on successful login), before returning the response:

```rust
// On successful login, shift prev_seen_at <- last_seen_at, then set last_seen_at = NOW().
sqlx::query(
    "UPDATE users SET prev_seen_at = last_seen_at, last_seen_at = NOW() WHERE id = $1"
)
.bind(user.id)
.execute(&state.db)
.await
.ok(); // Don't fail login on tracking write
```

In the `me` handler (called frequently from the frontend), do **not** update timestamps — `me` runs many times per session and would constantly bump the value. Only the explicit `login` call updates it.

For QF login (`exchange` handler), apply the same shift after successful authentication.

### 2c. Backend — new endpoint

`GET /api/me/whats-new`

Add `whats_new` handler in `backend/src/api/handlers/auth.rs` (or a new file `me.rs` if you prefer — but `auth.rs` already has `me`, so keep them together).

Response shape:

```rust
#[derive(Serialize)]
pub struct WhatsNewResponse {
    pub since: Option<DateTime<Utc>>,           // prev_seen_at, or null on first login
    pub new_recitations: i64,                   // teacher: graded by me; student: graded for me
    pub new_enrollments: i64,                   // teacher: enrollments to my rooms; student: 0
    pub completed_sessions: i64,                // teacher: sessions I taught; student: sessions I attended
    pub pending_requests: i64,                  // teacher only: new pending enrollment requests
}
```

Logic:

```rust
pub async fn whats_new(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<WhatsNewResponse>, StatusCode> {
    let prev: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT prev_seen_at FROM users WHERE id = $1"
    )
    .bind(auth.id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(since) = prev else {
        // First login or no prior visit — no diff to show.
        return Ok(Json(WhatsNewResponse {
            since: None,
            new_recitations: 0,
            new_enrollments: 0,
            completed_sessions: 0,
            pending_requests: 0,
        }));
    };

    // Compose role-scoped queries.
    let (recitations, enrollments, sessions_completed, pending) = match auth.role.as_str() {
        "teacher" => {
            let r: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM recitations WHERE teacher_id = $1 AND created_at > $2"
            ).bind(auth.id).bind(since).fetch_one(&state.db).await.unwrap_or(0);
            let e: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM enrollments e JOIN rooms r ON r.id = e.room_id \
                 WHERE r.teacher_id = $1 AND e.enrolled_at > $2 AND e.status = 'approved'"
            ).bind(auth.id).bind(since).fetch_one(&state.db).await.unwrap_or(0);
            let s: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sessions WHERE room_id IN (SELECT id FROM rooms WHERE teacher_id = $1) \
                 AND status = 'completed' AND scheduled_at > $2"
            ).bind(auth.id).bind(since).fetch_one(&state.db).await.unwrap_or(0);
            let p: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM enrollments e JOIN rooms r ON r.id = e.room_id \
                 WHERE r.teacher_id = $1 AND e.enrolled_at > $2 AND e.status = 'pending'"
            ).bind(auth.id).bind(since).fetch_one(&state.db).await.unwrap_or(0);
            (r, e, s, p)
        }
        "student" => {
            let r: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM recitations WHERE student_id = $1 AND created_at > $2"
            ).bind(auth.id).bind(since).fetch_one(&state.db).await.unwrap_or(0);
            let s: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM session_attendance sa JOIN sessions ses ON ses.id = sa.session_id \
                 WHERE sa.student_id = $1 AND sa.attended = true AND ses.status = 'completed' AND ses.scheduled_at > $2"
            ).bind(auth.id).bind(since).fetch_one(&state.db).await.unwrap_or(0);
            (r, 0, s, 0)
        }
        _ => (0, 0, 0, 0),
    };

    Ok(Json(WhatsNewResponse {
        since: Some(since),
        new_recitations: recitations,
        new_enrollments: enrollments,
        completed_sessions: sessions_completed,
        pending_requests: pending,
    }))
}
```

Wire in `backend/src/api/router.rs`:

```rust
.route("/api/me/whats-new", get(handlers::auth::whats_new))
```

Verify the underlying schema columns match the queries. Adjust `enrolled_at` if the actual column name differs in your enrollments migration; same for `attended` on `session_attendance`.

### 2d. Frontend — strip component

Create `frontend/src/components/home/WhatsNewStrip.tsx`:

```ts
interface WhatsNewData {
  since: string | null;
  new_recitations: number;
  new_enrollments: number;
  completed_sessions: number;
  pending_requests: number;
}

interface WhatsNewStripProps {
  role: "student" | "teacher" | "admin";
}
```

Behaviour:
- On mount, `GET /api/me/whats-new`.
- If `since == null` → render nothing (first visit).
- If all counts are zero → render nothing.
- Otherwise render a single dismissible row above the rest of HomePage content.

Layout:

```tsx
<div className="rounded-xl border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 px-4 py-3 shadow-sm">
  <div className="flex flex-wrap items-center gap-3">
    <Sparkles className="h-5 w-5 shrink-0 text-[var(--color-gold)]" aria-hidden />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-[var(--color-text)]">
        {t("home.whatsNewTitle", { since: relativeSince })}
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        {summaryParts.join(" · ")}
      </p>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={dismiss}
      aria-label={t("common.dismiss")}
    >
      <X className="h-4 w-4" />
    </Button>
  </div>
</div>
```

Where `summaryParts` is built role-aware:

```ts
const parts: string[] = [];
if (role === "teacher") {
  if (data.new_recitations > 0) parts.push(t("home.whatsNew.recitationsTeacher", { count: data.new_recitations }));
  if (data.new_enrollments > 0) parts.push(t("home.whatsNew.enrollments", { count: data.new_enrollments }));
  if (data.pending_requests > 0) parts.push(t("home.whatsNew.pending", { count: data.pending_requests }));
  if (data.completed_sessions > 0) parts.push(t("home.whatsNew.sessions", { count: data.completed_sessions }));
} else if (role === "student") {
  if (data.new_recitations > 0) parts.push(t("home.whatsNew.recitationsStudent", { count: data.new_recitations }));
  if (data.completed_sessions > 0) parts.push(t("home.whatsNew.sessionsAttended", { count: data.completed_sessions }));
}
```

For `relativeSince`, format the `since` date as a relative human string ("2 days ago", "yesterday"). Use existing `useLocaleDate` if it exposes a relative formatter, or `Intl.RelativeTimeFormat` directly:

```ts
function formatRelative(iso: string, locale: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / 86400000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(days) >= 1) return rtf.format(days, "day");
  const hours = Math.round(ms / 3600000);
  return rtf.format(hours, "hour");
}
```

### 2e. Dismissibility

Dismiss state lives in `sessionStorage` (not persisted across sessions — a fresh login should re-fetch and may show again):

```ts
const [dismissed, setDismissed] = useState(() => {
  return sessionStorage.getItem("whatsNewDismissed") === "1";
});

const dismiss = () => {
  setDismissed(true);
  sessionStorage.setItem("whatsNewDismissed", "1");
};
```

If `dismissed`, render nothing.

### 2f. Wire into HomePage

In `frontend/src/pages/HomePage.tsx`, render `<WhatsNewStrip role={user.role} />` at the top of each dashboard subcomponent (admin, teacher, student) — above `<LiveNowDashboardCard>`.

For the empty-state hero branches added in Phase 1 (teacher with 0 rooms, student with 0 enrollments), still render the strip if it has data — it's complementary information.

### 2g. i18n keys

`frontend/src/i18n/locales/{ar,en,fr}.json` under `home.whatsNew`:

| Key | EN | AR | FR |
|---|---|---|---|
| `home.whatsNewTitle` | Since {{since}} | منذ {{since}} | Depuis {{since}} |
| `home.whatsNew.recitationsTeacher` | {{count}} new recitations graded | {{count}} تلاوات جديدة مقيَّمة | {{count}} récitations notées |
| `home.whatsNew.recitationsStudent` | {{count}} new recitations graded | {{count}} تلاوات جديدة مقيَّمة | {{count}} récitations notées |
| `home.whatsNew.enrollments` | {{count}} new enrollments | {{count}} تسجيلات جديدة | {{count}} nouvelles inscriptions |
| `home.whatsNew.pending` | {{count}} pending requests | {{count}} طلبات معلّقة | {{count}} demandes en attente |
| `home.whatsNew.sessions` | {{count}} sessions completed | {{count}} حصص مكتملة | {{count}} séances terminées |
| `home.whatsNew.sessionsAttended` | {{count}} sessions attended | {{count}} حصص حضرتها | {{count}} séances suivies |
| `common.dismiss` | Dismiss | إخفاء | Fermer |

---

## Design system reminder

- WhatsNewStrip uses gold tint background — a subtle "celebration" accent without competing with primary actions.
- Sparkles icon (lucide) for the strip — friendlier than a generic info icon.
- Dismiss `X` button uses ghost variant.
- All Phase 8 EmptyState additions sit inside the same `<PageCard>` containers the original lists used.
- RTL: dismiss button on the leading edge (already handled by flex direction).

---

## Files touched

### Frontend
- `frontend/src/pages/HomePage.tsx` — render `<WhatsNewStrip>` in each dashboard.
- `frontend/src/pages/users/UsersPage.tsx` — empty state.
- `frontend/src/pages/rooms/ArchivedRoomsPage.tsx` — empty state.
- `frontend/src/pages/recitations/StudentProgressPage.tsx` — zero-progress empty state.
- `frontend/src/pages/sessions/SessionDetailPage.tsx` — attendance/recitations empty states (only if currently text-only).
- `frontend/src/components/home/WhatsNewStrip.tsx` (new).
- `frontend/src/i18n/locales/{ar,en,fr}.json` — keys above.

### Backend
- `backend/migrations/016_user_last_seen.sql` (new).
- `backend/src/api/handlers/auth.rs` — update `last_seen_at` on login/QF exchange, add `whats_new` handler.
- `backend/src/api/router.rs` — wire `GET /api/me/whats-new`.

---

## Do not touch

- Pages covered by Phases 1–7 — leave their empty states alone.
- Anything inside the live session shell, Mushaf, LiveKit.
- Other backend handlers — only `auth.rs` + `router.rs` get touched.
- Existing migrations — only add `016_user_last_seen.sql`.
- Terminology.

---

## Test instructions

### Empty-state audit (P8.1)

1. **UsersPage filtered to nothing:** "No users match your search" + Clear filters CTA.
2. **UsersPage with no users at all (dev DB):** "No users yet" empty state.
3. **ArchivedRoomsPage with no archived rooms:** "Archived rooms will appear here" with `Archive` icon.
4. **StudentProgressPage for a student with 0 recitations:** four stat tiles (all zero), then a single inline EmptyState. No empty grade-distribution bar / surah grid below.
5. **SessionDetailPage for a fresh session with no attendance:** EmptyState with "Mark attendance" CTA (teacher) or no CTA (student).

### What's new strip (P8.2)

1. **First-ever login (prev_seen_at NULL):** strip not rendered (`since` is null).
2. **Second login, nothing happened in between:** strip not rendered (all counts zero).
3. **Teacher returns after 2 days during which 5 students recited and 1 enrolled:** strip shows "Since 2 days ago — 5 recitations graded · 1 enrollment". Dismiss `X` hides it for the rest of the session. Refresh → still hidden (sessionStorage). Logout/login → recomputes.
4. **Student returns after a week during which 2 sessions were graded:** strip shows "Since 7 days ago — 2 recitations graded".
5. **Backend:** `GET /api/me/whats-new` returns `{ since, new_recitations, new_enrollments, completed_sessions, pending_requests }`. `since` is the user's `prev_seen_at` value.
6. **Login flow:** logging in shifts `prev_seen_at <- last_seen_at` then sets `last_seen_at = NOW()`. Calling `/api/auth/me` does not change either column.
7. **Migration:** `016_user_last_seen.sql` runs cleanly. `cargo check` clean.
8. RTL: strip text aligns right, dismiss button on the start side. `since` formatting uses Arabic locale relative time.
9. `npm run build` clean.

---

## When to ship

Phase 8 is the most invasive (migration + backend endpoint + frontend strip). If you're squeezed for time before May 20, ship the empty-state audit (1a–1f) and **defer the What's New strip to post-hackathon**. The audit alone adds significant polish; the strip is icing.
