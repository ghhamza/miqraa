// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::QueryBuilder;
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{Paginated, RoomPublic, RoomStatsResponse, TeacherOption};
use crate::api::AppState;
use crate::riwaya::parse_riwaya;

#[derive(Deserialize)]
pub struct ListRoomsQuery {
    pub search: Option<String>,
    pub active: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
    pub teacher_id: Option<Uuid>,
    pub max_students: Option<i32>,
    pub riwaya: Option<String>,
    /// `hifz` | `tilawa` | `muraja` | `tajweed`
    pub halaqah_type: Option<String>,
    pub is_public: Option<bool>,
    pub enrollment_open: Option<bool>,
    pub requires_approval: Option<bool>,
}

#[derive(Deserialize)]
pub struct UpdateRoomRequest {
    pub name: Option<String>,
    pub max_students: Option<i32>,
    pub is_active: Option<bool>,
    pub riwaya: Option<String>,
    pub halaqah_type: Option<String>,
    pub is_public: Option<bool>,
    pub enrollment_open: Option<bool>,
    pub requires_approval: Option<bool>,
}

fn require_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    if auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

fn require_teacher_or_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    match auth.role.as_str() {
        "teacher" | "admin" => Ok(()),
        _ => Err(StatusCode::FORBIDDEN),
    }
}

fn can_manage_room(auth: &AuthenticatedUser, room_teacher_id: Uuid) -> bool {
    auth.role == "admin" || (auth.role == "teacher" && auth.id == room_teacher_id)
}

fn parse_halaqah_type(s: &str) -> Result<&str, StatusCode> {
    match s {
        "hifz" | "tilawa" | "muraja" | "tajweed" => Ok(s),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

async fn is_valid_teacher(state: &AppState, id: Uuid) -> Result<bool, StatusCode> {
    let ok: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND role = 'teacher'::user_role)",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(ok)
}

pub async fn room_stats(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<RoomStatsResponse>, StatusCode> {
    match auth.role.as_str() {
        "admin" => {
            let row: (i64, i64, i64) = sqlx::query_as(
                "SELECT COUNT(*)::bigint,
                        COUNT(*) FILTER (WHERE is_active)::bigint,
                        COUNT(*) FILTER (WHERE NOT is_active)::bigint
                 FROM rooms",
            )
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(RoomStatsResponse {
                total: row.0,
                active: row.1,
                inactive: row.2,
            }))
        }
        "teacher" => {
            let row: (i64, i64, i64) = sqlx::query_as(
                "SELECT COUNT(*)::bigint,
                        COUNT(*) FILTER (WHERE is_active)::bigint,
                        COUNT(*) FILTER (WHERE NOT is_active)::bigint
                 FROM rooms WHERE teacher_id = $1",
            )
            .bind(auth.id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(RoomStatsResponse {
                total: row.0,
                active: row.1,
                inactive: row.2,
            }))
        }
        "student" => {
            let total: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM rooms WHERE is_active = true")
                .fetch_one(&state.db)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(Json(RoomStatsResponse {
                total,
                active: total,
                inactive: 0,
            }))
        }
        _ => Err(StatusCode::FORBIDDEN),
    }
}

pub async fn list_teachers(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<Vec<TeacherOption>>, StatusCode> {
    require_admin(&auth)?;

    let teachers = sqlx::query_as::<_, TeacherOption>(
        "SELECT id, name, email FROM users WHERE role = 'teacher'::user_role ORDER BY name ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(teachers))
}

fn push_room_list_filters(
    qb: &mut QueryBuilder<'_, sqlx::Postgres>,
    auth: &AuthenticatedUser,
    params: &ListRoomsQuery,
) -> Result<(), StatusCode> {
    match auth.role.as_str() {
        "admin" => {}
        "teacher" => {
            qb.push(" AND r.teacher_id = ");
            qb.push_bind(auth.id);
        }
        "student" => {
            qb.push(
                " AND (r.is_public = true OR EXISTS (SELECT 1 FROM enrollments e WHERE e.room_id = r.id AND e.student_id = ",
            );
            qb.push_bind(auth.id);
            qb.push(" AND e.status IN ('approved', 'pending')))");
            qb.push(" AND r.is_active = true");
        }
        _ => return Err(StatusCode::FORBIDDEN),
    }

    if let Some(s) = &params.search {
        let t = s.trim();
        if !t.is_empty() {
            let pattern = format!("%{}%", t);
            qb.push(" AND r.name ILIKE ");
            qb.push_bind(pattern);
        }
    }

    if let Some(active) = params.active {
        qb.push(" AND r.is_active = ");
        qb.push_bind(active);
    }
    Ok(())
}

pub async fn list_rooms(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListRoomsQuery>,
) -> Result<Json<Paginated<RoomPublic>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);

    let mut qb_count = match auth.role.as_str() {
        "student" => {
            let mut b = QueryBuilder::new(
                "SELECT COUNT(r.id)::bigint \
                 FROM rooms r \
                 INNER JOIN users u ON u.id = r.teacher_id \
                 LEFT JOIN enrollments e_my ON e_my.room_id = r.id AND e_my.student_id = ",
            );
            b.push_bind(auth.id);
            b.push(" WHERE 1=1");
            b
        }
        _ => QueryBuilder::new(
            "SELECT COUNT(r.id)::bigint FROM rooms r INNER JOIN users u ON u.id = r.teacher_id WHERE 1=1",
        ),
    };
    push_room_list_filters(&mut qb_count, &auth, &params)?;
    let total: i64 = qb_count
        .build_query_scalar()
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut qb = match auth.role.as_str() {
        "student" => {
            let mut b = QueryBuilder::new(
                "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
                 r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
                 COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
                 r.is_public, r.enrollment_open, r.requires_approval, \
                 COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
                 e_my.status AS my_status \
                 FROM rooms r \
                 INNER JOIN users u ON u.id = r.teacher_id \
                 LEFT JOIN enrollments e_my ON e_my.room_id = r.id AND e_my.student_id = ",
            );
            b.push_bind(auth.id);
            b.push(" WHERE 1=1");
            b
        }
        _ => QueryBuilder::new(
            "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
             r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
             r.is_public, r.enrollment_open, r.requires_approval, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
             CAST(NULL AS TEXT) AS my_status \
             FROM rooms r \
             INNER JOIN users u ON u.id = r.teacher_id \
             WHERE 1=1",
        ),
    };

    push_room_list_filters(&mut qb, &auth, &params)?;
    qb.push(" ORDER BY r.created_at DESC");
    qb.push(" LIMIT ");
    qb.push_bind(limit);
    qb.push(" OFFSET ");
    qb.push_bind(offset);

    let rooms = qb
        .build_query_as::<RoomPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(Paginated {
        items: rooms,
        total,
        limit,
        offset,
    }))
}

