// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{
    EnrollmentCountResponse, EnrollmentPublic, EnrollmentWithStatus, JoinResult, MyEnrollmentStatus, StudentOption,
};
use crate::api::AppState;

#[derive(Deserialize)]
pub struct ListStudentsQuery {
    pub exclude_room_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct CreateEnrollmentRequest {
    pub student_id: Uuid,
}

#[derive(Serialize)]
pub struct ApiMessage {
    pub message: &'static str,
    pub code: &'static str,
}

fn can_manage_room(auth: &AuthenticatedUser, room_teacher_id: Uuid) -> bool {
    auth.role == "admin" || (auth.role == "teacher" && auth.id == room_teacher_id)
}

pub async fn list_students(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListStudentsQuery>,
) -> Result<Json<Vec<StudentOption>>, StatusCode> {
    if auth.role != "teacher" && auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }

    if let Some(rid) = params.exclude_room_id {
        let students = sqlx::query_as::<_, StudentOption>(
            "SELECT u.id, u.name, u.email FROM users u \
             WHERE u.role = 'student'::user_role \
             AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = u.id AND e.room_id = $1 \
             AND e.status IN ('approved', 'pending')) \
             ORDER BY u.name ASC",
        )
        .bind(rid)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        Ok(Json(students))
    } else {
        let students = sqlx::query_as::<_, StudentOption>(
            "SELECT id, name, email FROM users WHERE role = 'student'::user_role ORDER BY name ASC",
        )
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        Ok(Json(students))
    }
}

pub async fn enrollment_count(
    State(state): State<AppState>,
    _auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
) -> Result<Json<EnrollmentCountResponse>, StatusCode> {
    let row: Option<(i32,)> = sqlx::query_as("SELECT max_students FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((max_students,)) = row else {
        return Err(StatusCode::NOT_FOUND);
    };

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM enrollments WHERE room_id = $1 AND status = 'approved'",
    )
    .bind(room_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(EnrollmentCountResponse {
        count,
        max: max_students,
    }))
}

