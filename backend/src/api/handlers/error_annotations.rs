// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::QueryBuilder;
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::handlers::error_annotations_db::{
    CreateAnnotationInput, delete_annotation_row, fetch_annotation_for_delete, fetch_recitation_context,
    insert_annotation,
};
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
    #[serde(default = "default_kind")]
    pub annotation_kind: String,
}

fn default_kind() -> String {
    "error".to_string()
}

#[derive(Deserialize)]
pub struct ListAnnotationsQuery {
    pub recitation_id: Option<Uuid>,
    pub student_id: Option<Uuid>,
    pub surah: Option<i32>,
    pub severity: Option<String>,
    pub status: Option<String>,
    pub kind: Option<String>,
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

fn parse_annotation_kind(s: &str) -> Result<&str, StatusCode> {
    match s.trim() {
        "error" | "repeat" | "good" | "note" => Ok(s.trim()),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

fn parse_annotation_status(s: &str) -> Result<&str, StatusCode> {
    match s.trim() {
        "open" | "resolved" | "auto_resolved" => Ok(s.trim()),
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

/// List filters. When `summary_default_open` is true (annotation_summary only), rows with no
/// `status` query param are restricted to `open` so resolved items do not inflate error counts.
fn push_list_filters(
    qb: &mut QueryBuilder<'_, sqlx::Postgres>,
    params: &ListAnnotationsQuery,
    summary_default_open: bool,
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
    if let Some(ref st) = params.status {
        if parse_annotation_status(st).is_ok() {
            let st_trim = st.trim().to_string();
            qb.push(" AND e.status::text = ");
            qb.push_bind(st_trim);
        }
    } else if summary_default_open {
        qb.push(" AND e.status = 'open'::annotation_status");
    }
    if let Some(ref k) = params.kind {
        if parse_annotation_kind(k).is_ok() {
            let k_trim = k.trim().to_string();
            qb.push(" AND e.annotation_kind::text = ");
            qb.push_bind(k_trim);
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
    let kind_str = req.annotation_kind.trim();
    let kind_str = if kind_str.is_empty() {
        "error"
    } else {
        kind_str
    };
    let kind = parse_annotation_kind(kind_str)?;

    let ctx = fetch_recitation_context(&state.db, req.recitation_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let Some((row_teacher_id, _student_id, _session_id)) = ctx else {
        return Err(StatusCode::NOT_FOUND);
    };
    if auth.role == "teacher" {
        if let Some(tid) = row_teacher_id {
            if tid != auth.id {
                return Err(StatusCode::FORBIDDEN);
            }
        }
    }

    let input = CreateAnnotationInput {
        recitation_id: req.recitation_id,
        surah: req.surah,
        ayah: req.ayah,
        word_position: req.word_position,
        error_severity: sev.to_string(),
        error_category: cat.to_string(),
        teacher_comment: req.teacher_comment.clone(),
        annotation_kind: kind.to_string(),
    };
    let outcome = insert_annotation(&state.db, &input)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(outcome.annotation)))
}

pub async fn list_annotations(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListAnnotationsQuery>,
) -> Result<Json<Vec<ErrorAnnotationPublic>>, StatusCode> {
    let mut qb = QueryBuilder::new(
        "SELECT e.id, e.recitation_id, e.surah, e.ayah, e.word_position, \
         e.error_severity::text AS error_severity, e.error_category::text AS error_category, e.teacher_comment, \
         e.annotation_kind::text AS annotation_kind, e.status::text AS status, e.resolved_at, e.resolved_by, e.created_at \
         FROM error_annotations e \
         INNER JOIN recitations rec ON rec.id = e.recitation_id \
         WHERE 1=1",
    );
    push_annotation_scope(&mut qb, &auth)?;
    push_list_filters(&mut qb, &params, false);
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
    // Summary counts only actual errors (not repeat/good/note). Default status = open unless
    // `?status=` is passed — see push_list_filters(..., true).
    let mut qb = QueryBuilder::new(
        "SELECT \
         COUNT(*)::bigint AS total_errors, \
         COUNT(*) FILTER (WHERE e.error_severity = 'jali')::bigint AS jali_count, \
         COUNT(*) FILTER (WHERE e.error_severity = 'khafi')::bigint AS khafi_count \
         FROM error_annotations e \
         INNER JOIN recitations rec ON rec.id = e.recitation_id \
         WHERE 1=1 \
         AND e.annotation_kind = 'error'::annotation_kind",
    );
    push_annotation_scope(&mut qb, &auth)?;
    push_list_filters(&mut qb, &params, true);

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
         WHERE 1=1 \
         AND e.annotation_kind = 'error'::annotation_kind",
    );
    push_annotation_scope(&mut qb_cat, &auth)?;
    push_list_filters(&mut qb_cat, &params, true);
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
    let row = fetch_annotation_for_delete(&state.db, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let Some((_, teacher_id, _session_id)) = row else {
        return Err(StatusCode::NOT_FOUND);
    };
    if auth.role == "teacher" && Some(auth.id) != teacher_id {
        return Err(StatusCode::FORBIDDEN);
    }
    let n = delete_annotation_row(&state.db, id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if n == 0 {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(StatusCode::NO_CONTENT)
}
