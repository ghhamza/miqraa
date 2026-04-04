// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use std::ops::DerefMut;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, Duration, FixedOffset, NaiveTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::postgres::PgConnection;
use sqlx::{FromRow, PgPool, Postgres};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::AppState;

// ── Types ──

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SchedulePublic {
    pub id: Uuid,
    pub room_id: Uuid,
    pub room_name: String,
    pub title: Option<String>,
    pub day_of_week: i16,
    pub start_time_minutes: i16,
    pub duration_minutes: i32,
    pub is_active: bool,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct CreateScheduleRequest {
    pub room_id: Uuid,
    pub title: Option<String>,
    pub day_of_week: i16,
    pub start_time_minutes: i16,
    pub duration_minutes: Option<i32>,
}

#[derive(Deserialize)]
pub struct CreateBatchScheduleRequest {
    pub room_id: Uuid,
    pub title: Option<String>,
    pub slots: Vec<ScheduleSlot>,
}

#[derive(Deserialize)]
pub struct ScheduleSlot {
    pub day_of_week: i16,
    pub start_time_minutes: i16,
    pub duration_minutes: Option<i32>,
}

#[derive(Deserialize)]
pub struct UpdateScheduleRequest {
    pub title: Option<String>,
    pub day_of_week: Option<i16>,
    pub start_time_minutes: Option<i16>,
    pub duration_minutes: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Deserialize)]
pub struct GenerateSessionsRequest {
    pub room_id: Uuid,
    pub weeks: Option<i32>,
    pub schedule_ids: Option<Vec<Uuid>>,
    pub tz_offset_minutes: Option<i32>,
}

#[derive(Serialize)]
pub struct GenerateResult {
    pub created: i32,
    pub skipped: i32,
    pub sessions: Vec<SessionIdTitle>,
}

#[derive(Serialize)]
pub struct SessionIdTitle {
    pub id: Uuid,
    pub scheduled_at: chrono::DateTime<Utc>,
}

// ── Helpers ──

fn json_err(status: StatusCode, code: &'static str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "code": code })))
}

