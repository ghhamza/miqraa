-- Fix missing ON DELETE behavior for recitations foreign keys.
-- When a student or teacher is deleted, SET NULL on their recitations.
-- When a room is deleted, SET NULL on recitations (preserve historical rows).

ALTER TABLE recitations DROP CONSTRAINT IF EXISTS recitations_student_id_fkey;
ALTER TABLE recitations ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE recitations ADD CONSTRAINT recitations_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE recitations DROP CONSTRAINT IF EXISTS recitations_room_id_fkey;
ALTER TABLE recitations ADD CONSTRAINT recitations_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

ALTER TABLE recitations DROP CONSTRAINT IF EXISTS recitations_teacher_id_fkey;
ALTER TABLE recitations ADD CONSTRAINT recitations_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;
