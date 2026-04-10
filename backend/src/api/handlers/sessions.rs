// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use std::collections::BTreeSet;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, DateTime, Duration, NaiveDate, NaiveDateTime, TimeZone, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::postgres::PgConnection;
use sqlx::{PgPool, Postgres, QueryBuilder};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{
    CreateSessionsResponse, DeleteGroupResult, Paginated, SessionAttendanceRow, SessionDetailResponse,
    SessionPublic, SessionStatsResponse,
};
use crate::api::AppState;

#[derive(Deserialize)]
pub struct ListSessionsQuery {
    pub room_id: Option<Uuid>,
    pub status: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

fn push_session_list_filters<'a>(
    qb: &mut QueryBuilder<'a, sqlx::Postgres>,
    params: &'a ListSessionsQuery,
) {
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
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub room_id: Uuid,
    pub title: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub duration_minutes: Option<i32>,
    pub notes: Option<String>,
    /// Days of week: 0 = Monday … 6 = Sunday
    pub repeat_days: Option<Vec<i16>>,
    pub repeat_weeks: Option<i32>,
    pub repeat_end_date: Option<DateTime<Utc>>,
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
    pub attendance_note: Option<String>,
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
                "SELECT EXISTS(SELECT 1 FROM enrollments WHERE room_id = $1 AND student_id = $2 AND status = 'approved')",
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

async fn has_overlap_tx(
    conn: &mut PgConnection,
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
    .fetch_one(conn)
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
         s.status::text AS status, s.notes, s.recurrence_group_id, s.recurrence_rule, s.schedule_id, s.created_at \
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
            qb.push(
                " AND EXISTS (SELECT 1 FROM enrollments e WHERE e.room_id = s.room_id AND e.student_id = ",
            );
            qb.push_bind(auth.id);
            qb.push(" AND e.status = 'approved')");
            Ok(())
        }
        _ => Err(StatusCode::FORBIDDEN),
    }
}

pub async fn list_sessions(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListSessionsQuery>,
) -> Result<Json<Paginated<SessionPublic>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);

    let mut qb_count = QueryBuilder::new(
        "SELECT COUNT(s.id)::bigint FROM sessions s INNER JOIN rooms r ON r.id = s.room_id WHERE 1=1",
    );
    apply_role_scope(&mut qb_count, &auth)?;
    push_session_list_filters(&mut qb_count, &params);
    let total: i64 = qb_count
        .build_query_scalar()
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut qb = QueryBuilder::new(
        "SELECT s.id, s.room_id, r.name AS room_name, r.teacher_id, s.title, s.scheduled_at, s.duration_minutes, \
         s.status::text AS status, s.notes, s.recurrence_group_id, s.recurrence_rule, s.schedule_id, s.created_at \
         FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE 1=1",
    );
    apply_role_scope(&mut qb, &auth)?;
    push_session_list_filters(&mut qb, &params);
    qb.push(" ORDER BY s.scheduled_at ASC");
    qb.push(" LIMIT ");
    qb.push_bind(limit);
    qb.push(" OFFSET ");
    qb.push_bind(offset);
    let rows = qb
        .build_query_as::<SessionPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(Paginated {
        items: rows,
        total,
        limit,
        offset,
    }))
}

