// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::extract::{Query, State};
use axum::http::header::AUTHORIZATION;
use axum::http::StatusCode;
use axum::http::HeaderMap;
use axum::Json;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::api::extractors::AuthenticatedUser;
use crate::api::types::UserResponse;
use crate::api::AppState;
use crate::auth::{jwt, password};
use crate::qf::{oauth, pkce};

const QF_LOGIN_SCOPES: &str = "openid offline_access reading_session streak user";

#[derive(Serialize)]
pub struct QfErrorBody {
    pub code: &'static str,
    pub message: String,
}

type QfResult<T> = Result<T, (StatusCode, Json<QfErrorBody>)>;

fn qf_err(status: StatusCode, code: &'static str, message: impl Into<String>) -> (StatusCode, Json<QfErrorBody>) {
    (
        status,
        Json(QfErrorBody {
            code,
            message: message.into(),
        }),
    )
}

#[derive(Deserialize)]
pub struct StartQuery {
    pub redirect_after: Option<String>,
    pub link: Option<bool>,
}

#[derive(Serialize)]
pub struct StartResponse {
    pub authorize_url: String,
}

pub async fn start(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<StartQuery>,
) -> QfResult<Json<StartResponse>> {
    let link = query.link.unwrap_or(false);
    let redirect_after = query.redirect_after.unwrap_or_else(|| "/".to_string());
    if !redirect_after.starts_with('/') {
        return Err(qf_err(StatusCode::BAD_REQUEST, "qf_invalid_redirect_after", "redirect_after must be relative"));
    }

    let link_to_user_id = if link {
        let auth_header = headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| qf_err(StatusCode::UNAUTHORIZED, "unauthorized", "login required"))?;
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| qf_err(StatusCode::UNAUTHORIZED, "unauthorized", "invalid auth header"))?;
        let claims = jwt::verify_token(token, &state.config.jwt_secret)
            .map_err(|_| qf_err(StatusCode::UNAUTHORIZED, "unauthorized", "invalid token"))?;
        let already_linked: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM qf_accounts WHERE user_id = $1)")
                .bind(claims.sub)
                .fetch_one(&state.db)
                .await
                .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to query links"))?;
        if already_linked {
            return Err(qf_err(StatusCode::BAD_REQUEST, "qf_already_linked", "account already linked"));
        }
        Some(claims.sub)
    } else {
        None
    };

    let pkce = pkce::generate_pkce_pair();
    let state_token = pkce::random_string(24);
    let nonce = pkce::random_string(12);
    let expires_at = Utc::now() + Duration::minutes(10);

    sqlx::query(
        "INSERT INTO qf_oauth_states (state, code_verifier, nonce, redirect_after, link_to_user_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(&state_token)
    .bind(&pkce.code_verifier)
    .bind(&nonce)
    .bind(&redirect_after)
    .bind(link_to_user_id)
    .bind(expires_at)
    .execute(&state.db)
    .await
    .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to persist oauth state"))?;

    let url = oauth::build_authorize_url(
        &state.qf_config,
        &oauth::AuthorizeUrlParams {
            redirect_uri: state.qf_config.redirect_uri.clone(),
            scope: QF_LOGIN_SCOPES.to_string(),
            state: state_token,
            nonce,
            code_challenge: pkce.code_challenge,
        },
    );
    Ok(Json(StartResponse { authorize_url: url }))
}

#[derive(Deserialize)]
pub struct ExchangeRequest {
    pub code: String,
    pub state: String,
}

