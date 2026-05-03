# Cursor Prompt — P-PLAN-REORDER: Drag-to-reorder recitation plans

## Context

The session detail page has a "Recitation plan" (خطة التسميع) section where a teacher prepares planned recitations before the session starts. Currently they appear in creation order.

Teachers want to control the order — "Sara recites first because she's the strongest, Ahmad second, Khalid last." This prompt adds drag-to-reorder for planned recitations using `@dnd-kit/sortable`.

What changes:

1. Backend: new `order_index` column on `recitation_plans`, backfilled. New reorder endpoint.
2. Frontend: each plan row gets a drag handle. Teacher reorders via drag. Optimistic update + API call in background.
3. Plans that have already started or completed are pinned (not reorderable). Only `planned`-status plans are draggable.

What does NOT change:

- The data model otherwise (still a `recitation_plans` table with status, surah, ayah_start, ayah_end, turn_type, student_id, session_id)
- The "Add to plan" flow
- The empty state
- Mushaf, live session shell, LiveKit, terminology, any other page

---

## Order of implementation

1. Backend migration
2. Backend types + handlers (reorder endpoint, list-query ordering, insert ordering)
3. Frontend dependency add
4. Frontend types
5. Frontend list rendering refactor (sortable)
6. Frontend reorder API call + optimistic state
7. i18n
8. Test

---

## 1. Backend — migration

Create the next-numbered migration file at `backend/migrations/`. Pick the next free number (016 if free, otherwise 017, etc.).

`XXX_recitation_plans_order.sql`:

```sql
ALTER TABLE recitation_plans
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at ASC) - 1 AS rn
  FROM recitation_plans
)
UPDATE recitation_plans rp
SET order_index = o.rn
FROM ordered o
WHERE rp.id = o.id;

CREATE INDEX IF NOT EXISTS idx_recitation_plans_session_order
  ON recitation_plans(session_id, order_index);
```

If `created_at` is named differently in the existing `recitation_plans` schema, adjust accordingly. Verify before running by reading the table's existing migration.

## 2. Backend — list query ordering

Find the handler that returns recitation plans for a session (look in `backend/src/api/handlers/` — likely `sessions.rs` or a dedicated `recitation_plans.rs`). Update the SELECT's `ORDER BY` clause to:

```sql
ORDER BY order_index ASC, created_at ASC
```

`created_at` stays as a tiebreaker so two plans with the same `order_index` (shouldn't happen, but defensive) have a stable order.

## 3. Backend — insert ordering

In the create-plan handler, before INSERT, compute the next order index:

```rust
let next_order: i32 = sqlx::query_scalar(
    "SELECT COALESCE(MAX(order_index), -1) + 1 FROM recitation_plans WHERE session_id = $1"
)
.bind(session_id)
.fetch_one(&state.db)
.await
.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
```

Bind `next_order` in the INSERT alongside the other fields. New plans always go to the end of the list.

## 4. Backend — reorder endpoint

Add a new handler in the same file as the other plan handlers:

```rust
#[derive(Deserialize)]
pub struct ReorderPlansRequest {
    pub plan_ids: Vec<Uuid>,
}

pub async fn reorder_plans(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(session_id): Path<Uuid>,
    Json(req): Json<ReorderPlansRequest>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    // Verify caller owns the session (teacher of the room) or is admin.
    // Use whatever ownership-check helper already exists for plan handlers.
    require_session_teacher_or_admin(&state, &auth, session_id)
        .await
        .map_err(|c| (c, Json(json!({ "code": "forbidden" }))))?;

    let mut tx = state.db.begin().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;

    // Count existing plans for this session
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recitation_plans WHERE session_id = $1")
        .bind(session_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;

    if total as usize != req.plan_ids.len() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "code": "stale_plan_list" }))));
    }

    // Verify every plan_id belongs to this session
    for id in &req.plan_ids {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM recitation_plans WHERE id = $1 AND session_id = $2)"
        )
        .bind(id).bind(session_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
        if !exists {
            return Err((StatusCode::BAD_REQUEST, Json(json!({ "code": "plan_not_in_session" }))));
        }
    }

    // Apply new order
    for (i, plan_id) in req.plan_ids.iter().enumerate() {
        sqlx::query("UPDATE recitation_plans SET order_index = $1 WHERE id = $2")
            .bind(i as i32)
            .bind(plan_id)
            .execute(&mut *tx)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    }

    tx.commit().await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;

    Ok(StatusCode::NO_CONTENT)
}
```

Replace `require_session_teacher_or_admin` with whatever helper or inline check the existing plan handlers use. Don't invent a new auth pattern.

## 5. Backend — wire the route

In `backend/src/api/router.rs`:

```rust
.route("/api/sessions/{id}/plans/reorder", put(handlers::sessions::reorder_plans))
```

Adjust the path prefix to match the existing plan endpoints' style (e.g., if other plan endpoints live under `/api/sessions/:id/plans/...`, follow the same shape).

## 6. Frontend — add the dependency

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Or use `pnpm` / `yarn` per the project's lockfile (check `package.json` and the lockfile to know which manager is in use).

## 7. Frontend — types

In `frontend/src/types/index.ts`, find the `RecitationPlan` type (or whatever it's named) and add:

```ts
order_index: number;
```

## 8. Frontend — list rendering

In the recitation plan section component (search for the "خطة التسميع" / "Recitation plan" header to locate it — likely `frontend/src/components/sessions/RecitationPlanSection.tsx` or rendered inline in `SessionDetailPage.tsx`), refactor the list rendering.

Replace the existing `.map()` over plans with a `<DndContext>` + `<SortableContext>` setup:

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

// Sortable row component (extract to a sibling component file or inline)
function SortablePlanRow({ plan, ...rest }: { plan: RecitationPlan; ... }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plan.id,
    disabled: plan.status !== "planned",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="...existing row classes...">
      {plan.status === "planned" ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("plan.dragHandle")}
          className="cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text)] active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <div className="w-4" />  // spacer to keep alignment
      )}
      {/* Existing row content: student name, surah/ayah, turn type chip */}
    </li>
  );
}
```

Wrap the list:

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = plans.findIndex((p) => p.id === active.id);
  const newIndex = plans.findIndex((p) => p.id === over.id);
  const reordered = arrayMove(plans, oldIndex, newIndex);
  setPlans(reordered); // optimistic
  void persistOrder(reordered.map((p) => p.id));
};

return (
  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={plans.map((p) => p.id)} strategy={verticalListSortingStrategy}>
      <ul className="space-y-2">
        {plans.map((plan) => (
          <SortablePlanRow key={plan.id} plan={plan} ... />
        ))}
      </ul>
    </SortableContext>
  </DndContext>
);
```

