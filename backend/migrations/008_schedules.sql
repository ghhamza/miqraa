-- Weekly schedule templates for recurring sessions
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT,
    -- Day of week: 0 = Monday, 1 = Tuesday, ... 6 = Sunday
    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    -- Time of day in minutes from midnight (e.g. 1200 = 20:00)
    start_time_minutes SMALLINT NOT NULL CHECK (start_time_minutes >= 0 AND start_time_minutes < 1440),
    duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_room ON schedules(room_id);

ALTER TABLE sessions ADD COLUMN schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL;
CREATE INDEX idx_sessions_schedule ON sessions(schedule_id);