pub async fn exchange(
    State(state): State<AppState>,
    Json(req): Json<ExchangeRequest>,
) -> QfResult<Json<serde_json::Value>> {
    let row: Option<(String, String, Option<String>, Option<Uuid>, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT code_verifier, nonce, redirect_after, link_to_user_id, expires_at FROM qf_oauth_states WHERE state = $1",
    )
    .bind(&req.state)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to load oauth state"))?;

    let (code_verifier, nonce, redirect_after, link_to_user_id, expires_at) =
        row.ok_or_else(|| qf_err(StatusCode::BAD_REQUEST, "qf_invalid_state", "invalid oauth state"))?;

    sqlx::query("DELETE FROM qf_oauth_states WHERE state = $1")
        .bind(&req.state)
        .execute(&state.db)
        .await
        .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to consume oauth state"))?;

    if expires_at < Utc::now() {
        return Err(qf_err(StatusCode::BAD_REQUEST, "qf_state_expired", "oauth state expired"));
    }

    let token = oauth::exchange_code(
        &state.qf_config,
        &state.http,
        &req.code,
        &state.qf_config.redirect_uri,
        &code_verifier,
    )
    .await
    .map_err(|e| qf_err(e.status, e.code, e.message))?;

    let id_token = token
        .id_token
        .as_deref()
        .ok_or_else(|| qf_err(StatusCode::BAD_REQUEST, "qf_missing_id_token", "id_token missing"))?;
    let claims = oauth::decode_id_token_unverified(id_token)
        .map_err(|e| qf_err(e.status, e.code, e.message))?;
    if claims.nonce.as_deref() != Some(nonce.as_str()) {
        return Err(qf_err(StatusCode::BAD_REQUEST, "qf_nonce_mismatch", "nonce mismatch"));
    }
    let expires_at = Utc::now() + Duration::seconds(token.expires_in.max(0));
    let redirect_after = redirect_after.unwrap_or_else(|| "/".to_string());

    if let Some(user_id) = link_to_user_id {
        let owner: Option<Uuid> = sqlx::query_scalar("SELECT user_id FROM qf_accounts WHERE qf_sub = $1")
            .bind(&claims.sub)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to check existing link"))?;
        if let Some(existing_user_id) = owner {
            if existing_user_id != user_id {
                return Err(qf_err(
                    StatusCode::CONFLICT,
                    "qf_account_already_linked_to_other_user",
                    "QF account already linked to another user",
                ));
            }
        }

        sqlx::query(
            "INSERT INTO qf_accounts (user_id, qf_sub, qf_email, qf_name, access_token, refresh_token, id_token, access_token_expires_at, scope)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (user_id) DO UPDATE SET
                qf_sub = EXCLUDED.qf_sub,
                qf_email = EXCLUDED.qf_email,
                qf_name = EXCLUDED.qf_name,
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                id_token = EXCLUDED.id_token,
                access_token_expires_at = EXCLUDED.access_token_expires_at,
                scope = EXCLUDED.scope,
                updated_at = NOW()",
        )
        .bind(user_id)
        .bind(&claims.sub)
        .bind(claims.email.clone())
        .bind(claims.name.clone())
        .bind(&token.access_token)
        .bind(token.refresh_token.as_deref())
        .bind(token.id_token.as_deref())
        .bind(expires_at)
        .bind(&token.scope)
        .execute(&state.db)
        .await
        .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to link account"))?;

        return Ok(Json(json!({
            "linked": true,
            "qf_email": claims.email,
            "redirect_after": redirect_after
        })));
    }

    let existing_qf_user: Option<(Uuid, String, String, String, bool)> = sqlx::query_as(
        "SELECT u.id, u.name, u.email, u.role::text, u.role_selection_pending
         FROM qf_accounts qa
         JOIN users u ON u.id = qa.user_id
         WHERE qa.qf_sub = $1",
    )
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to find linked user"))?;

    let (user_row, created_new_user) = if let Some(user) = existing_qf_user {
        (user, false)
    } else {
        let matched_user: Option<(Uuid, String, String, String, bool)> = if let Some(email) = claims.email.as_deref() {
            sqlx::query_as(
                "SELECT id, name, email, role::text, role_selection_pending FROM users WHERE lower(trim(email)) = $1",
            )
                .bind(email.trim().to_lowercase())
                .fetch_optional(&state.db)
                .await
                .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to match by email"))?
        } else {
            None
        };

        if let Some(user) = matched_user {
            (user, false)
        } else {
            let id = Uuid::new_v4();
            let name = claims
                .name
                .clone()
                .or(claims.first_name.clone())
                .unwrap_or_else(|| "QF User".to_string());
            let email = claims
                .email
                .clone()
                .unwrap_or_else(|| format!("qf-{}@miqraa.local", &claims.sub));
            let random_password = pkce::random_string(32);
            let hash = password::hash_password(&random_password)
                .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to hash password"))?;
            sqlx::query(
                "INSERT INTO users (id, name, email, password_hash, role, role_selection_pending)
                 VALUES ($1,$2,$3,$4,'student'::user_role, TRUE)",
            )
            .bind(id)
            .bind(&name)
            .bind(&email)
            .bind(&hash)
            .execute(&state.db)
            .await
            .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to create user"))?;
            ((id, name, email, "student".to_string(), true), true)
        }
    };

    sqlx::query(
        "INSERT INTO qf_accounts (user_id, qf_sub, qf_email, qf_name, access_token, refresh_token, id_token, access_token_expires_at, scope)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id) DO UPDATE SET
            qf_sub = EXCLUDED.qf_sub,
            qf_email = EXCLUDED.qf_email,
            qf_name = EXCLUDED.qf_name,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            id_token = EXCLUDED.id_token,
            access_token_expires_at = EXCLUDED.access_token_expires_at,
            scope = EXCLUDED.scope,
            updated_at = NOW()",
    )
    .bind(user_row.0)
    .bind(&claims.sub)
    .bind(claims.email.clone())
    .bind(claims.name.clone())
    .bind(&token.access_token)
    .bind(token.refresh_token.as_deref())
    .bind(token.id_token.as_deref())
    .bind(expires_at)
    .bind(&token.scope)
    .execute(&state.db)
    .await
    .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to upsert qf account"))?;

    let jwt_token = jwt::create_token(user_row.0, &user_row.3, &state.config.jwt_secret)
        .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to create jwt"))?;
    let user = UserResponse {
        id: user_row.0,
        name: user_row.1,
        email: user_row.2,
        role: user_row.3,
        qf_linked: true,
        qf_email: claims.email,
        role_selection_pending: user_row.4,
    };
    let post_login_redirect = if created_new_user || user_row.4 {
        "/auth/role-selection".to_string()
    } else {
        redirect_after
    };
    Ok(Json(json!({
        "token": jwt_token,
        "user": user,
        "redirect_after": post_login_redirect
    })))
}

pub async fn unlink(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
) -> Result<StatusCode, (StatusCode, Json<QfErrorBody>)> {
    sqlx::query("DELETE FROM qf_accounts WHERE user_id = $1")
        .bind(auth.id)
        .execute(&state.db)
        .await
        .map_err(|_| qf_err(StatusCode::INTERNAL_SERVER_ERROR, "server_error", "failed to unlink account"))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct QfDebugResponse {
    qf_env: String,
    qf_auth_base_url: String,
    qf_api_base_url: String,
    qf_client_id: String,
    qf_redirect_uri: String,
    qf_scopes: String,
}

pub async fn debug_qf(State(state): State<AppState>) -> Result<Json<QfDebugResponse>, StatusCode> {
    if state.config.qf_env != "prelive" {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(Json(QfDebugResponse {
        qf_env: state.config.qf_env.clone(),
        qf_auth_base_url: state.config.qf_auth_base_url(),
        qf_api_base_url: state.config.qf_api_base_url(),
        qf_client_id: state.config.qf_client_id.clone(),
        qf_redirect_uri: state.config.qf_redirect_uri.clone(),
        qf_scopes: state.config.qf_scopes.clone(),
    }))
}
