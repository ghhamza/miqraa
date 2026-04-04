// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use uuid::Uuid;

use crate::api::AppState;
use crate::auth::jwt;

/// Authenticated user from `Authorization: Bearer <jwt>` + database lookup.
pub struct AuthenticatedUser {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
}

impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .ok_or(StatusCode::UNAUTHORIZED)?;
        let auth_str = auth_header.to_str().map_err(|_| StatusCode::UNAUTHORIZED)?;
        let token = auth_str
            .strip_prefix("Bearer ")
            .ok_or(StatusCode::UNAUTHORIZED)?;
        let claims = jwt::verify_token(token, &state.config.jwt_secret)
            .map_err(|_| StatusCode::UNAUTHORIZED)?;

        let row: (Uuid, String, String, String) = sqlx::query_as(
            "SELECT id, name, email, role::text FROM users WHERE id = $1",
        )
        .bind(claims.sub)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

        Ok(AuthenticatedUser {
            id: row.0,
            name: row.1,
            email: row.2,
            role: row.3,
        })
    }
}