The `activationConstraint: { distance: 4 }` means a drag only starts after a 4px move — prevents accidental drags from clicks on the row.

## 9. Frontend — persist order

```tsx
async function persistOrder(planIds: string[]) {
  const previous = plans;
  try {
    await api.put(`sessions/${sessionId}/plans/reorder`, { plan_ids: planIds });
  } catch (err) {
    setPlans(previous); // revert
    toast.error(t("plan.reorderFailed"));
  }
}
```

Use whatever toast / error-display mechanism the rest of the app uses. If there's no toast system, fall back to `console.error` + revert silently — don't introduce a new error UI in this prompt.

## 10. Visual treatment for non-draggable plans

Plans with status `in_progress` or `completed` should:

- Not show a drag handle (rendered as a transparent spacer to keep alignment)
- Optionally show a small status chip ("في التقدم" / "مكتمل") to explain why
- Render visually differently — slightly muted background, completed ones with a subtle checkmark or strikethrough on the surah range

Keep this lightweight — don't redesign the row, just add the status indicator.

If you want to go further, group the list visually:

1. Completed plans at the top (in completion order)
2. In-progress in the middle
3. Planned at the bottom (in `order_index` order, draggable)

But this is optional polish — the minimum is just disabling drag for non-planned items.

## 11. i18n

Add under a new `plan` namespace (or wherever recitation plans already live):

| Key | EN | AR | FR |
|---|---|---|---|
| `dragHandle` | Reorder | إعادة الترتيب | Réorganiser |
| `reorderFailed` | Could not save the new order. | تعذّر حفظ الترتيب الجديد. | Impossible d'enregistrer le nouvel ordre. |

## 12. Test

### Backend

1. `cargo check` clean.
2. Run migration: `XXX_recitation_plans_order.sql` applies. Existing plans get sequential `order_index` per session.
3. `POST /api/sessions/:id/plans` (creating a new plan) returns a plan with `order_index` equal to (max + 1) for that session.
4. `GET /api/sessions/:id/plans` returns plans in `order_index ASC` order.
5. `PUT /api/sessions/:id/plans/reorder` with `{ plan_ids: [...full list in new order...] }` returns 204. Subsequent GET reflects the new order.
6. `PUT /api/sessions/:id/plans/reorder` with a list missing one plan ID → 400 `stale_plan_list`.
7. `PUT /api/sessions/:id/plans/reorder` with a plan_id from a different session → 400 `plan_not_in_session`.
8. `PUT` as a non-teacher → 403.

### Frontend

9. Open a session detail page with 3 planned recitations. Each row has a drag handle on the leading edge.
10. Drag the second row to the top. The list reorders immediately. Network tab shows one PUT call. Refresh the page — the new order persists.
11. Drag a row to a position. Simulate the API call failing (devtools network throttling or backend disabled). The list reverts to the previous order. A toast or error message appears.
12. Plans with status `in_progress` or `completed` have no drag handle. Trying to drag them does nothing.
13. Mobile / touch: long-press on the drag handle and move. Reorder works on touch.
14. Keyboard: tab to the drag handle, press Space to pick up, arrow keys to move, Space to drop. Reorder works without a mouse.
15. RTL Arabic: drag handles sit on the leading edge (right side in RTL). Drag direction reads correctly.
16. Adding a new plan via "Add to plan" creates it at the bottom of the list (highest `order_index`).
17. `npm run build` clean.

### Out of scope

- Reordering plans across different sessions
- Moving plans between students (still one student per plan)
- Reordering completed/in-progress plans
- Changing plan status (separate flow, not touched by this prompt)
- Mushaf, live session shell, LiveKit, terminology, any other page

---

## Do not touch

- The plan creation modal / form
- The plan deletion flow
- The status transition flow (planned → in_progress → completed)
- The session info card, attendance section, action buttons row
- Any other page in the app
