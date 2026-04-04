// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::{PgPool, Postgres, QueryBuilder};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{SessionAttendanceRow, SessionDetailResponse, SessionPublic};
use crate::api::AppState;

#[derive(Deserialize)]
pub struct ListSessionsQuery {
    pub room_id: Option<Uuid>,
    pub status: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub room_id: Uuid,
    pub title: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub duration_minutes: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateSessionRequest {
    pub title: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct AttendanceUpdateRequest {
    pub attendance: Vec<AttendanceItem>,
}

#[derive(Deserialize)]
pub struct AttendanceItem {
    pub student_id: Uuid,
    pub attended: bool,
}

fn json_err(status: StatusCode, code: &'static str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "code": code })))
}

async fn can_access_room(
    pool: &PgPool,
    auth: &AuthenticatedUser,
    room_id: Uuid,
) -> Result<bool, StatusCode> {
    match auth.role.as_str() {
        "admin" => Ok(true),
        "teacher" => {
            let ok: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1 AND teacher_id = $2)",
            )
            .bind(room_id)
            .bind(auth.id)
            .fetch_one(pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(ok)
        }
        "student" => {
            let ok: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM enrollments WHERE room_id = $1 AND student_id = $2)",
            )
            .bind(room_id)
            .bind(auth.id)
            .fetch_one(pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(ok)
        }
        _ => Err(StatusCode::FORBIDDEN),
    }
}

async fn can_manage_room(pool: &PgPool, auth: &AuthenticatedUser, room_id: Uuid) -> Result<bool, StatusCode> {
    if auth.role == "admin" {
        return Ok(true);
    }
    if auth.role == "teacher" {
        let ok: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1 AND teacher_id = $2)",
        )
        .bind(room_id)
        .bind(auth.id)
        .fetch_one(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok(ok);
    }
    Ok(false)
}

/// Returns true if another non-cancelled session overlaps [start, start + duration).
async fn has_overlap(
    pool: &PgPool,
    room_id: Uuid,
    start: DateTime<Utc>,
    duration_minutes: i32,
    exclude_session_id: Option<Uuid>,
) -> Result<bool, StatusCode> {
    if duration_minutes <= 0 {
        return Ok(true);
    }
    let end = start + Duration::minutes(duration_minutes as i64);
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.room_id = $1
            AND s.status::text <> 'cancelled'
            AND ($2::uuid IS NULL OR s.id <> $2)
            AND s.scheduled_at < $3
            AND $4 < s.scheduled_at + (s.duration_minutes || ' minutes')::interval
        )",
    )
    .bind(room_id)
    .bind(exclude_session_id)
    .bind(end)
    .bind(start)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(exists)
}

async fn fetch_session_public(
    pool: &PgPool,
    session_id: Uuid,
) -> Result<Option<SessionPublic>, StatusCode> {
    let row: Option<SessionPublic> = sqlx::query_as::<Postgres, SessionPublic>(
        "SELECT s.id, s.room_id, r.name AS room_name, r.teacher_id, s.title, s.scheduled_at, s.duration_minutes, \
         s.status::text AS status, s.notes, s.created_at \
         FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE s.id = $1",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(row)
}

fn apply_role_scope(qb: &mut QueryBuilder<'_, sqlx::Postgres>, auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    match auth.role.as_str() {
        "admin" => Ok(()),
        "teacher" => {
            qb.push(" AND r.teacher_id = ");
            qb.push_bind(auth.id);
            Ok(())
        }
        "student" => {
            qb.push(" AND EXISTS (SELECT 1 FROM enrollments e WHERE e.room_id = s.room_id AND e.student_id = ");
            qb.push_bind(auth.id);
            qb.push(")");
            Ok(())
        }
        _ => Err(StatusCode::FORBIDDEN),
    }
}

