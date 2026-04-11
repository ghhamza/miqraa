// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use sqlx::{PgPool, Postgres};
use uuid::Uuid;

use crate::api::types::ErrorAnnotationPublic;

pub struct CreateAnnotationInput {
    pub recitation_id: Uuid,
    pub surah: i32,
    pub ayah: i32,
    pub word_position: Option<i32>,
    pub error_severity: String,
    pub error_category: String,
    pub teacher_comment: Option<String>,
    pub annotation_kind: String,
}

/// Fetch `(teacher_id, student_id, session_id)` for a recitation.
/// Returns `None` if recitation doesn't exist.
pub async fn fetch_recitation_context(
    db: &PgPool,
    recitation_id: Uuid,
) -> Result<Option<(Option<Uuid>, Option<Uuid>, Option<Uuid>)>, sqlx::Error> {
    sqlx::query_as::<Postgres, (Option<Uuid>, Option<Uuid>, Option<Uuid>)>(
        "SELECT teacher_id, student_id, session_id FROM recitations WHERE id = $1",
    )
    .bind(recitation_id)
    .fetch_optional(db)
    .await
}

/// Result of inserting one annotation: any prior **open** annotations on the same word are removed first.
pub struct InsertAnnotationOutcome {
    pub deleted_ids: Vec<Uuid>,
    pub annotation: ErrorAnnotationPublic,
}

/// Inserts an annotation after deleting any existing open annotations on the same word
/// (same recitation, surah, ayah, word_position). The new mark replaces the previous one.
pub async fn insert_annotation(
    db: &PgPool,
    input: &CreateAnnotationInput,
) -> Result<InsertAnnotationOutcome, sqlx::Error> {
    let mut tx = db.begin().await?;

    let deleted_ids: Vec<Uuid> = sqlx::query_scalar(
        "DELETE FROM error_annotations \
         WHERE recitation_id = $1 AND surah = $2 AND ayah = $3 \
         AND word_position IS NOT DISTINCT FROM $4 \
         AND status = 'open'::annotation_status \
         RETURNING id",
    )
    .bind(input.recitation_id)
    .bind(input.surah)
    .bind(input.ayah)
    .bind(input.word_position)
    .fetch_all(&mut *tx)
    .await?;

    let annotation = sqlx::query_as::<Postgres, ErrorAnnotationPublic>(
        "INSERT INTO error_annotations \
         (recitation_id, surah, ayah, word_position, error_severity, error_category, teacher_comment, annotation_kind) \
         VALUES ($1, $2, $3, $4, $5::error_severity, $6::error_category, $7, $8::annotation_kind) \
         RETURNING id, recitation_id, surah, ayah, word_position, \
           error_severity::text AS error_severity, \
           error_category::text AS error_category, \
           teacher_comment, \
           annotation_kind::text AS annotation_kind, \
           status::text AS status, \
           resolved_at, resolved_by, \
           created_at",
    )
    .bind(input.recitation_id)
    .bind(input.surah)
    .bind(input.ayah)
    .bind(input.word_position)
    .bind(&input.error_severity)
    .bind(&input.error_category)
    .bind(input.teacher_comment.as_ref())
    .bind(&input.annotation_kind)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(InsertAnnotationOutcome {
        deleted_ids,
        annotation,
    })
}

/// Returns `(annotation_id, teacher_id, session_id)` if found.
pub async fn fetch_annotation_for_delete(
    db: &PgPool,
    annotation_id: Uuid,
) -> Result<Option<(Uuid, Option<Uuid>, Option<Uuid>)>, sqlx::Error> {
    sqlx::query_as::<Postgres, (Uuid, Option<Uuid>, Option<Uuid>)>(
        "SELECT e.id, rec.teacher_id, rec.session_id \
         FROM error_annotations e \
         INNER JOIN recitations rec ON rec.id = e.recitation_id \
         WHERE e.id = $1",
    )
    .bind(annotation_id)
    .fetch_optional(db)
    .await
}

pub async fn delete_annotation_row(db: &PgPool, annotation_id: Uuid) -> Result<u64, sqlx::Error> {
    let r = sqlx::query("DELETE FROM error_annotations WHERE id = $1")
        .bind(annotation_id)
        .execute(db)
        .await?;
    Ok(r.rows_affected())
}
