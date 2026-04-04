-- Expand allowed riwaya values to cover major classical rawī (10 readings across 7 readers).
-- Existing rows keep their current value.

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_riwaya_check;
ALTER TABLE recitations DROP CONSTRAINT IF EXISTS recitations_riwaya_check;

ALTER TABLE rooms ADD CONSTRAINT rooms_riwaya_check CHECK (riwaya IN (
  'hafs', 'warsh', 'qalun',
  'shubah', 'qunbul', 'bazzi', 'doori', 'susi',
  'hisham', 'ibn_dhakwan', 'khalaf', 'khallad', 'doori_kisai', 'abu_harith'
));

ALTER TABLE recitations ADD CONSTRAINT recitations_riwaya_check CHECK (riwaya IN (
  'hafs', 'warsh', 'qalun',
  'shubah', 'qunbul', 'bazzi', 'doori', 'susi',
  'hisham', 'ibn_dhakwan', 'khalaf', 'khallad', 'doori_kisai', 'abu_harith'
));
