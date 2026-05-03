-- 018: Session plan ordering (drag-to-reorder) + plan lifecycle on session-linked recitations

ALTER TABLE recitations ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recitations ADD COLUMN IF NOT EXISTS plan_status TEXT;

ALTER TABLE recitations DROP CONSTRAINT IF EXISTS recitations_plan_status_check;
ALTER TABLE recitations ADD CONSTRAINT recitations_plan_status_check
  CHECK (plan_status IS NULL OR plan_status IN ('planned', 'in_progress', 'completed'));

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at ASC) - 1 AS rn
  FROM recitations
  WHERE session_id IS NOT NULL
)
UPDATE recitations r
SET order_index = o.rn
FROM ordered o
WHERE r.id = o.id;

UPDATE recitations
SET plan_status = CASE WHEN grade IS NOT NULL THEN 'completed' ELSE 'planned' END
WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recitations_session_order
  ON recitations(session_id, order_index);
