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

/** Paginated list API (users, rooms, sessions, recitations). */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionStats {
  total: number;
  completed: number;
  scheduled: number;
  cancelled: number;
  avg_attendance_pct: number;
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

export type HalaqahType = "hifz" | "tilawa" | "muraja" | "tajweed";

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
  halaqah_type: HalaqahType;
  enrolled_count: number;
  is_public: boolean;
  enrollment_open: boolean;
  requires_approval: boolean;
  pending_count: number;
  /** Set for students in room list/detail: current user's enrollment state */
  my_status: "pending" | "approved" | "rejected" | null;
}

export interface MyEnrollmentStatus {
  status: "pending" | "approved" | "rejected" | null;
  enrollment_id: string | null;
  enrolled_at: string | null;
}

export interface JoinResult {
  status: string;
  message: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  enrolled_at: string;
}

export interface EnrollmentWithStatus extends Enrollment {
  status: "pending" | "approved" | "rejected";
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
  recurrence_group_id: string | null;
  recurrence_rule: string | null;
  schedule_id: string | null;
  created_at: string;
}

/** GET /api/sessions/live-public — in-progress sessions in active public rooms. */
export interface SessionLivePublicItem extends SessionPublic {
  is_room_teacher: boolean;
  /** Student enrollment in this room; null if not enrolled. */
  my_enrollment_status: "approved" | "pending" | "rejected" | null;
  requires_approval: boolean;
  enrollment_open: boolean;
}

export interface CreateSessionsResponse {
  sessions: SessionPublic[];
  count: number;
}

/** Weekly slot template for recurring session generation */
export interface Schedule {
  id: string;
  room_id: string;
  room_name: string;
  title: string | null;
  day_of_week: number;
  start_time_minutes: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface GenerateResult {
  created: number;
  skipped: number;
  sessions: { id: string; scheduled_at: string }[];
}

export interface SessionAttendance {
  student_id: string;
  student_name: string;
  attended: boolean;
  attendance_note: string | null;
  joined_at: string | null;
  left_at: string | null;
}

/** GET /api/sessions/:id — flattened session fields + attendance */
export interface SessionDetail extends SessionPublic {
  attendance: SessionAttendance[];
}

export type RecitationGrade = "excellent" | "good" | "needs_work" | "weak";

export type TurnType = "dars" | "tathbit" | "muraja";

export interface RecitationPublic {
  id: string;
  student_id: string | null;
  student_name: string | null;
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
  turn_type: TurnType;
  pages_count: number | null;
  star_rating: number | null;
}

export type ErrorSeverity = "jali" | "khafi";

export type ErrorCategory =
  | "harf"
  | "haraka"
  | "kalima"
  | "waqf_qabih"
  | "makharij"
  | "sifat"
  | "tafkhim"
  | "madd"
  | "ghunnah"
  | "noon_sakin"
  | "meem_sakin"
  | "waqf_ibtida"
  | "shadda"
  | "other";

export type AnnotationKind = "error" | "repeat" | "good" | "note";
export type AnnotationStatus = "open" | "resolved" | "auto_resolved";

export interface ErrorAnnotation {
  id: string;
  recitation_id: string;
  surah: number;
  ayah: number;
  word_position: number | null;
  error_severity: ErrorSeverity;
  error_category: ErrorCategory;
  teacher_comment: string | null;
  annotation_kind: AnnotationKind;
  status: AnnotationStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface ErrorSummary {
  total_errors: number;
  jali_count: number;
  khafi_count: number;
  by_category: { category: string; count: number }[];
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
