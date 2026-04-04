// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::QueryBuilder;
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::{UserPublic, UserStatsResponse};
use crate::api::AppState;
use crate::auth::password;

#[derive(Deserialize)]
pub struct ListUsersQuery {
    pub role: Option<String>,
    pub search: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct UpdateUserRequest {
    pub name: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
}

#[derive(Serialize)]
pub struct DeleteSelfError {
    pub message: &'static str,
}

fn require_admin(auth: &AuthenticatedUser) -> Result<(), StatusCode> {
    if auth.role != "admin" {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(())
}

fn validate_role_str(role: &str) -> Result<&str, StatusCode> {
    match role {
        "student" | "teacher" | "admin" => Ok(role),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

pub async fn stats(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<Json<UserStatsResponse>, StatusCode> {
    require_admin(&auth)?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM users")
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let students: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM users WHERE role = 'student'::user_role",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let teachers: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM users WHERE role = 'teacher'::user_role",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let admins: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM users WHERE role = 'admin'::user_role",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(UserStatsResponse {
        total,
        students,
        teachers,
        admins,
    }))
}

pub async fn list_users(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(params): Query<ListUsersQuery>,
) -> Result<Json<Vec<UserPublic>>, StatusCode> {
    require_admin(&auth)?;

    let mut qb = QueryBuilder::new(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE 1=1",
    );

    if let Some(r) = &params.role {
        let r = r.trim();
        if r == "student" || r == "teacher" || r == "admin" {
            // Compare as text: binding &str to `role = $1` fails (user_role vs text).
            qb.push(" AND role::text = ");
            qb.push_bind(r);
        }
    }

    if let Some(s) = &params.search {
        let t = s.trim();
        if !t.is_empty() {
            let pattern = format!("%{}%", t);
            qb.push(" AND (name ILIKE ");
            qb.push_bind(pattern.clone());
            qb.push(" OR email ILIKE ");
            qb.push_bind(pattern);
            qb.push(")");
        }
    }

    qb.push(" ORDER BY created_at DESC");

    let users = qb
        .build_query_as::<UserPublic>()
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(users))
}

pub async fn get_user(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<UserPublic>, StatusCode> {
    require_admin(&auth)?;

    let user = sqlx::query_as::<_, UserPublic>(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(user))
}

pub async fn create_user(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<UserPublic>, StatusCode> {
    require_admin(&auth)?;

    let role = validate_role_str(&req.role)?;
    let email = req.email.trim().to_lowercase();
    if email.is_empty() || req.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let hash = password::hash_password(&req.password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5::user_role)",
    )
    .bind(id)
    .bind(req.name.trim())
    .bind(&email)
    .bind(&hash)
    .bind(role)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if let Some(db) = e.as_database_error() {
            if db.code().as_deref() == Some("23505") {
                return StatusCode::CONFLICT;
            }
        }
        tracing::error!(error = ?e, "create_user insert failed");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let user = sqlx::query_as::<_, UserPublic>(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(user))
}

pub async fn update_user(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateUserRequest>,
) -> Result<Json<UserPublic>, StatusCode> {
    require_admin(&auth)?;

    let existing = sqlx::query_as::<_, UserPublic>(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if req.name.is_none() && req.email.is_none() && req.role.is_none() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let name = req.name.map(|n| n.trim().to_string()).unwrap_or(existing.name.clone());
    let email = req
        .email
        .map(|e| e.trim().to_lowercase())
        .unwrap_or(existing.email.clone());
    let role_str = if let Some(r) = &req.role {
        validate_role_str(r)?.to_string()
    } else {
        existing.role.clone()
    };

    if name.is_empty() || email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if email != existing.email {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE lower(trim(email)) = $1 AND id <> $2)",
        )
        .bind(&email)
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if exists {
            return Err(StatusCode::CONFLICT);
        }
    }

    sqlx::query(
        "UPDATE users SET name = $1, email = $2, role = $3::user_role WHERE id = $4",
    )
    .bind(&name)
    .bind(&email)
    .bind(&role_str)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let updated = sqlx::query_as::<_, UserPublic>(
        "SELECT id, name, email, role::text AS role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(updated))
}

pub async fn delete_user(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<DeleteSelfError>)> {
    require_admin(&auth).map_err(|_| {
        (
            StatusCode::FORBIDDEN,
            Json(DeleteSelfError {
                message: "غير مصرح",
            }),
        )
    })?;

    if id == auth.id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(DeleteSelfError {
                message: "لا يمكنك حذف حسابك",
            }),
        ));
    }

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(DeleteSelfError { message: "خطأ في الخادم" })))?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(DeleteSelfError {
                message: "غير موجود",
            }),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