pub async fn list_enrollments(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Vec<EnrollmentPublic>>, StatusCode> {
    let room: Option<(Uuid,)> = sqlx::query_as("SELECT teacher_id FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((teacher_id,)) = room else {
        return Err(StatusCode::NOT_FOUND);
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let rows = sqlx::query_as::<_, EnrollmentPublic>(
        "SELECT e.id, e.student_id, u.name AS student_name, u.email AS student_email, e.enrolled_at \
         FROM enrollments e \
         INNER JOIN users u ON u.id = e.student_id \
         WHERE e.room_id = $1 AND e.status = 'approved' \
         ORDER BY e.enrolled_at ASC",
    )
    .bind(room_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(rows))
}

pub async fn create_enrollment(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
    Json(req): Json<CreateEnrollmentRequest>,
) -> Result<(StatusCode, Json<EnrollmentPublic>), (StatusCode, Json<ApiMessage>)> {
    let is_student: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND role = 'student'::user_role)",
    )
    .bind(req.student_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    if !is_student {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "المستخدم ليس طالبًا",
                code: "not_student",
            }),
        ));
    }

    let mut tx = state.db.begin().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    let room_row: Option<(Uuid, i32)> = sqlx::query_as(
        "SELECT teacher_id, max_students FROM rooms WHERE id = $1 FOR UPDATE",
    )
    .bind(room_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    let Some((teacher_id, max_students)) = room_row else {
        let _ = tx.rollback().await;
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if !can_manage_room(&auth, teacher_id) {
        let _ = tx.rollback().await;
        return Err((
            StatusCode::FORBIDDEN,
            Json(ApiMessage {
                message: "غير مصرح",
                code: "forbidden",
            }),
        ));
    }

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM enrollments WHERE room_id = $1 AND status = 'approved'",
    )
    .bind(room_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    if count >= max_students as i64 {
        let _ = tx.rollback().await;
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الغرفة ممتلئة",
                code: "room_full",
            }),
        ));
    }

    let enrollment_id = Uuid::new_v4();

    let insert = sqlx::query(
        "INSERT INTO enrollments (id, room_id, student_id, status) VALUES ($1, $2, $3, 'approved')",
    )
    .bind(enrollment_id)
    .bind(room_id)
    .bind(req.student_id)
    .execute(&mut *tx)
    .await;

    if let Err(e) = insert {
        let _ = tx.rollback().await;
        if let Some(db) = e.as_database_error() {
            if db.code().as_deref() == Some("23505") {
                return Err((
                    StatusCode::CONFLICT,
                    Json(ApiMessage {
                        message: "الطالب مسجل بالفعل",
                        code: "duplicate_enrollment",
                    }),
                ));
            }
        }
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        ));
    }

    sqlx::query(
        "INSERT INTO session_attendance (session_id, student_id, attended) \
         SELECT s.id, $1, false FROM sessions s \
         WHERE s.room_id = $2 AND s.status = 'scheduled'::session_status \
         ON CONFLICT (session_id, student_id) DO NOTHING",
    )
    .bind(req.student_id)
    .bind(room_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    let row = sqlx::query_as::<_, EnrollmentPublic>(
        "SELECT e.id, e.student_id, u.name AS student_name, u.email AS student_email, e.enrolled_at \
         FROM enrollments e \
         INNER JOIN users u ON u.id = e.student_id \
         WHERE e.id = $1",
    )
    .bind(enrollment_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    tx.commit().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn delete_enrollment(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path((room_id, enrollment_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let room: Option<(Uuid,)> = sqlx::query_as("SELECT teacher_id FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((teacher_id,)) = room else {
        return Err(StatusCode::NOT_FOUND);
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let enrolled_student: Option<(Uuid,)> = sqlx::query_as(
        "SELECT student_id FROM enrollments WHERE id = $1 AND room_id = $2 AND status = 'approved'",
    )
    .bind(enrollment_id)
    .bind(room_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((student_id,)) = enrolled_student else {
        return Err(StatusCode::NOT_FOUND);
    };

    let result = sqlx::query("DELETE FROM enrollments WHERE id = $1 AND room_id = $2")
        .bind(enrollment_id)
        .bind(room_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    let _ = sqlx::query(
        "DELETE FROM session_attendance sa \
         USING sessions s \
         WHERE sa.session_id = s.id \
         AND sa.student_id = $1 \
         AND s.room_id = $2 \
         AND s.status = 'scheduled'::session_status",
    )
    .bind(student_id)
    .bind(room_id)
    .execute(&state.db)
    .await;

    Ok(StatusCode::NO_CONTENT)
}

fn server_error_msg() -> (StatusCode, Json<ApiMessage>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ApiMessage {
            message: "خطأ في الخادم",
            code: "server_error",
        }),
    )
}

pub async fn my_enrollment(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
) -> Result<Json<MyEnrollmentStatus>, StatusCode> {
    let row: Option<(Uuid, String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT id, status, enrolled_at FROM enrollments WHERE room_id = $1 AND student_id = $2",
    )
    .bind(room_id)
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match row {
        Some((id, status, at)) => Ok(Json(MyEnrollmentStatus {
            status: Some(status),
            enrollment_id: Some(id),
            enrolled_at: Some(at),
        })),
        None => Ok(Json(MyEnrollmentStatus {
            status: None,
            enrollment_id: None,
            enrolled_at: None,
        })),
    }
}

pub async fn cancel_my_enrollment(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let enrollment: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT id, status::text FROM enrollments WHERE room_id = $1 AND student_id = $2",
    )
    .bind(room_id)
    .bind(auth.id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((enrollment_id, status)) = enrollment else {
        return Err(StatusCode::NOT_FOUND);
    };

    if status != "pending" && status != "approved" {
        return Err(StatusCode::BAD_REQUEST);
    }

    sqlx::query("DELETE FROM enrollments WHERE id = $1")
        .bind(enrollment_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if status == "approved" {
        let _ = sqlx::query(
            "DELETE FROM session_attendance sa \
             USING sessions s \
             WHERE sa.session_id = s.id \
             AND sa.student_id = $1 \
             AND s.room_id = $2 \
             AND s.status::text = 'scheduled'",
        )
        .bind(auth.id)
        .bind(room_id)
        .execute(&state.db)
        .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn join_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
) -> Result<(StatusCode, Json<JoinResult>), (StatusCode, Json<ApiMessage>)> {
    if auth.role != "student" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ApiMessage {
                message: "هذا الإجراء للطلاب فقط",
                code: "students_only",
            }),
        ));
    }

    let mut tx = state.db.begin().await.map_err(|_| server_error_msg())?;

    let room_row: Option<(Uuid, i32, bool, bool, bool, bool)> = sqlx::query_as(
        "SELECT teacher_id, max_students, is_active, is_public, enrollment_open, requires_approval \
         FROM rooms WHERE id = $1 FOR UPDATE",
    )
    .bind(room_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| server_error_msg())?;

    let Some((_, max_students, is_active, is_public, enrollment_open, requires_approval)) = room_row else {
        let _ = tx.rollback().await;
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if !is_active || !is_public {
        let _ = tx.rollback().await;
        return Err((
            StatusCode::FORBIDDEN,
            Json(ApiMessage {
                message: "الغرفة غير متاحة",
                code: "room_not_available",
            }),
        ));
    }

    if !enrollment_open {
        let _ = tx.rollback().await;
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "التسجيل مغلق",
                code: "enrollment_closed",
            }),
        ));
    }

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM enrollments WHERE room_id = $1 AND student_id = $2",
    )
    .bind(room_id)
    .bind(auth.id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| server_error_msg())?;

    if let Some((status,)) = existing {
        let _ = tx.rollback().await;
        let (code, msg): (&'static str, &'static str) = match status.as_str() {
            "approved" => ("already_enrolled", "أنت مسجل بالفعل"),
            "pending" => ("already_pending", "طلبك قيد المراجعة"),
            "rejected" => ("previously_rejected", "تم رفض طلبك سابقًا"),
            _ => ("already_enrolled", "أنت مسجل بالفعل"),
        };
        return Err((StatusCode::CONFLICT, Json(ApiMessage { message: msg, code })));
    }

    let approved_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM enrollments WHERE room_id = $1 AND status = 'approved'",
    )
    .bind(room_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| server_error_msg())?;

    if approved_count >= max_students as i64 {
        let _ = tx.rollback().await;
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الغرفة ممتلئة",
                code: "room_full",
            }),
        ));
    }

    let status = if requires_approval { "pending" } else { "approved" };
    let enrollment_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO enrollments (id, room_id, student_id, status) VALUES ($1, $2, $3, $4)",
    )
    .bind(enrollment_id)
    .bind(room_id)
    .bind(auth.id)
    .bind(status)
    .execute(&mut *tx)
    .await
    .map_err(|_| server_error_msg())?;

    if status == "approved" {
        let _ = sqlx::query(
            "INSERT INTO session_attendance (session_id, student_id, attended) \
             SELECT s.id, $1, false FROM sessions s \
             WHERE s.room_id = $2 AND s.status::text = 'scheduled' \
             ON CONFLICT (session_id, student_id) DO NOTHING",
        )
        .bind(auth.id)
        .bind(room_id)
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await.map_err(|_| server_error_msg())?;

    let message = if status == "pending" {
        "تم إرسال طلب التحاق وبانتظار موافقة المعلّم".to_string()
    } else {
        "تم التسجيل بنجاح".to_string()
    };

    Ok((
        StatusCode::CREATED,
        Json(JoinResult {
            status: status.to_string(),
            message,
        }),
    ))
}

