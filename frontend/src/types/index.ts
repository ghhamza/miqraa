// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

export interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "admin";
}

/** Full user row from admin APIs */
export interface UserPublic extends User {
  created_at: string;
}

export interface UserStats {
  total: number;
  students: number;
  teachers: number;
  admins: number;
}

/** Quran reading (rawī); structural mushaf data in-app uses quran-meta for hafs/warsh/qalun only — others use Hafs layout as fallback. */
export type QuranRiwaya =
  | "hafs"
  | "warsh"
  | "qalun"
  | "shubah"
  | "qunbul"
  | "bazzi"
  | "doori"
  | "susi"
  | "hisham"
  | "ibn_dhakwan"
  | "khalaf"
  | "khallad"
  | "doori_kisai"
  | "abu_harith";

/** Room row from API (includes teacher display name). */
export interface Room {
  id: string;
  name: string;
  teacher_id: string;
  teacher_name: string;
  max_students: number;
  is_active: boolean;
  created_at: string;
  riwaya: QuranRiwaya;
  enrolled_count: number;
}

export interface Enrollment {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  enrolled_at: string;
}

export interface EnrollmentCount {
  count: number;
  max: number;
}

export interface StudentOption {
  id: string;
  name: string;
  email: string;
}

export interface RoomStats {
  total: number;
  active: number;
  inactive: number;
}

export interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

export interface SignalMessage {
  type: "join" | "offer" | "answer" | "ice-candidate" | "mute" | "active-reciter";
  [key: string]: unknown;
}

export interface Participant {
  user_id: string;
  name: string;
  is_muted: boolean;
  is_active_reciter: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type SessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface SessionPublic {
  id: string;
  room_id: string;
  room_name: string;
  teacher_id: string;
  title: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  notes: string | null;
  created_at: string;
}

export interface SessionAttendance {
  student_id: string;
  student_name: string;
  attended: boolean;
  joined_at: string | null;
  left_at: string | null;
}

/** GET /api/sessions/:id — flattened session fields + attendance */
export interface SessionDetail extends SessionPublic {
  attendance: SessionAttendance[];
}

export type RecitationGrade = "excellent" | "good" | "needs_work" | "weak";

export interface RecitationPublic {
  id: string;
  student_id: string;
  student_name: string;
  room_id: string | null;
  room_name: string | null;
  session_id: string | null;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  grade: RecitationGrade | null;
  teacher_notes: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  recording_path: string | null;
  created_at: string;
  riwaya: QuranRiwaya;
}

export interface RecitationStats {
  total: number;
  by_grade: {
    excellent: number;
    good: number;
    needs_work: number;
    weak: number;
  };
  by_surah: { surah: number; count: number }[];
  recent_count: number;
}

export interface SurahBestGrade {
  surah: number;
  best_grade: string | null;
}

export interface StudentProgress {
  student_name: string;
  total_recitations: number;
  surahs_covered: number[];
  surah_best_grades: SurahBestGrade[];
  grade_distribution: {
    excellent: number;
    good: number;
    needs_work: number;
    weak: number;
  };
  recent_recitations: number;
  last_recitation_date: string | null;
  streak_days: number;
}
