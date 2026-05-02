-- Track the previous "last seen" so we can show a "what's new" strip on Home.
-- We need TWO timestamps: last_seen_at (current session start) and prev_seen_at
-- (the value of last_seen_at before this login). The "what's new" calculation is
-- always relative to prev_seen_at, never the live moving target.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prev_seen_at TIMESTAMPTZ;
