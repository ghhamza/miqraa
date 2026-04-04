-- Recurring sessions: sessions created together share recurrence_group_id
ALTER TABLE sessions ADD COLUMN recurrence_group_id UUID;
ALTER TABLE sessions ADD COLUMN recurrence_rule TEXT;

CREATE INDEX idx_sessions_recurrence_group ON sessions(recurrence_group_id);
