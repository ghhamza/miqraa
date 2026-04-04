-- Room visibility and self-enrollment settings
ALTER TABLE rooms ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE rooms ADD COLUMN enrollment_open BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE rooms ADD COLUMN requires_approval BOOLEAN NOT NULL DEFAULT true;

-- Enrollment status lifecycle
ALTER TABLE enrollments ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_enrollments_student_status ON enrollments(student_id, status);
