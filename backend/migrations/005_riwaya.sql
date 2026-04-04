-- Riwaya (recitation tradition) for rooms and recitations
ALTER TABLE rooms ADD COLUMN riwaya TEXT NOT NULL DEFAULT 'hafs'
  CHECK (riwaya IN ('hafs', 'warsh', 'qalun'));

ALTER TABLE recitations ADD COLUMN riwaya TEXT NOT NULL DEFAULT 'hafs'
  CHECK (riwaya IN ('hafs', 'warsh', 'qalun'));