pub async fn session_stats(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<SessionStatsResponse>, StatusCode> {
    let (total, completed, scheduled, cancelled): (i64, i64, i64, i64) = match auth.role.as_str() {
        "admin" => sqlx::query_as(
            "SELECT COUNT(*)::bigint, \
             COUNT(*) FILTER (WHERE status::text = 'completed')::bigint, \
             COUNT(*) FILTER (WHERE status::text = 'scheduled')::bigint, \
             COUNT(*) FILTER (WHERE status::text = 'cancelled')::bigint \
             FROM sessions",
        )
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        "teacher" => sqlx::query_as(
            "SELECT COUNT(*)::bigint, \
             COUNT(*) FILTER (WHERE s.status::text = 'completed')::bigint, \
             COUNT(*) FILTER (WHERE s.status::text = 'scheduled')::bigint, \
             COUNT(*) FILTER (WHERE s.status::text = 'cancelled')::bigint \
             FROM sessions s \
             INNER JOIN rooms r ON r.id = s.room_id \
             WHERE r.teacher_id = $1",
        )
        .bind(auth.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        "student" => sqlx::query_as(
            "SELECT COUNT(*)::bigint, \
             COUNT(*) FILTER (WHERE s.status::text = 'completed')::bigint, \
             COUNT(*) FILTER (WHERE s.status::text = 'scheduled')::bigint, \
             COUNT(*) FILTER (WHERE s.status::text = 'cancelled')::bigint \
             FROM sessions s \
             WHERE EXISTS (SELECT 1 FROM enrollments e WHERE e.room_id = s.room_id AND e.student_id = $1 AND e.status = 'approved')",
        )
        .bind(auth.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        _ => return Err(StatusCode::FORBIDDEN),
    };

    let avg_attendance_pct: f64 = if completed == 0 {
        0.0
    } else {
        let avg: Option<f64> = match auth.role.as_str() {
            "admin" => sqlx::query_scalar(
                "SELECT AVG(sub.pct)::float8 FROM ( \
                    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE \
                    (COUNT(*) FILTER (WHERE sa.attended))::float8 / COUNT(*)::float8 * 100 END AS pct \
                    FROM session_attendance sa \
                    INNER JOIN sessions s ON s.id = sa.session_id \
                    WHERE s.status::text = 'completed' \
                    GROUP BY sa.session_id \
                ) sub",
            )
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
            "teacher" => sqlx::query_scalar(
                "SELECT AVG(sub.pct)::float8 FROM ( \
                    SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE \
                    (COUNT(*) FILTER (WHERE sa.attended))::float8 / COUNT(*)::float8 * 100 END AS pct \
                    FROM session_attendance sa \
                    INNER JOIN sessions s ON s.id = sa.session_id \
                    INNER JOIN rooms r ON r.id = s.room_id \
                    WHERE s.status::text = 'completed' AND r.teacher_id = $1 \
                    GROUP BY sa.session_id \
                ) sub",
            )
            .bind(auth.id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
            _ => Some(0.0),
        };
        avg.unwrap_or(0.0)
    };

    Ok(Json(SessionStatsResponse {
        total,
        completed,
        scheduled,
        cancelled,
        avg_attendance_pct: (avg_attendance_pct * 10.0).round() / 10.0,
    }))
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
         s.status::text AS status, s.notes, s.recurrence_group_id, s.recurrence_rule, s.schedule_id, s.created_at \
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
         s.status::text AS status, s.notes, s.recurrence_group_id, s.recurrence_rule, s.schedule_id, s.created_at \
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
        "SELECT sa.student_id, u.name AS student_name, sa.attended, sa.attendance_note, sa.joined_at, sa.left_at \
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

async fn insert_session_tx(
    tx: &mut PgConnection,
    room_id: Uuid,
    title: Option<&str>,
    scheduled_at: DateTime<Utc>,
    duration: i32,
    notes: Option<&str>,
    recurrence_group_id: Option<Uuid>,
    recurrence_rule: Option<&str>,
) -> Result<Uuid, sqlx::Error> {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO sessions (room_id, title, scheduled_at, duration_minutes, notes, recurrence_group_id, recurrence_rule) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id",
    )
    .bind(room_id)
    .bind(title)
    .bind(scheduled_at)
    .bind(duration)
    .bind(notes)
    .bind(recurrence_group_id)
    .bind(recurrence_rule)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO session_attendance (session_id, student_id, attended) \
         SELECT $1, e.student_id, false FROM enrollments e WHERE e.room_id = $2 AND e.status = 'approved'",
    )
    .bind(id)
    .bind(room_id)
    .execute(&mut *tx)
    .await?;
    Ok(id)
}

pub async fn create_session(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<CreateSessionsResponse>), (StatusCode, Json<serde_json::Value>)> {
    let duration = req.duration_minutes.unwrap_or(60);
    if duration <= 0 {
        return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
    }

    let repeat_days_raw = req.repeat_days.as_ref().map(|v| v.as_slice()).unwrap_or(&[]);
    let is_repeat = !repeat_days_raw.is_empty();

    let mut days_set = BTreeSet::new();
    for &d in repeat_days_raw {
        if d < 0 || d > 6 {
            return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
        }
        days_set.insert(d);
    }
    let days: Vec<i16> = days_set.into_iter().collect();

    if !is_repeat && req.scheduled_at <= Utc::now() {
        return Err(json_err(StatusCode::BAD_REQUEST, "session_past"));
    }

    let room_row: Option<(Uuid, Uuid)> = sqlx::query_as::<Postgres, (Uuid, Uuid)>(
        "SELECT id, teacher_id FROM rooms WHERE id = $1",
    )
    .bind(req.room_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;
    let (_, teacher_id) = room_row.ok_or_else(|| json_err(StatusCode::NOT_FOUND, "not_found"))?;
    let allowed = auth.role == "admin" || (auth.role == "teacher" && auth.id == teacher_id);
    if !allowed {
        return Err(json_err(StatusCode::FORBIDDEN, "forbidden"));
    }

    if !is_repeat {
        if has_overlap(&state.db, req.room_id, req.scheduled_at, duration, None)
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?
        {
            return Err(json_err(StatusCode::CONFLICT, "session_overlap"));
        }
        let mut tx = state
            .db
            .begin()
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;
        let conn: &mut PgConnection = &mut *tx;
        let session_id = insert_session_tx(
            conn,
            req.room_id,
            req.title.as_deref(),
            req.scheduled_at,
            duration,
            req.notes.as_deref(),
            None,
            None,
        )
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;
        tx.commit()
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;
        let session = fetch_session_public(&state.db, session_id)
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?
            .ok_or_else(|| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;
        return Ok((
            StatusCode::CREATED,
            Json(CreateSessionsResponse {
                sessions: vec![session],
                count: 1,
            }),
        ));
    }

    let start = req.scheduled_at;
    let start_time = start.naive_utc().time();
    let start_d = start.date_naive();
    let start_monday = start_d - Duration::days(start_d.weekday().num_days_from_monday() as i64);

    let (num_weeks, end_d_opt): (i64, Option<NaiveDate>) = if let Some(end_dt) = req.repeat_end_date {
        let end_d = end_dt.date_naive();
        let end_monday = end_d - Duration::days(end_d.weekday().num_days_from_monday() as i64);
        if end_monday < start_monday {
            return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
        }
        let nw = ((end_monday - start_monday).num_days() / 7) + 1;
        (nw, Some(end_d))
    } else {
        let nw = req.repeat_weeks.unwrap_or(4).clamp(1, 12) as i64;
        (nw, None)
    };

    let recurrence_rule = format!(
        "weekly:{}",
        days.iter().map(|d| d.to_string()).collect::<Vec<_>>().join(",")
    );
    let group_id = Uuid::new_v4();

    let mut candidates: Vec<DateTime<Utc>> = Vec::new();
    for week_offset in 0..num_weeks {
        let monday = start_monday + Duration::weeks(week_offset);
        for &day in &days {
            let session_date = monday + Duration::days(day as i64);
            if let Some(end_d) = end_d_opt {
                if session_date > end_d {
                    continue;
                }
            }
            let naive = NaiveDateTime::new(session_date, start_time);
            let scheduled_at = Utc.from_utc_datetime(&naive);
            candidates.push(scheduled_at);
        }
    }
    candidates.sort();
    candidates.dedup();

    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;
    let conn: &mut PgConnection = &mut *tx;
    let mut created_ids: Vec<Uuid> = Vec::new();

    for scheduled_at in candidates {
        if scheduled_at <= Utc::now() {
            continue;
        }
        if has_overlap_tx(conn, req.room_id, scheduled_at, duration, None)
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?
        {
            continue;
        }
        let id = insert_session_tx(
            conn,
            req.room_id,
            req.title.as_deref(),
            scheduled_at,
            duration,
            req.notes.as_deref(),
            Some(group_id),
            Some(&recurrence_rule),
        )
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;
        created_ids.push(id);
    }

    tx.commit()
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    if created_ids.is_empty() {
        return Err(json_err(StatusCode::BAD_REQUEST, "no_sessions_generated"));
    }

    let mut sessions: Vec<SessionPublic> = Vec::with_capacity(created_ids.len());
    for id in created_ids {
        if let Some(s) = fetch_session_public(&state.db, id)
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?
        {
            sessions.push(s);
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(CreateSessionsResponse {
            count: sessions.len(),
            sessions,
        }),
    ))
}

pub async fn delete_recurrence_group(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(group_id): Path<Uuid>,
) -> Result<Json<DeleteGroupResult>, (StatusCode, Json<serde_json::Value>)> {
    let sample: Option<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT s.room_id, r.teacher_id FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE s.recurrence_group_id = $1 LIMIT 1",
    )
    .bind(group_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    let Some((_, teacher_id)) = sample else {
        return Err(json_err(StatusCode::NOT_FOUND, "not_found"));
    };

    let allowed = auth.role == "admin" || (auth.role == "teacher" && auth.id == teacher_id);
    if !allowed {
        return Err(json_err(StatusCode::FORBIDDEN, "forbidden"));
    }

    let result = sqlx::query(
        "DELETE FROM sessions WHERE recurrence_group_id = $1 \
         AND status::text = 'scheduled' AND scheduled_at > NOW()",
    )
    .bind(group_id)
    .execute(&state.db)
    .await
    .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    Ok(Json(DeleteGroupResult {
        deleted: result.rows_affected() as i32,
    }))
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

    if matches!(
        updated.status.as_str(),
        "completed" | "cancelled"
    ) {
        crate::api::ws::signaling::on_session_ended(&state, id).await;
    }

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
            "UPDATE session_attendance SET attended = $1, attendance_note = $2 \
             WHERE session_id = $3 AND student_id = $4",
        )
        .bind(item.attended)
        .bind(item.attendance_note.as_ref())
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
        "SELECT sa.student_id, u.name AS student_name, sa.attended, sa.attendance_note, sa.joined_at, sa.left_at \
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