async fn room_teacher_id(pool: &PgPool, room_id: Uuid) -> Result<Option<Uuid>, StatusCode> {
    let row: Option<(Uuid,)> = sqlx::query_as("SELECT teacher_id FROM rooms WHERE id = $1")
        .bind(room_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(row.map(|r| r.0))
}

fn can_manage(auth: &AuthenticatedUser, teacher_id: Uuid) -> bool {
    auth.role == "admin" || (auth.role == "teacher" && auth.id == teacher_id)
}

fn validate_day(d: i16) -> bool {
    (0..=6).contains(&d)
}

fn validate_time(t: i16) -> bool {
    (0..1440).contains(&t)
}

async fn fetch_schedule(pool: &PgPool, id: Uuid) -> Result<Option<SchedulePublic>, StatusCode> {
    sqlx::query_as::<Postgres, SchedulePublic>(
        "SELECT sc.id, sc.room_id, r.name AS room_name, sc.title, sc.day_of_week, \
         sc.start_time_minutes, sc.duration_minutes, sc.is_active, sc.created_at \
         FROM schedules sc \
         INNER JOIN rooms r ON r.id = sc.room_id \
         WHERE sc.id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn has_overlap_tx(
    conn: &mut PgConnection,
    room_id: Uuid,
    start: chrono::DateTime<Utc>,
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

// ── Handlers ──

pub async fn list_schedules(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Vec<SchedulePublic>>, StatusCode> {
    let teacher_id = room_teacher_id(&state.db, room_id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;

    if auth.role == "student" {
        let enrolled: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM enrollments WHERE room_id = $1 AND student_id = $2 AND status = 'approved')",
        )
        .bind(room_id)
        .bind(auth.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if !enrolled {
            return Err(StatusCode::FORBIDDEN);
        }
    } else if auth.role == "teacher" && auth.id != teacher_id {
        return Err(StatusCode::FORBIDDEN);
    }

    let rows = sqlx::query_as::<Postgres, SchedulePublic>(
        "SELECT sc.id, sc.room_id, r.name AS room_name, sc.title, sc.day_of_week, \
         sc.start_time_minutes, sc.duration_minutes, sc.is_active, sc.created_at \
         FROM schedules sc \
         INNER JOIN rooms r ON r.id = sc.room_id \
         WHERE sc.room_id = $1 \
         ORDER BY sc.day_of_week ASC, sc.start_time_minutes ASC",
    )
    .bind(room_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(rows))
}

pub async fn create_schedule(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateScheduleRequest>,
) -> Result<(StatusCode, Json<SchedulePublic>), (StatusCode, Json<serde_json::Value>)> {
    let teacher_id = room_teacher_id(&state.db, req.room_id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::NOT_FOUND, "not_found"))?;

    if !can_manage(&auth, teacher_id) {
        return Err(json_err(StatusCode::FORBIDDEN, "forbidden"));
    }

    if !validate_day(req.day_of_week) || !validate_time(req.start_time_minutes) {
        return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
    }

    let duration = req.duration_minutes.unwrap_or(60);
    if duration <= 0 {
        return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
    }

    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO schedules (room_id, title, day_of_week, start_time_minutes, duration_minutes) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(req.room_id)
    .bind(req.title.as_deref())
    .bind(req.day_of_week)
    .bind(req.start_time_minutes)
    .bind(duration)
    .fetch_one(&state.db)
    .await
    .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    let schedule = fetch_schedule(&state.db, id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    Ok((StatusCode::CREATED, Json(schedule)))
}

pub async fn create_batch_schedules(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateBatchScheduleRequest>,
) -> Result<(StatusCode, Json<Vec<SchedulePublic>>), (StatusCode, Json<serde_json::Value>)> {
    if req.slots.is_empty() {
        return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
    }
    if req.slots.len() > 14 {
        return Err(json_err(StatusCode::BAD_REQUEST, "too_many_slots"));
    }

    let teacher_id = room_teacher_id(&state.db, req.room_id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::NOT_FOUND, "not_found"))?;

    if !can_manage(&auth, teacher_id) {
        return Err(json_err(StatusCode::FORBIDDEN, "forbidden"));
    }

    for slot in &req.slots {
        if !validate_day(slot.day_of_week) || !validate_time(slot.start_time_minutes) {
            return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
        }
        if let Some(d) = slot.duration_minutes {
            if d <= 0 {
                return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
            }
        }
    }

    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    let mut ids: Vec<Uuid> = Vec::new();
    for slot in &req.slots {
        let duration = slot.duration_minutes.unwrap_or(60);
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO schedules (room_id, title, day_of_week, start_time_minutes, duration_minutes) \
             VALUES ($1, $2, $3, $4, $5) RETURNING id",
        )
        .bind(req.room_id)
        .bind(req.title.as_deref())
        .bind(slot.day_of_week)
        .bind(slot.start_time_minutes)
        .bind(duration)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;
        ids.push(id);
    }

    tx.commit()
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    let mut result = Vec::new();
    for id in ids {
        let s = fetch_schedule(&state.db, id)
            .await
            .map_err(|e| json_err(e, "server_error"))?;
        if let Some(row) = s {
            result.push(row);
        }
    }

    Ok((StatusCode::CREATED, Json(result)))
}

pub async fn update_schedule(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateScheduleRequest>,
) -> Result<Json<SchedulePublic>, (StatusCode, Json<serde_json::Value>)> {
    let existing = fetch_schedule(&state.db, id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::NOT_FOUND, "not_found"))?;

    let teacher_id = room_teacher_id(&state.db, existing.room_id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::NOT_FOUND, "not_found"))?;

    if !can_manage(&auth, teacher_id) {
        return Err(json_err(StatusCode::FORBIDDEN, "forbidden"));
    }

    let day = req.day_of_week.unwrap_or(existing.day_of_week);
    let time = req.start_time_minutes.unwrap_or(existing.start_time_minutes);
    let dur = req.duration_minutes.unwrap_or(existing.duration_minutes);
    let active = req.is_active.unwrap_or(existing.is_active);

    if !validate_day(day) || !validate_time(time) || dur <= 0 {
        return Err(json_err(StatusCode::BAD_REQUEST, "bad_request"));
    }

    sqlx::query(
        "UPDATE schedules SET title = COALESCE($1, title), day_of_week = $2, \
         start_time_minutes = $3, duration_minutes = $4, is_active = $5 WHERE id = $6",
    )
    .bind(req.title.as_deref())
    .bind(day)
    .bind(time)
    .bind(dur)
    .bind(active)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    let updated = fetch_schedule(&state.db, id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    Ok(Json(updated))
}

pub async fn delete_schedule(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let existing = fetch_schedule(&state.db, id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::NOT_FOUND, "not_found"))?;

    let teacher_id = room_teacher_id(&state.db, existing.room_id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::NOT_FOUND, "not_found"))?;

    if !can_manage(&auth, teacher_id) {
        return Err(json_err(StatusCode::FORBIDDEN, "forbidden"));
    }

    sqlx::query("DELETE FROM schedules WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn generate_sessions(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<GenerateSessionsRequest>,
) -> Result<Json<GenerateResult>, (StatusCode, Json<serde_json::Value>)> {
    let teacher_id = room_teacher_id(&state.db, req.room_id)
        .await
        .map_err(|s| json_err(s, "server_error"))?
        .ok_or_else(|| json_err(StatusCode::NOT_FOUND, "not_found"))?;

    if !can_manage(&auth, teacher_id) {
        return Err(json_err(StatusCode::FORBIDDEN, "forbidden"));
    }

    let weeks = req.weeks.unwrap_or(4).clamp(1, 12);
    let tz_offset_minutes = req.tz_offset_minutes.unwrap_or(180);

    let offset = FixedOffset::east_opt(tz_offset_minutes * 60)
        .ok_or_else(|| json_err(StatusCode::BAD_REQUEST, "bad_request"))?;

    let schedules = if let Some(ref ids) = req.schedule_ids {
        let mut result = Vec::new();
        for sid in ids {
            if let Some(s) = fetch_schedule(&state.db, *sid)
                .await
                .map_err(|e| json_err(e, "server_error"))?
            {
                if s.room_id == req.room_id && s.is_active {
                    result.push(s);
                }
            }
        }
        result
    } else {
        sqlx::query_as::<Postgres, SchedulePublic>(
            "SELECT sc.id, sc.room_id, r.name AS room_name, sc.title, sc.day_of_week, \
             sc.start_time_minutes, sc.duration_minutes, sc.is_active, sc.created_at \
             FROM schedules sc \
             INNER JOIN rooms r ON r.id = sc.room_id \
             WHERE sc.room_id = $1 AND sc.is_active = true \
             ORDER BY sc.day_of_week ASC, sc.start_time_minutes ASC",
        )
        .bind(req.room_id)
        .fetch_all(&state.db)
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?
    };

    if schedules.is_empty() {
        return Ok(Json(GenerateResult {
            created: 0,
            skipped: 0,
            sessions: vec![],
        }));
    }

    let now = Utc::now();
    let local_now = now + Duration::minutes(tz_offset_minutes as i64);
    let today_local = local_now.date_naive();

    let mut created = 0i32;
    let mut skipped = 0i32;
    let mut created_sessions: Vec<SessionIdTitle> = Vec::new();

    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    for schedule in &schedules {
        let target_weekday = schedule.day_of_week as u32;
        let hour = (schedule.start_time_minutes / 60) as u32;
        let minute = (schedule.start_time_minutes % 60) as u32;
        let local_time = NaiveTime::from_hms_opt(hour, minute, 0).unwrap_or_default();

        let today_weekday = today_local.weekday().num_days_from_monday();
        let days_until = if target_weekday >= today_weekday {
            target_weekday - today_weekday
        } else {
            7 - (today_weekday - target_weekday)
        };

        for w in 0..weeks {
            let target_date = today_local + Duration::days(days_until as i64 + w as i64 * 7);
            let naive_local = target_date.and_time(local_time);
            let utc_datetime = match offset.from_local_datetime(&naive_local).earliest() {
                Some(dt) => dt.with_timezone(&Utc),
                None => {
                    skipped += 1;
                    continue;
                }
            };

            if utc_datetime <= now {
                skipped += 1;
                continue;
            }

            let exists: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM sessions \
                 WHERE schedule_id = $1 \
                 AND status::text <> 'cancelled' \
                 AND (scheduled_at AT TIME ZONE 'UTC')::date = ($2::timestamptz AT TIME ZONE 'UTC')::date)",
            )
            .bind(schedule.id)
            .bind(utc_datetime)
            .fetch_one(&mut *tx)
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

            if exists {
                skipped += 1;
                continue;
            }

            if has_overlap_tx(
                tx.deref_mut(),
                schedule.room_id,
                utc_datetime,
                schedule.duration_minutes,
                None,
            )
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?
            {
                skipped += 1;
                continue;
            }

            let session_id: Uuid = sqlx::query_scalar(
                "INSERT INTO sessions (room_id, title, scheduled_at, duration_minutes, schedule_id) \
                 VALUES ($1, $2, $3, $4, $5) RETURNING id",
            )
            .bind(schedule.room_id)
            .bind(schedule.title.as_deref())
            .bind(utc_datetime)
            .bind(schedule.duration_minutes)
            .bind(schedule.id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

            sqlx::query(
                "INSERT INTO session_attendance (session_id, student_id, attended) \
                 SELECT $1, e.student_id, false FROM enrollments e WHERE e.room_id = $2 AND e.status = 'approved'",
            )
            .bind(session_id)
            .bind(schedule.room_id)
            .execute(&mut *tx)
            .await
            .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

            created_sessions.push(SessionIdTitle {
                id: session_id,
                scheduled_at: utc_datetime,
            });
            created += 1;
        }
    }

    tx.commit()
        .await
        .map_err(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error"))?;

    Ok(Json(GenerateResult {
        created,
        skipped,
        sessions: created_sessions,
    }))
}