pub async fn list_sessions(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListSessionsQuery>,
) -> Result<Json<Vec<SessionPublic>>, StatusCode> {
    let mut qb = QueryBuilder::new(
        "SELECT s.id, s.room_id, r.name AS room_name, r.teacher_id, s.title, s.scheduled_at, s.duration_minutes, \
         s.status::text AS status, s.notes, s.created_at \
         FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE 1=1",
    );
    apply_role_scope(&mut qb, &auth)?;
    if let Some(rid) = params.room_id {
        qb.push(" AND s.room_id = ");
        qb.push_bind(rid);
    }
    if let Some(st) = &params.status {
        let t = st.trim();
        if matches!(t, "scheduled" | "in_progress" | "completed" | "cancelled") {
            qb.push(" AND s.status::text = ");
            qb.push_bind(t);
        }
    }
    if let Some(from) = params.from {
        qb.push(" AND s.scheduled_at >= ");
        qb.push_bind(from);
    }
    if let Some(to) = params.to {
        qb.push(" AND s.scheduled_at <= ");
        qb.push_bind(to);
    }
    qb.push(" ORDER BY s.scheduled_at ASC");
    let rows = qb
        .build_query_as::<SessionPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(rows))
}

pub async fn list_for_room(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Vec<SessionPublic>>, StatusCode> {
    if !can_access_room(&state.db, &auth, room_id).await? {
        return Err(StatusCode::FORBIDDEN);
    }
    let mut qb = QueryBuilder::new(
        "SELECT s.id, s.room_id, r.name AS room_name, r.teacher_id, s.title, s.scheduled_at, s.duration_minutes, \
         s.status::text AS status, s.notes, s.created_at \
         FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE s.room_id = ",
    );
    qb.push_bind(room_id);
    apply_role_scope(&mut qb, &auth)?;
    qb.push(" ORDER BY s.scheduled_at ASC");
    let rows = qb
        .build_query_as::<SessionPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(rows))
}

pub async fn upcoming(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<Vec<SessionPublic>>, StatusCode> {
    let mut qb = QueryBuilder::new(
        "SELECT s.id, s.room_id, r.name AS room_name, r.teacher_id, s.title, s.scheduled_at, s.duration_minutes, \
         s.status::text AS status, s.notes, s.created_at \
         FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE s.status::text = 'scheduled' \
         AND s.scheduled_at > NOW()",
    );
    apply_role_scope(&mut qb, &auth)?;
    qb.push(" ORDER BY s.scheduled_at ASC LIMIT 5");
    let rows = qb
        .build_query_as::<SessionPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(rows))
}

pub async fn get_session(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<SessionDetailResponse>, StatusCode> {
    let session = fetch_session_public(&state.db, id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !can_access_room(&state.db, &auth, session.room_id).await? {
        return Err(StatusCode::FORBIDDEN);
    }
    let attendance: Vec<SessionAttendanceRow> = sqlx::query_as::<Postgres, SessionAttendanceRow>(
        "SELECT sa.student_id, u.name AS student_name, sa.attended, sa.joined_at, sa.left_at \
         FROM session_attendance sa \
         INNER JOIN users u ON u.id = sa.student_id \
         WHERE sa.session_id = $1 \
         ORDER BY u.name ASC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SessionDetailResponse {
        session,
        attendance,
    }))
}

pub async fn create_session(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<SessionPublic>), (StatusCode, Json<serde_json::Value>)> {
    let duration = req.duration_minutes.unwrap_or(60);
    if duration <= 0 {
        return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
    }
    if req.scheduled_at <= Utc::now() {
        return Err(json_err(StatusCode::BAD_REQUEST, "session_past"));
    }
    let room_row: Option<(Uuid, Uuid)> = sqlx::query_as::<Postgres, (Uuid, Uuid)>(
        "SELECT id, teacher_id FROM rooms WHERE id = $1",
    )
    .bind(req.room_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    let (_, teacher_id) = room_row.ok_or((StatusCode::NOT_FOUND, Json(json!({ "code": "not_found" }))))?;
    let allowed = auth.role == "admin" || (auth.role == "teacher" && auth.id == teacher_id);
    if !allowed {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "code": "forbidden" }))));
    }
    if has_overlap(&state.db, req.room_id, req.scheduled_at, duration, None)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
    {
        return Err((StatusCode::CONFLICT, Json(json!({ "code": "session_overlap" }))));
    }
    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    let session_id: Uuid = sqlx::query_scalar(
        "INSERT INTO sessions (room_id, title, scheduled_at, duration_minutes, notes) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING id",
    )
    .bind(req.room_id)
    .bind(req.title.as_ref())
    .bind(req.scheduled_at)
    .bind(duration)
    .bind(req.notes.as_ref())
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    sqlx::query(
        "INSERT INTO session_attendance (session_id, student_id, attended) \
         SELECT $1, e.student_id, false FROM enrollments e WHERE e.room_id = $2",
    )
    .bind(session_id)
    .bind(req.room_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    let session = fetch_session_public(&state.db, session_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    Ok((StatusCode::CREATED, Json(session)))
}

fn parse_status(s: &str) -> Option<&'static str> {
    match s.trim() {
        "scheduled" => Some("scheduled"),
        "in_progress" => Some("in_progress"),
        "completed" => Some("completed"),
        "cancelled" => Some("cancelled"),
        _ => None,
    }
}

