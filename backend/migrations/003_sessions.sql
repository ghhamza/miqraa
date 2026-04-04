CREATE TYPE session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    status session_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attended BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    UNIQUE(session_id, student_id)
);

CREATE INDEX idx_sessions_room ON sessions(room_id);
CREATE INDEX idx_sessions_scheduled ON sessions(scheduled_at);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_attendance_session ON session_attendance(session_id);
CREATE INDEX idx_attendance_student ON session_attendance(student_id);
