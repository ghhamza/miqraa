-- 012: Annotation lifecycle — kind, status, resolution tracking

-- Kind: what the annotation represents. 'error' uses error_severity + error_category.
-- 'repeat' and 'good' and 'note' ignore severity/category meaning.
CREATE TYPE annotation_kind AS ENUM ('error', 'repeat', 'good', 'note');

ALTER TABLE error_annotations
  ADD COLUMN annotation_kind annotation_kind NOT NULL DEFAULT 'error';

-- Status: lifecycle of the annotation
CREATE TYPE annotation_status AS ENUM ('open', 'resolved', 'auto_resolved');

ALTER TABLE error_annotations
  ADD COLUMN status annotation_status NOT NULL DEFAULT 'open';

ALTER TABLE error_annotations
  ADD COLUMN resolved_at TIMESTAMPTZ;

ALTER TABLE error_annotations
  ADD COLUMN resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Helpful indexes for the "open corrections" student query
CREATE INDEX idx_error_annotations_student_open
  ON error_annotations(recitation_id)
  WHERE status = 'open';

CREATE INDEX idx_error_annotations_kind ON error_annotations(annotation_kind);