pub async fn list_pending_enrollments(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Vec<EnrollmentWithStatus>>, StatusCode> {
    let room: Option<(Uuid,)> = sqlx::query_as("SELECT teacher_id FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((teacher_id,)) = room else {
        return Err(StatusCode::NOT_FOUND);
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let rows = sqlx::query_as::<_, EnrollmentWithStatus>(
        "SELECT e.id, e.student_id, u.name AS student_name, u.email AS student_email, \
         e.enrolled_at, e.status \
         FROM enrollments e INNER JOIN users u ON u.id = e.student_id \
         WHERE e.room_id = $1 AND e.status = 'pending' \
         ORDER BY e.enrolled_at ASC",
    )
    .bind(room_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(rows))
}

pub async fn approve_enrollment(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path((room_id, enrollment_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<EnrollmentPublic>, (StatusCode, Json<ApiMessage>)> {
    let room: Option<(Uuid,)> = sqlx::query_as("SELECT teacher_id FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| server_error_msg())?;

    let Some((teacher_id,)) = room else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ApiMessage {
                message: "غير مصرح",
                code: "forbidden",
            }),
        ));
    }

    let current: Option<(String, Uuid)> = sqlx::query_as(
        "SELECT status, student_id FROM enrollments WHERE id = $1 AND room_id = $2",
    )
    .bind(enrollment_id)
    .bind(room_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| server_error_msg())?;

    let Some((status, student_id)) = current else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if status != "pending" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الطلب ليس قيد الانتظار",
                code: "not_pending",
            }),
        ));
    }

    let room_info: (i32,) = sqlx::query_as("SELECT max_students FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| server_error_msg())?;

    let approved_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM enrollments WHERE room_id = $1 AND status = 'approved'",
    )
    .bind(room_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| server_error_msg())?;

    if approved_count >= room_info.0 as i64 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الغرفة ممتلئة",
                code: "room_full",
            }),
        ));
    }

    sqlx::query("UPDATE enrollments SET status = 'approved' WHERE id = $1")
        .bind(enrollment_id)
        .execute(&state.db)
        .await
        .map_err(|_| server_error_msg())?;

    let _ = sqlx::query(
        "INSERT INTO session_attendance (session_id, student_id, attended) \
         SELECT s.id, $1, false FROM sessions s \
         WHERE s.room_id = $2 AND s.status::text = 'scheduled' \
         ON CONFLICT (session_id, student_id) DO NOTHING",
    )
    .bind(student_id)
    .bind(room_id)
    .execute(&state.db)
    .await;

    let row = sqlx::query_as::<_, EnrollmentPublic>(
        "SELECT e.id, e.student_id, u.name AS student_name, u.email AS student_email, e.enrolled_at \
         FROM enrollments e INNER JOIN users u ON u.id = e.student_id WHERE e.id = $1",
    )
    .bind(enrollment_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| server_error_msg())?;

    Ok(Json(row))
}

pub async fn reject_enrollment(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path((room_id, enrollment_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<ApiMessage>)> {
    let room: Option<(Uuid,)> = sqlx::query_as("SELECT teacher_id FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| server_error_msg())?;

    let Some((teacher_id,)) = room else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ApiMessage {
                message: "غير مصرح",
                code: "forbidden",
            }),
        ));
    }

    let current: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM enrollments WHERE id = $1 AND room_id = $2",
    )
    .bind(enrollment_id)
    .bind(room_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| server_error_msg())?;

    let Some((status,)) = current else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiMessage {
                message: "غير موجود",
                code: "not_found",
            }),
        ));
    };

    if status != "pending" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "الطلب ليس قيد الانتظار",
                code: "not_pending",
            }),
        ));
    }

    sqlx::query("UPDATE enrollments SET status = 'rejected' WHERE id = $1")
        .bind(enrollment_id)
        .execute(&state.db)
        .await
        .map_err(|_| server_error_msg())?;

    Ok(StatusCode::NO_CONTENT)
}
