-- 011: Halaqah session system — type, attendance notes, recitation turns, error annotations

-- 1. Halaqah type on rooms (the room IS the halaqah)
CREATE TYPE halaqah_type AS ENUM ('hifz', 'tilawa', 'muraja', 'tajweed');
ALTER TABLE rooms ADD COLUMN halaqah_type halaqah_type NOT NULL DEFAULT 'hifz';

-- 2. Attendance notes (متأخر، بعذر، غائب، etc.)
ALTER TABLE session_attendance ADD COLUMN attendance_note TEXT;

-- 3. Recitation turn type (الدرس / التثبيت / المراجعة)
CREATE TYPE turn_type AS ENUM ('dars', 'tathbit', 'muraja');
ALTER TABLE recitations ADD COLUMN turn_type turn_type NOT NULL DEFAULT 'dars';

-- 4. Pages count (الأوجه) — how many Mushaf pages the student covered
ALTER TABLE recitations ADD COLUMN pages_count NUMERIC(4,1);

-- 5. Star rating (التقدير) — 1 to 5 stars, separate from the grade enum
ALTER TABLE recitations ADD COLUMN star_rating SMALLINT CHECK (star_rating >= 1 AND star_rating <= 5);

-- 6. Error annotations — word-level error tracking on the Mushaf
CREATE TYPE error_severity AS ENUM ('jali', 'khafi');
CREATE TYPE error_category AS ENUM (
  'harf',
  'haraka',
  'kalima',
  'waqf_qabih',
  'makharij',
  'sifat',
  'tafkhim',
  'madd',
  'ghunnah',
  'noon_sakin',
  'meem_sakin',
  'waqf_ibtida',
  'shadda',
  'other'
);

CREATE TABLE error_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recitation_id UUID NOT NULL REFERENCES recitations(id) ON DELETE CASCADE,
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  word_position INTEGER,
  error_severity error_severity NOT NULL,
  error_category error_category NOT NULL,
  teacher_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_annotations_recitation ON error_annotations(recitation_id);
CREATE INDEX idx_error_annotations_surah_ayah ON error_annotations(surah, ayah);
