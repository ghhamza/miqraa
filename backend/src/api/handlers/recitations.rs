// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use sqlx::{PgPool, Postgres, QueryBuilder};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::riwaya::parse_riwaya;
use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{
    GradeCounts, Paginated, RecitationPublic, RecitationStatsResponse, StudentProgressResponse, SurahBestGrade,
    SurahCount,
};
use crate::api::AppState;

#[derive(Deserialize)]
pub struct ListRecitationsQuery {
    pub student_id: Option<Uuid>,
    pub room_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    pub surah: Option<i32>,
    pub grade: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    /// Optional max rows (1–100), applied after ordering by `created_at DESC`.
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub riwaya: Option<String>,
    pub turn_type: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateRecitationRequest {
    pub student_id: Uuid,
    pub room_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    pub surah: i32,
    pub ayah_start: i32,
    pub ayah_end: i32,
    pub grade: Option<String>,
    pub teacher_notes: Option<String>,
    pub riwaya: Option<String>,
    pub turn_type: Option<String>,
    pub pages_count: Option<f64>,
    pub star_rating: Option<i16>,
}

#[derive(Deserialize)]
pub struct UpdateRecitationRequest {
    pub surah: Option<i32>,
    pub ayah_start: Option<i32>,
    pub ayah_end: Option<i32>,
    pub grade: Option<String>,
    pub teacher_notes: Option<String>,
    pub turn_type: Option<String>,
    pub pages_count: Option<f64>,
    pub star_rating: Option<i16>,
}

fn apply_list_role_scope(
    qb: &mut QueryBuilder<'_, Postgres>,
    auth: &AuthenticatedUser,
) -> Result<(), StatusCode> {
    match auth.role.as_str() {
        "admin" => Ok(()),
        "teacher" => {
            qb.push(" AND rec.teacher_id = ");
            qb.push_bind(auth.id);
            Ok(())
        }
        "student" => {
            qb.push(" AND rec.student_id = ");
            qb.push_bind(auth.id);
            Ok(())
        }
        _ => Err(StatusCode::FORBIDDEN),
    }
}

async fn fetch_recitation_public(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<RecitationPublic>, StatusCode> {
    let row: Option<RecitationPublic> = sqlx::query_as::<Postgres, RecitationPublic>(
        "SELECT rec.id, rec.student_id, u.name AS student_name, rec.room_id, rm.name AS room_name, \
         rec.session_id, rec.surah, rec.ayah_start, rec.ayah_end, rec.grade::text AS grade, \
         rec.teacher_notes, rec.teacher_id, t.name AS teacher_name, rec.recording_path, rec.created_at, \
         rec.riwaya, rec.turn_type::text AS turn_type, rec.pages_count, rec.star_rating \
         FROM recitations rec \
         LEFT JOIN users u ON u.id = rec.student_id \
         LEFT JOIN rooms rm ON rm.id = rec.room_id \
         LEFT JOIN users t ON t.id = rec.teacher_id \
         WHERE rec.id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(row)
}

fn can_view_recitation(auth: &AuthenticatedUser, rec: &RecitationPublic) -> bool {
    if auth.role == "admin" {
        return true;
    }
    if auth.role == "student" {
        return rec.student_id == Some(auth.id);
    }
    if auth.role == "teacher" {
        return Some(auth.id) == rec.teacher_id;
    }
    false
}

async fn can_access_student(
    pool: &PgPool,
    auth: &AuthenticatedUser,
    student_id: Uuid,
) -> Result<bool, StatusCode> {
    if auth.role == "admin" {
        return Ok(true);
    }
    if auth.id == student_id && auth.role == "student" {
        return Ok(true);
    }
    if auth.role == "teacher" {
        let ok: bool = sqlx::query_scalar(
            "SELECT EXISTS (
                SELECT 1 FROM enrollments e
                INNER JOIN rooms r ON r.id = e.room_id
                WHERE e.student_id = $1 AND r.teacher_id = $2 AND e.status = 'approved'
            )",
        )
        .bind(student_id)
        .bind(auth.id)
        .fetch_one(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok(ok);
    }
    Ok(false)
}

fn parse_turn_type(s: &str) -> Result<&str, StatusCode> {
    match s.trim() {
        "dars" | "tathbit" | "muraja" => Ok(s.trim()),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

fn validate_star_rating(r: i16) -> Result<i16, StatusCode> {
    if (1..=5).contains(&r) {
        Ok(r)
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

fn parse_grade(s: &str) -> Option<&'static str> {
    match s.trim() {
        "excellent" => Some("excellent"),
        "good" => Some("good"),
        "needs_work" => Some("needs_work"),
        "weak" => Some("weak"),
        _ => None,
    }
}

fn grade_rank(g: &str) -> i32 {
    match g {
        "excellent" => 4,
        "good" => 3,
        "needs_work" => 2,
        "weak" => 1,
        _ => 0,
    }
}

fn compute_streak(dates: &HashSet<NaiveDate>, today: NaiveDate) -> i32 {
    if !dates.contains(&today) {
        return 0;
    }
    let mut streak = 1;
    let mut d = today;
    loop {
        d = match d.pred_opt() {
            Some(x) => x,
            None => break,
        };
        if dates.contains(&d) {
            streak += 1;
        } else {
            break;
        }
    }
    streak
}

fn push_recitation_list_filters<'a>(
    qb: &mut QueryBuilder<'a, Postgres>,
    auth: &'a AuthenticatedUser,
    params: &'a ListRecitationsQuery,
) -> Result<(), StatusCode> {
    apply_list_role_scope(qb, auth)?;
    if let Some(filter_sid) = params.student_id {
        qb.push(" AND rec.student_id = ");
        qb.push_bind(filter_sid);
    }
    if let Some(rid) = params.room_id {
        qb.push(" AND rec.room_id = ");
        qb.push_bind(rid);
    }
    if let Some(ses) = params.session_id {
        qb.push(" AND rec.session_id = ");
        qb.push_bind(ses);
    }
    if let Some(s) = params.surah {
        qb.push(" AND rec.surah = ");
        qb.push_bind(s);
    }
    if let Some(ref g) = params.grade {
        let t = g.trim();
        if parse_grade(t).is_some() {
            qb.push(" AND rec.grade::text = ");
            qb.push_bind(t);
        }
    }
    if let Some(from) = params.from {
        qb.push(" AND rec.created_at >= ");
        qb.push_bind(from);
    }
    if let Some(to) = params.to {
        qb.push(" AND rec.created_at <= ");
        qb.push_bind(to);
    }
    if let Some(ref rw) = params.riwaya {
        if let Some(r) = parse_riwaya(rw) {
            qb.push(" AND rec.riwaya = ");
            qb.push_bind(r);
        }
    }
    if let Some(ref tt) = params.turn_type {
        if parse_turn_type(tt).is_ok() {
            qb.push(" AND rec.turn_type::text = ");
            qb.push_bind(tt.trim());
        }
    }
    Ok(())
}

pub async fn list_recitations(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListRecitationsQuery>,
) -> Result<Json<Paginated<RecitationPublic>>, StatusCode> {
    if let Some(sid) = params.student_id {
        if auth.role == "student" && sid != auth.id {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let limit = params.limit.unwrap_or(50).clamp(1, 100);
    let offset = params.offset.unwrap_or(0).max(0);

    let mut qb_count = QueryBuilder::new("SELECT COUNT(*)::bigint FROM recitations rec WHERE 1=1");
    push_recitation_list_filters(&mut qb_count, &auth, &params)?;
    let total: i64 = qb_count
        .build_query_scalar()
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut qb = QueryBuilder::new(
        "SELECT rec.id, rec.student_id, u.name AS student_name, rec.room_id, rm.name AS room_name, \
         rec.session_id, rec.surah, rec.ayah_start, rec.ayah_end, rec.grade::text AS grade, \
         rec.teacher_notes, rec.teacher_id, t.name AS teacher_name, rec.recording_path, rec.created_at, \
         rec.riwaya, rec.turn_type::text AS turn_type, rec.pages_count, rec.star_rating \
         FROM recitations rec \
         LEFT JOIN users u ON u.id = rec.student_id \
         LEFT JOIN rooms rm ON rm.id = rec.room_id \
         LEFT JOIN users t ON t.id = rec.teacher_id \
         WHERE 1=1",
    );
    push_recitation_list_filters(&mut qb, &auth, &params)?;
    qb.push(" ORDER BY rec.created_at DESC");
    qb.push(" LIMIT ");
    qb.push_bind(limit);
    qb.push(" OFFSET ");
    qb.push_bind(offset);
    let rows = qb
        .build_query_as::<RecitationPublic>()
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

pub async fn get_recitation(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<RecitationPublic>, StatusCode> {
    let rec = fetch_recitation_public(&state.db, id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !can_view_recitation(&auth, &rec) {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(Json(rec))
}

pub async fn create_recitation(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateRecitationRequest>,
) -> Result<(StatusCode, Json<RecitationPublic>), StatusCode> {
    if auth.role != "teacher" && auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    if req.surah < 1 || req.surah > 114 {
        return Err(StatusCode::BAD_REQUEST);
    }
    if req.ayah_start < 1 || req.ayah_start > req.ayah_end {
        return Err(StatusCode::BAD_REQUEST);
    }
    let student_role: Option<String> = sqlx::query_scalar("SELECT role::text FROM users WHERE id = $1")
        .bind(req.student_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if student_role.as_deref() != Some("student") {
        return Err(StatusCode::BAD_REQUEST);
    }
    let mut room_id = req.room_id;
    let session_id = req.session_id;
    if let Some(sid) = session_id {
        let row: Option<(Uuid, Uuid)> = sqlx::query_as("SELECT id, room_id FROM sessions WHERE id = $1")
            .bind(sid)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let (_, sess_room) = row.ok_or(StatusCode::NOT_FOUND)?;
        if let Some(rid) = room_id {
            if rid != sess_room {
                return Err(StatusCode::BAD_REQUEST);
            }
        } else {
            room_id = Some(sess_room);
        }
    }
    if let Some(rid) = room_id {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1)")
            .bind(rid)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if !exists {
            return Err(StatusCode::NOT_FOUND);
        }
    }

    let rec_riwaya: String = if let Some(ref r) = req.riwaya {
        parse_riwaya(r).ok_or(StatusCode::BAD_REQUEST)?.to_string()
    } else if let Some(rid) = room_id {
        sqlx::query_scalar::<_, String>("SELECT riwaya::text FROM rooms WHERE id = $1")
            .bind(rid)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .unwrap_or_else(|| "hafs".to_string())
    } else {
        "hafs".to_string()
    };

    let grade_sql: Option<&str> = req.grade.as_ref().and_then(|s| parse_grade(s));
    let turn_type = req.turn_type.as_deref().unwrap_or("dars");
    parse_turn_type(turn_type)?;
    let star_rating = match req.star_rating {
        None => None,
        Some(r) => Some(validate_star_rating(r)?),
    };
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO recitations \
         (student_id, room_id, session_id, surah, ayah_start, ayah_end, grade, teacher_notes, teacher_id, riwaya, turn_type, pages_count, star_rating) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::turn_type, $12, $13) \
         RETURNING id",
    )
    .bind(req.student_id)
    .bind(room_id)
    .bind(session_id)
    .bind(req.surah)
    .bind(req.ayah_start)
    .bind(req.ayah_end)
    .bind(grade_sql)
    .bind(req.teacher_notes.as_ref())
    .bind(auth.id)
    .bind(&rec_riwaya)
    .bind(turn_type)
    .bind(req.pages_count)
    .bind(star_rating)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let rec = fetch_recitation_public(&state.db, id)
        .await?
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok((StatusCode::CREATED, Json(rec)))
}

fn can_edit_recitation(auth: &AuthenticatedUser, rec: &RecitationPublic) -> bool {
    if auth.role == "admin" {
        return true;
    }
    auth.role == "teacher" && Some(auth.id) == rec.teacher_id
}

pub async fn update_recitation(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateRecitationRequest>,
) -> Result<Json<RecitationPublic>, StatusCode> {
    let existing = fetch_recitation_public(&state.db, id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !can_edit_recitation(&auth, &existing) {
        return Err(StatusCode::FORBIDDEN);
    }
    let surah = req.surah.unwrap_or(existing.surah);
    let ayah_start = req.ayah_start.unwrap_or(existing.ayah_start);
    let ayah_end = req.ayah_end.unwrap_or(existing.ayah_end);
    if !(1..=114).contains(&surah) || ayah_start < 1 || ayah_start > ayah_end {
        return Err(StatusCode::BAD_REQUEST);
    }
    let grade_val: Option<&str> = match &req.grade {
        None => existing.grade.as_deref().and_then(parse_grade),
        Some(s) => parse_grade(s),
    };
    let notes_val = req.teacher_notes.clone().or(existing.teacher_notes.clone());
    let turn_type = match req.turn_type.as_deref() {
        Some(s) => parse_turn_type(s)?.to_string(),
        None => existing.turn_type.clone(),
    };
    let pages_count = req.pages_count.or(existing.pages_count);
    let star_rating = match req.star_rating {
        None => existing.star_rating,
        Some(r) => Some(validate_star_rating(r)?),
    };
    sqlx::query(
        "UPDATE recitations SET surah = $1, ayah_start = $2, ayah_end = $3, grade = $4, teacher_notes = $5, \
         turn_type = $6::turn_type, pages_count = $7, star_rating = $8 WHERE id = $9",
    )
    .bind(surah)
    .bind(ayah_start)
    .bind(ayah_end)
    .bind(grade_val)
    .bind(notes_val.as_ref())
    .bind(&turn_type)
    .bind(pages_count)
    .bind(star_rating)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let updated = fetch_recitation_public(&state.db, id)
        .await?
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(updated))
}

pub async fn delete_recitation(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let existing = fetch_recitation_public(&state.db, id)
        .await?
        .ok_or(StatusCode::NOT_FOUND)?;
    if !can_edit_recitation(&auth, &existing) {
        return Err(StatusCode::FORBIDDEN);
    }
    sqlx::query("DELETE FROM recitations WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn top_surahs(
    pool: &PgPool,
    teacher_id: Option<Uuid>,
    student_id: Option<Uuid>,
) -> Result<Vec<SurahCount>, StatusCode> {
    let mut qb = QueryBuilder::new("SELECT surah, COUNT(*)::bigint AS count FROM recitations");
    if let Some(t) = teacher_id {
        qb.push(" WHERE teacher_id = ");
        qb.push_bind(t);
    } else if let Some(s) = student_id {
        qb.push(" WHERE student_id = ");
        qb.push_bind(s);
    }
    qb.push(" GROUP BY surah ORDER BY COUNT(*) DESC LIMIT 10");
    let rows: Vec<(i32, i64)> = qb
        .build_query_as::<(i32, i64)>()
        .fetch_all(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(rows
        .into_iter()
        .map(|(surah, count)| SurahCount { surah, count })
        .collect())
}

pub async fn stats(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<RecitationStatsResponse>, StatusCode> {
    let (total, excellent, good, needs_work, weak, recent_count): (i64, i64, i64, i64, i64, i64) =
        match auth.role.as_str() {
            "admin" => sqlx::query_as(
                "SELECT \
                 COUNT(*)::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'excellent')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'good')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'needs_work')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'weak')::bigint, \
                 COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint \
                 FROM recitations",
            )
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
            "teacher" => sqlx::query_as(
                "SELECT \
                 COUNT(*)::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'excellent')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'good')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'needs_work')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'weak')::bigint, \
                 COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint \
                 FROM recitations WHERE teacher_id = $1",
            )
            .bind(auth.id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
            "student" => sqlx::query_as(
                "SELECT \
                 COUNT(*)::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'excellent')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'good')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'needs_work')::bigint, \
                 COUNT(*) FILTER (WHERE grade = 'weak')::bigint, \
                 COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint \
                 FROM recitations WHERE student_id = $1",
            )
            .bind(auth.id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
            _ => return Err(StatusCode::FORBIDDEN),
        };
    let by_surah = top_surahs(
        &state.db,
        if auth.role == "teacher" {
            Some(auth.id)
        } else {
            None
        },
        if auth.role == "student" {
            Some(auth.id)
        } else {
            None
        },
    )
    .await?;
    Ok(Json(RecitationStatsResponse {
        total,
        by_grade: GradeCounts {
            excellent,
            good,
            needs_work,
            weak,
        },
        by_surah,
        recent_count,
    }))
}

pub async fn list_by_student(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<Vec<RecitationPublic>>, StatusCode> {
    if !can_access_student(&state.db, &auth, student_id).await? {
        return Err(StatusCode::FORBIDDEN);
    }
    let mut qb = QueryBuilder::new(
        "SELECT rec.id, rec.student_id, u.name AS student_name, rec.room_id, rm.name AS room_name, \
         rec.session_id, rec.surah, rec.ayah_start, rec.ayah_end, rec.grade::text AS grade, \
         rec.teacher_notes, rec.teacher_id, t.name AS teacher_name, rec.recording_path, rec.created_at, \
         rec.riwaya, rec.turn_type::text AS turn_type, rec.pages_count, rec.star_rating \
         FROM recitations rec \
         LEFT JOIN users u ON u.id = rec.student_id \
         LEFT JOIN rooms rm ON rm.id = rec.room_id \
         LEFT JOIN users t ON t.id = rec.teacher_id \
         WHERE rec.student_id = ",
    );
    qb.push_bind(student_id);
    qb.push(" ORDER BY rec.created_at DESC");
    let rows = qb
        .build_query_as::<RecitationPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(rows))
}

pub async fn student_progress(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(student_id): Path<Uuid>,
) -> Result<Json<StudentProgressResponse>, StatusCode> {
    if !can_access_student(&state.db, &auth, student_id).await? {
        return Err(StatusCode::FORBIDDEN);
    }
    let student_name: String = sqlx::query_scalar("SELECT name FROM users WHERE id = $1")
        .bind(student_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let total_recitations: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM recitations WHERE student_id = $1")
            .bind(student_id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let rows: Vec<(i32, Option<String>)> = sqlx::query_as(
        "SELECT surah, grade::text FROM recitations WHERE student_id = $1",
    )
    .bind(student_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut surahs: HashSet<i32> = HashSet::new();
    let mut best: HashMap<i32, String> = HashMap::new();
    for (surah, grade_opt) in rows {
        surahs.insert(surah);
        if let Some(g) = grade_opt.as_ref().and_then(|s| parse_grade(s)) {
            best.entry(surah)
                .and_modify(|e| {
                    if grade_rank(g) > grade_rank(e.as_str()) {
                        *e = g.to_string();
                    }
                })
                .or_insert_with(|| g.to_string());
        }
    }
    let mut surahs_covered: Vec<i32> = surahs.into_iter().collect();
    surahs_covered.sort_unstable();
    let surah_best_grades: Vec<SurahBestGrade> = surahs_covered
        .iter()
        .map(|s| SurahBestGrade {
            surah: *s,
            best_grade: best.get(s).cloned(),
        })
        .collect();
    let (ex, g, nw, w): (i64, i64, i64, i64) = sqlx::query_as(
        "SELECT \
         COUNT(*) FILTER (WHERE grade = 'excellent')::bigint, \
         COUNT(*) FILTER (WHERE grade = 'good')::bigint, \
         COUNT(*) FILTER (WHERE grade = 'needs_work')::bigint, \
         COUNT(*) FILTER (WHERE grade = 'weak')::bigint \
         FROM recitations WHERE student_id = $1",
    )
    .bind(student_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let recent_recitations: i64 =
        sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM recitations WHERE student_id = $1 AND created_at >= NOW() - INTERVAL '7 days'",
        )
        .bind(student_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let last_recitation_date: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT MAX(created_at) FROM recitations WHERE student_id = $1",
    )
    .bind(student_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let date_rows: Vec<NaiveDate> = sqlx::query_scalar(
        "SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date FROM recitations WHERE student_id = $1",
    )
    .bind(student_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let set: HashSet<NaiveDate> = date_rows.into_iter().collect();
    let today = Utc::now().date_naive();
    let streak_days = compute_streak(&set, today);
    Ok(Json(StudentProgressResponse {
        student_name,
        total_recitations,
        surahs_covered,
        surah_best_grades,
        grade_distribution: GradeCounts {
            excellent: ex,
            good: g,
            needs_work: nw,
            weak: w,
        },
        recent_recitations,
        last_recitation_date,
        streak_days,
    }))
}