pub async fn get_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<RoomPublic>, StatusCode> {
    let room = if auth.role == "student" {
        sqlx::query_as::<_, RoomPublic>(
            "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
             r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
             r.is_public, r.enrollment_open, r.requires_approval, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
             (SELECT e.status FROM enrollments e WHERE e.room_id = r.id AND e.student_id = $2 LIMIT 1) AS my_status \
             FROM rooms r \
             INNER JOIN users u ON u.id = r.teacher_id \
             WHERE r.id = $1",
        )
        .bind(id)
        .bind(auth.id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query_as::<_, RoomPublic>(
            "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
             r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
             r.is_public, r.enrollment_open, r.requires_approval, \
             COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
             CAST(NULL AS TEXT) AS my_status \
             FROM rooms r \
             INNER JOIN users u ON u.id = r.teacher_id \
             WHERE r.id = $1",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if auth.role == "student" {
        if !room.is_active {
            return Err(StatusCode::FORBIDDEN);
        }
        if !room.is_public {
            let has: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM enrollments WHERE room_id = $1 AND student_id = $2)",
            )
            .bind(id)
            .bind(auth.id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            if !has {
                return Err(StatusCode::FORBIDDEN);
            }
        }
    }

    Ok(Json(room))
}

pub async fn create_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<RoomPublic>, StatusCode> {
    require_teacher_or_admin(&auth)?;

    let name = req.name.trim();
    if name.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let max_students = req.max_students.unwrap_or(20);
    if max_students < 1 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let teacher_id = if auth.role == "teacher" {
        auth.id
    } else {
        let tid = req.teacher_id.ok_or(StatusCode::BAD_REQUEST)?;
        if !is_valid_teacher(&state, tid).await? {
            return Err(StatusCode::BAD_REQUEST);
        }
        tid
    };

    let id = Uuid::new_v4();

    let riwaya = req
        .riwaya
        .as_deref()
        .and_then(parse_riwaya)
        .unwrap_or("hafs");

    let halaqah_type = req.halaqah_type.as_deref().unwrap_or("hifz");
    parse_halaqah_type(halaqah_type)?;

    let is_public = req.is_public.unwrap_or(false);
    let enrollment_open = req.enrollment_open.unwrap_or(true);
    let requires_approval = req.requires_approval.unwrap_or(true);

    sqlx::query(
        "INSERT INTO rooms (id, name, teacher_id, max_students, is_active, riwaya, halaqah_type, is_public, enrollment_open, requires_approval) \
         VALUES ($1, $2, $3, $4, true, $5, $6::halaqah_type, $7, $8, $9)",
    )
    .bind(id)
    .bind(name)
    .bind(teacher_id)
    .bind(max_students)
    .bind(riwaya)
    .bind(halaqah_type)
    .bind(is_public)
    .bind(enrollment_open)
    .bind(requires_approval)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!(error = ?e, "create_room insert failed");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let room = sqlx::query_as::<_, RoomPublic>(
        "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
         r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
         r.is_public, r.enrollment_open, r.requires_approval, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
         CAST(NULL AS TEXT) AS my_status \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(room))
}

pub async fn update_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateRoomRequest>,
) -> Result<Json<RoomPublic>, StatusCode> {
    let existing = sqlx::query_as::<_, RoomPublic>(
        "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
         r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
         r.is_public, r.enrollment_open, r.requires_approval, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
         CAST(NULL AS TEXT) AS my_status \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if !can_manage_room(&auth, existing.teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    if req.name.is_none()
        && req.max_students.is_none()
        && req.is_active.is_none()
        && req.riwaya.is_none()
        && req.halaqah_type.is_none()
        && req.is_public.is_none()
        && req.enrollment_open.is_none()
        && req.requires_approval.is_none()
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    let name = req.name.map(|n| n.trim().to_string()).unwrap_or(existing.name.clone());
    let max_students = req.max_students.unwrap_or(existing.max_students);
    let is_active = req.is_active.unwrap_or(existing.is_active);
    let riwaya = req
        .riwaya
        .as_deref()
        .map(|s| parse_riwaya(s).ok_or(StatusCode::BAD_REQUEST))
        .transpose()?
        .map(|s| s.to_string())
        .unwrap_or(existing.riwaya.clone());
    let halaqah_type: String = if let Some(ref s) = req.halaqah_type {
        parse_halaqah_type(s.trim())?.to_string()
    } else {
        existing.halaqah_type.clone()
    };
    let is_public = req.is_public.unwrap_or(existing.is_public);
    let enrollment_open = req.enrollment_open.unwrap_or(existing.enrollment_open);
    let requires_approval = req.requires_approval.unwrap_or(existing.requires_approval);

    if name.is_empty() || max_students < 1 {
        return Err(StatusCode::BAD_REQUEST);
    }

    sqlx::query(
        "UPDATE rooms SET name = $1, max_students = $2, is_active = $3, riwaya = $4, \
         halaqah_type = $5::halaqah_type, is_public = $6, enrollment_open = $7, requires_approval = $8 WHERE id = $9",
    )
    .bind(&name)
    .bind(max_students)
    .bind(is_active)
    .bind(&riwaya)
    .bind(&halaqah_type)
    .bind(is_public)
    .bind(enrollment_open)
    .bind(requires_approval)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let room = sqlx::query_as::<_, RoomPublic>(
        "SELECT r.id, r.name, r.teacher_id, u.name AS teacher_name, r.max_students, r.is_active, r.created_at, \
         r.riwaya::text AS riwaya, r.halaqah_type::text AS halaqah_type, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'approved'), 0) AS enrolled_count, \
         r.is_public, r.enrollment_open, r.requires_approval, \
         COALESCE((SELECT COUNT(*)::bigint FROM enrollments e WHERE e.room_id = r.id AND e.status = 'pending'), 0) AS pending_count, \
         CAST(NULL AS TEXT) AS my_status \
         FROM rooms r \
         INNER JOIN users u ON u.id = r.teacher_id \
         WHERE r.id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(room))
}

/// Deactivates the room (archive). Historical enrollments, sessions, and recitations are preserved.
pub async fn delete_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let row: Option<(Uuid, bool)> = sqlx::query_as("SELECT teacher_id, is_active FROM rooms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some((teacher_id, was_active)) = row else {
        return Err(StatusCode::NOT_FOUND);
    };

    if !can_manage_room(&auth, teacher_id) {
        return Err(StatusCode::FORBIDDEN);
    }

    if !was_active {
        return Ok(StatusCode::NO_CONTENT);
    }

    let result = sqlx::query("UPDATE rooms SET is_active = false WHERE id = $1 AND is_active = true")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
