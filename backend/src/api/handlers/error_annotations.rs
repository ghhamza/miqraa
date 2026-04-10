// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::{Postgres, QueryBuilder};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{CategoryCount, ErrorAnnotationPublic, ErrorSummary};
use crate::api::AppState;

#[derive(Deserialize)]
pub struct CreateAnnotationRequest {
    pub recitation_id: Uuid,
    pub surah: i32,
    pub ayah: i32,
    pub word_position: Option<i32>,
    pub error_severity: String,
    pub error_category: String,
    pub teacher_comment: Option<String>,
}

#[derive(Deserialize)]
pub struct ListAnnotationsQuery {
    pub recitation_id: Option<Uuid>,
    pub student_id: Option<Uuid>,
    pub surah: Option<i32>,
    pub severity: Option<String>,
}


fn require_teacher_or_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    match auth.role.as_str() {
        "teacher" | "admin" => Ok(()),
        _ => Err(StatusCode::FORBIDDEN),
    }
}

fn parse_error_severity(s: &str) -> Result<&str, StatusCode> {
    match s.trim() {
        "jali" | "khafi" => Ok(s.trim()),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

fn parse_error_category(s: &str) -> Result<&str, StatusCode> {
    match s.trim() {
        "harf" | "haraka" | "kalima" | "waqf_qabih" | "makharij" | "sifat" | "tafkhim" | "madd"
        | "ghunnah" | "noon_sakin" | "meem_sakin" | "waqf_ibtida" | "shadda" | "other" => Ok(s.trim()),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

fn push_annotation_scope(
    qb: &mut QueryBuilder<'_, sqlx::Postgres>,
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

fn push_list_filters<'a>(
    qb: &mut QueryBuilder<'a, sqlx::Postgres>,
    params: &'a ListAnnotationsQuery,
) {
    if let Some(rid) = params.recitation_id {
        qb.push(" AND e.recitation_id = ");
        qb.push_bind(rid);
    }
    if let Some(sid) = params.student_id {
        qb.push(" AND rec.student_id = ");
        qb.push_bind(sid);
    }
    if let Some(s) = params.surah {
        qb.push(" AND e.surah = ");
        qb.push_bind(s);
    }
    if let Some(ref sev) = params.severity {
        if parse_error_severity(sev).is_ok() {
            let sev_trim = sev.trim().to_string();
            qb.push(" AND e.error_severity::text = ");
            qb.push_bind(sev_trim);
        }
    }
}


pub async fn create_annotation(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateAnnotationRequest>,
) -> Result<(StatusCode, Json<ErrorAnnotationPublic>), StatusCode> {
    require_teacher_or_admin(&auth)?;
    let sev = parse_error_severity(&req.error_severity)?;
    let cat = parse_error_category(&req.error_category)?;

    let row: Option<(Option<Uuid>, Option<Uuid>)> = sqlx::query_as(
        "SELECT teacher_id, student_id FROM recitations WHERE id = $1",
    )
    .bind(req.recitation_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let Some((teacher_id, _student_id)) = row else {
        return Err(StatusCode::NOT_FOUND);
    };
    if auth.role == "teacher" && Some(auth.id) != teacher_id {
        return Err(StatusCode::FORBIDDEN);
    }

    let created: ErrorAnnotationPublic = sqlx::query_as::<Postgres, ErrorAnnotationPublic>(
        "INSERT INTO error_annotations \
         (recitation_id, surah, ayah, word_position, error_severity, error_category, teacher_comment) \
         VALUES ($1, $2, $3, $4, $5::error_severity, $6::error_category, $7) \
         RETURNING id, recitation_id, surah, ayah, word_position, error_severity::text AS error_severity, error_category::text AS error_category, teacher_comment, created_at",
    )
    .bind(req.recitation_id)
    .bind(req.surah)
    .bind(req.ayah)
    .bind(req.word_position)
    .bind(sev)
    .bind(cat)
    .bind(req.teacher_comment.as_ref())
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(created)))
}

pub async fn list_annotations(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListAnnotationsQuery>,
) -> Result<Json<Vec<ErrorAnnotationPublic>>, StatusCode> {
    let mut qb = QueryBuilder::new(
        "SELECT e.id, e.recitation_id, e.surah, e.ayah, e.word_position, e.error_severity::text AS error_severity, e.error_category::text AS error_category, e.teacher_comment, e.created_at \
         FROM error_annotations e \
         INNER JOIN recitations rec ON rec.id = e.recitation_id \
         WHERE 1=1",
    );
    push_annotation_scope(&mut qb, &auth)?;
    push_list_filters(&mut qb, &params);
    qb.push(" ORDER BY e.created_at DESC");
    let rows = qb
        .build_query_as::<ErrorAnnotationPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(rows))
}

pub async fn annotation_summary(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListAnnotationsQuery>,
) -> Result<Json<ErrorSummary>, StatusCode> {
    let mut qb = QueryBuilder::new(
        "SELECT \
         COUNT(*)::bigint AS total_errors, \
         COUNT(*) FILTER (WHERE e.error_severity = 'jali')::bigint AS jali_count, \
         COUNT(*) FILTER (WHERE e.error_severity = 'khafi')::bigint AS khafi_count \
         FROM error_annotations e \
         INNER JOIN recitations rec ON rec.id = e.recitation_id \
         WHERE 1=1",
    );
    push_annotation_scope(&mut qb, &auth)?;
    push_list_filters(&mut qb, &params);

    #[derive(sqlx::FromRow)]
    struct Totals {
        total_errors: i64,
        jali_count: i64,
        khafi_count: i64,
    }
    let totals: Totals = qb
        .build_query_as::<Totals>()
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut qb_cat = QueryBuilder::new(
        "SELECT e.error_category::text AS category, COUNT(*)::bigint AS count \
         FROM error_annotations e \
         INNER JOIN recitations rec ON rec.id = e.recitation_id \
         WHERE 1=1",
    );
    push_annotation_scope(&mut qb_cat, &auth)?;
    push_list_filters(&mut qb_cat, &params);
    qb_cat.push(" GROUP BY e.error_category ORDER BY count DESC");

    let by_category: Vec<CategoryCount> = qb_cat
        .build_query_as::<CategoryCount>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ErrorSummary {
        total_errors: totals.total_errors,
        jali_count: totals.jali_count,
        khafi_count: totals.khafi_count,
        by_category,
    }))
}

pub async fn delete_annotation(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    require_teacher_or_admin(&auth)?;
    let row: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
        "SELECT e.id, rec.teacher_id FROM error_annotations e \
         INNER JOIN recitations rec ON rec.id = e.recitation_id \
         WHERE e.id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let Some((_, teacher_id)) = row else {
        return Err(StatusCode::NOT_FOUND);
    };
    if auth.role == "teacher" && Some(auth.id) != teacher_id {
        return Err(StatusCode::FORBIDDEN);
    }
    let r = sqlx::query("DELETE FROM error_annotations WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if r.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(StatusCode::NO_CONTENT)
}
