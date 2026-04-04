// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{EnrollmentCountResponse, EnrollmentPublic, StudentOption};
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
             AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = u.id AND e.room_id = $1) \
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

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM enrollments WHERE room_id = $1")
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
         WHERE e.room_id = $1 \
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

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM enrollments WHERE room_id = $1")
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
        "INSERT INTO enrollments (id, room_id, student_id) VALUES ($1, $2, $3)",
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
                        code: "already_enrolled",
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

    let result = sqlx::query(
        "DELETE FROM enrollments WHERE id = $1 AND room_id = $2",
    )
    .bind(enrollment_id)
    .bind(room_id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
