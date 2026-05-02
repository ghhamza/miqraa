-- Optional rich description and optional enrollment deadline.
-- NULL deadline = continuous enrollment (default behaviour).

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_deadline_at TIMESTAMPTZ;

-- We query "deadline passed?" frequently for student lists, so an index on the
-- deadline helps the partial cases. NULLs are not indexed by default in btree,
-- which is what we want — continuous halaqat are not filtered on this column.
CREATE INDEX IF NOT EXISTS idx_rooms_enrollment_deadline
  ON rooms(enrollment_deadline_at) WHERE enrollment_deadline_at IS NOT NULL;