pub async fn update_session(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateSessionRequest>,
) -> Result<Json<SessionPublic>, (StatusCode, Json<serde_json::Value>)> {
    let session = fetch_session_public(&state.db, id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({ "code": "not_found" }))))?;
    if session.status == "completed" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "code": "session_completed" }))));
    }
    if !can_manage_room(&state.db, &auth, session.room_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
    {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "code": "forbidden" }))));
    }
    let new_start = req.scheduled_at.unwrap_or(session.scheduled_at);
    let new_duration = req.duration_minutes.unwrap_or(session.duration_minutes);
    if new_duration <= 0 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "code": "bad_request" }))));
    }
    if req.scheduled_at.is_some() || req.duration_minutes.is_some() {
        if has_overlap(&state.db, session.room_id, new_start, new_duration, Some(id))
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
        {
            return Err((StatusCode::CONFLICT, Json(json!({ "code": "session_overlap" }))));
        }
    }
    let status_bind: Option<&str> = match &req.status {
        None => None,
        Some(s) => Some(parse_status(s).ok_or((StatusCode::BAD_REQUEST, Json(json!({ "code": "bad_request" }))))?),
    };
    sqlx::query(
        "UPDATE sessions SET \
         title = COALESCE($1, title), \
         scheduled_at = COALESCE($2, scheduled_at), \
         duration_minutes = COALESCE($3, duration_minutes), \
         notes = COALESCE($4, notes), \
         status = CASE WHEN $5 IS NULL THEN status ELSE $5::text::session_status END \
         WHERE id = $6",
    )
    .bind(req.title.as_ref())
    .bind(req.scheduled_at)
    .bind(req.duration_minutes)
    .bind(req.notes.as_ref())
    .bind(status_bind)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    let updated = fetch_session_public(&state.db, id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    Ok(Json(updated))
}

pub async fn delete_session(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let session = fetch_session_public(&state.db, id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({ "code": "not_found" }))))?;
    if matches!(session.status.as_str(), "completed" | "in_progress") {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "code": "session_delete_forbidden" }))));
    }
    if !can_manage_room(&state.db, &auth, session.room_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
    {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "code": "forbidden" }))));
    }
    sqlx::query("DELETE FROM sessions WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_attendance(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<AttendanceUpdateRequest>,
) -> Result<Json<Vec<SessionAttendanceRow>>, (StatusCode, Json<serde_json::Value>)> {
    let session = fetch_session_public(&state.db, id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
        .ok_or((StatusCode::NOT_FOUND, Json(json!({ "code": "not_found" }))))?;
    if !can_manage_room(&state.db, &auth, session.room_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
    {
        return Err((StatusCode::FORBIDDEN, Json(json!({ "code": "forbidden" }))));
    }
    for item in &req.attendance {
        let n = sqlx::query(
            "UPDATE session_attendance SET attended = $1 \
             WHERE session_id = $2 AND student_id = $3",
        )
        .bind(item.attended)
        .bind(id)
        .bind(item.student_id)
        .execute(&state.db)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?
        .rows_affected();
        if n == 0 {
            return Err((StatusCode::BAD_REQUEST, Json(json!({ "code": "bad_request" }))));
        }
    }
    let attendance: Vec<SessionAttendanceRow> = sqlx::query_as::<Postgres, SessionAttendanceRow>(
        "SELECT sa.student_id, u.name AS student_name, sa.attended, sa.joined_at, sa.left_at \
         FROM session_attendance sa \
         INNER JOIN users u ON u.id = sa.student_id \
         WHERE sa.session_id = $1 \
         ORDER BY u.name ASC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "code": "server_error" }))))?;
    Ok(Json(attendance))
}
