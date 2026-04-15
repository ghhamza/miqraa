// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
    pub qf_linked: bool,
    pub qf_email: Option<String>,
    pub role_selection_pending: bool,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UserPublic {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct UserStatsResponse {
    pub total: i64,
    pub students: i64,
    pub teachers: i64,
    pub admins: i64,
}

/// Generic paginated response wrapper.
#[derive(Serialize)]
#[serde(bound = "T: Serialize")]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Serialize)]
pub struct SessionStatsResponse {
    pub total: i64,
    pub completed: i64,
    pub scheduled: i64,
    pub cancelled: i64,
    pub avg_attendance_pct: f64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct RoomPublic {
    pub id: Uuid,
    pub name: String,
    pub teacher_id: Uuid,
    pub teacher_name: String,
    pub max_students: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub riwaya: String,
    pub halaqah_type: String,
    pub enrolled_count: i64,
    pub is_public: bool,
    pub enrollment_open: bool,
    pub requires_approval: bool,
    pub pending_count: i64,
    pub my_status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MyEnrollmentStatus {
    pub status: Option<String>,
    pub enrollment_id: Option<Uuid>,
    pub enrolled_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct JoinResult {
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct EnrollmentWithStatus {
    pub id: Uuid,
    pub student_id: Uuid,
    pub student_name: String,
    pub student_email: String,
    pub enrolled_at: DateTime<Utc>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct EnrollmentPublic {
    pub id: Uuid,
    pub student_id: Uuid,
    pub student_name: String,
    pub student_email: String,
    pub enrolled_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct EnrollmentCountResponse {
    pub count: i64,
    pub max: i32,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct StudentOption {
    pub id: Uuid,
    pub name: String,
    pub email: String,
}

#[derive(Serialize)]
pub struct RoomStatsResponse {
    pub total: i64,
    pub active: i64,
    pub inactive: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct TeacherOption {
    pub id: Uuid,
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SessionPublic {
    pub id: Uuid,
    pub room_id: Uuid,
    pub room_name: String,
    pub teacher_id: Uuid,
    pub title: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub status: String,
    pub notes: Option<String>,
    pub recurrence_group_id: Option<Uuid>,
    pub recurrence_rule: Option<String>,
    pub schedule_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// In-progress sessions in active public rooms, with host / enrollment hints for the Live hub.
#[derive(Debug, Serialize)]
pub struct SessionLivePublicItem {
    #[serde(flatten)]
    pub session: SessionPublic,
    pub is_room_teacher: bool,
    /// Student's enrollment in this room: `approved` | `pending` | `rejected`, or `None` if not enrolled.
    pub my_enrollment_status: Option<String>,
    pub requires_approval: bool,
    pub enrollment_open: bool,
}

#[derive(Serialize)]
pub struct CreateSessionsResponse {
    pub sessions: Vec<SessionPublic>,
    pub count: usize,
}

#[derive(Serialize)]
pub struct DeleteGroupResult {
    pub deleted: i32,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SessionAttendanceRow {
    pub student_id: Uuid,
    pub student_name: String,
    pub attended: bool,
    pub attendance_note: Option<String>,
    pub joined_at: Option<DateTime<Utc>>,
    pub left_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct SessionDetailResponse {
    #[serde(flatten)]
    pub session: SessionPublic,
    pub attendance: Vec<SessionAttendanceRow>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct RecitationPublic {
    pub id: Uuid,
    pub student_id: Option<Uuid>,
    pub student_name: Option<String>,
    pub room_id: Option<Uuid>,
    pub room_name: Option<String>,
    pub session_id: Option<Uuid>,
    pub surah: i32,
    pub ayah_start: i32,
    pub ayah_end: i32,
    pub grade: Option<String>,
    pub teacher_notes: Option<String>,
    pub teacher_id: Option<Uuid>,
    pub teacher_name: Option<String>,
    pub recording_path: Option<String>,
    pub created_at: DateTime<Utc>,
    pub riwaya: String,
    pub turn_type: String,
    pub pages_count: Option<f64>,
    pub star_rating: Option<i16>,
    pub qf_synced_at: Option<DateTime<Utc>>,
    pub qf_sync_error: Option<String>,
}

#[derive(Serialize)]
pub struct GradeCounts {
    pub excellent: i64,
    pub good: i64,
    pub needs_work: i64,
    pub weak: i64,
}

#[derive(Serialize)]
pub struct SurahCount {
    pub surah: i32,
    pub count: i64,
}

#[derive(Serialize)]
pub struct RecitationStatsResponse {
    pub total: i64,
    pub by_grade: GradeCounts,
    pub by_surah: Vec<SurahCount>,
    pub recent_count: i64,
}

#[derive(Serialize)]
pub struct SurahBestGrade {
    pub surah: i32,
    pub best_grade: Option<String>,
}

#[derive(Serialize)]
pub struct StudentProgressResponse {
    pub student_name: String,
    pub total_recitations: i64,
    pub surahs_covered: Vec<i32>,
    pub surah_best_grades: Vec<SurahBestGrade>,
    pub grade_distribution: GradeCounts,
    pub recent_recitations: i64,
    pub last_recitation_date: Option<DateTime<Utc>>,
    pub streak_days: i32,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ErrorAnnotationPublic {
    pub id: Uuid,
    pub recitation_id: Uuid,
    pub surah: i32,
    pub ayah: i32,
    pub word_position: Option<i32>,
    pub error_severity: String,
    pub error_category: String,
    pub teacher_comment: Option<String>,
    pub annotation_kind: String,
    pub status: String,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ErrorSummary {
    pub total_errors: i64,
    pub jali_count: i64,
    pub khafi_count: i64,
    pub by_category: Vec<CategoryCount>,
}

#[derive(Serialize, FromRow)]
pub struct CategoryCount {
    pub category: String,
    pub count: i64,
}
