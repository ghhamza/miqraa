// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::UserResponse;
use crate::api::AppState;
use crate::auth::{jwt, password};

#[derive(Serialize)]
pub struct ApiMessage {
    pub message: &'static str,
    pub code: &'static str,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    let role = match req.role.as_str() {
        "student" | "teacher" => req.role.as_str(),
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    let email = req.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let hash = password::hash_password(&req.password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let user_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5::user_role)",
    )
    .bind(user_id)
    .bind(&req.name)
    .bind(&email)
    .bind(&hash)
    .bind(role)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::CONFLICT)?;

    let token = jwt::create_token(user_id, role, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = UserResponse {
        id: user_id,
        name: req.name,
        email,
        role: role.to_string(),
    };

    Ok(Json(AuthResponse { token, user }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    let email = req.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row: (Uuid, String, String, String, String) = sqlx::query_as(
        "SELECT id, name, email, password_hash, role::text FROM users WHERE lower(trim(email)) = $1",
    )
    .bind(&email)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    if !password::verify_password(&req.password, &row.3).unwrap_or(false) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = jwt::create_token(row.0, &row.4, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = UserResponse {
        id: row.0,
        name: row.1,
        email: row.2,
        role: row.4,
    };

    Ok(Json(AuthResponse { token, user }))
}

pub async fn me(auth: AuthenticatedUser) -> Json<UserResponse> {
    Json(UserResponse {
        id: auth.id,
        name: auth.name,
        email: auth.email,
        role: auth.role,
    })
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub name: String,
    pub email: String,
}

pub async fn update_profile(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>, StatusCode> {
    let name = req.name.trim();
    let email = req.email.trim().to_lowercase();
    if name.is_empty() || email.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let existing_lower = auth.email.trim().to_lowercase();
    if email != existing_lower {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM users WHERE lower(trim(email)) = $1 AND id <> $2)",
        )
        .bind(&email)
        .bind(auth.id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        if exists {
            return Err(StatusCode::CONFLICT);
        }
    }

    sqlx::query("UPDATE users SET name = $1, email = $2 WHERE id = $3")
        .bind(name)
        .bind(&email)
        .bind(auth.id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(UserResponse {
        id: auth.id,
        name: name.to_string(),
        email,
        role: auth.role,
    }))
}

#[derive(Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

pub async fn change_password(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<StatusCode, (StatusCode, Json<ApiMessage>)> {
    if req.new_password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "كلمة المرور قصيرة",
                code: "weak_password",
            }),
        ));
    }

    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(auth.id)
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

    if !password::verify_password(&req.current_password, &hash).unwrap_or(false) {
        // Use 400 (not 401) so the client does not clear the session / redirect to login.
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiMessage {
                message: "كلمة المرور الحالية غير صحيحة",
                code: "wrong_password",
            }),
        ));
    }

    let new_hash = password::hash_password(&req.new_password).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiMessage {
                message: "خطأ في الخادم",
                code: "server_error",
            }),
        )
    })?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(auth.id)
        .execute(&state.db)
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

    Ok(StatusCode::NO_CONTENT)
}
