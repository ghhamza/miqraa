-- Add session link and grading to recitations
ALTER TABLE recitations ADD COLUMN session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;
ALTER TABLE recitations ADD COLUMN grade TEXT CHECK (grade IN ('excellent', 'good', 'needs_work', 'weak'));
ALTER TABLE recitations ADD COLUMN teacher_id UUID REFERENCES users(id);

CREATE INDEX idx_recitations_session ON recitations(session_id);
CREATE INDEX idx_recitations_teacher ON recitations(teacher_id);
CREATE INDEX idx_recitations_surah ON recitations(surah);
