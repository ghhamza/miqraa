ALTER TABLE recitations ADD COLUMN qf_synced_at TIMESTAMPTZ;
ALTER TABLE recitations ADD COLUMN qf_sync_error TEXT;

CREATE INDEX idx_recitations_qf_pending ON recitations(student_id, created_at)
  WHERE qf_synced_at IS NULL AND qf_sync_error IS NULL;
