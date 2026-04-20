// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::AppState;
use crate::media::{LivekitClient, SessionRole};

#[derive(Debug, Deserialize)]
pub struct TokenRequest {
    pub session_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub ws_url: String,
    pub room: String,
    pub identity: String,
}

struct SessionAccessRow {
    id: Uuid,
    room_id: Uuid,
    teacher_id: Uuid,
}

/// POST /api/livekit/token
pub async fn mint_token(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Json(req): Json<TokenRequest>,
) -> Result<Json<TokenResponse>, StatusCode> {
    let session = sqlx::query_as::<_, (Uuid, Uuid, Uuid)>(
        "SELECT s.id, s.room_id, r.teacher_id \
         FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE s.id = $1 AND s.status::text = 'in_progress'",
    )
    .bind(req.session_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map(|(id, room_id, teacher_id)| SessionAccessRow { id, room_id, teacher_id })
    .ok_or(StatusCode::NOT_FOUND)?;

    let session_role = determine_session_role(&state, &user, &session).await?;

    let token = state
        .livekit
        .mint_token(req.session_id, user.id, &user.name, session_role)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let room = LivekitClient::room_name_for_session(req.session_id);

    Ok(Json(TokenResponse {
        token,
        ws_url: state.livekit.ws_url().to_string(),
        room,
        identity: user.id.to_string(),
    }))
}

async fn determine_session_role(
    state: &AppState,
    user: &AuthenticatedUser,
    session: &SessionAccessRow,
) -> Result<SessionRole, StatusCode> {
    if user.role == "admin" {
        return Ok(SessionRole::Admin);
    }

    if session.teacher_id == user.id {
        return Ok(SessionRole::Teacher);
    }

    let enrolled: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM enrollments
            WHERE room_id = $1 AND student_id = $2 AND status = 'approved'
        )",
    )
    .bind(session.room_id)
    .bind(user.id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !enrolled {
        return Err(StatusCode::FORBIDDEN);
    }

    let is_active = state.rooms.is_active_reciter(session.id, user.id).await;

    Ok(if is_active {
        SessionRole::ActiveReciter
    } else {
        SessionRole::Student
    })
}
