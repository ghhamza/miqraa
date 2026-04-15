// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use axum::http::StatusCode;
use axum::response::IntoResponse;
use base64::Engine as _;
use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};

use super::config::QfConfig;

#[derive(Debug, Serialize)]
pub struct OAuthErrorBody {
    pub code: &'static str,
    pub message: String,
}

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
}

impl ApiError {
    pub fn bad_request(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code,
            message: message.into(),
        }
    }

    pub fn internal(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            code,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            axum::Json(OAuthErrorBody {
                code: self.code,
                message: self.message,
            }),
        )
            .into_response()
    }
}

pub struct AuthorizeUrlParams {
    pub redirect_uri: String,
    pub scope: String,
    pub state: String,
    pub nonce: String,
    pub code_challenge: String,
}

pub fn build_authorize_url(cfg: &QfConfig, params: &AuthorizeUrlParams) -> String {
    let mut url = reqwest::Url::parse(&format!("{}/oauth2/auth", cfg.auth_base_url))
        .unwrap_or_else(|_| reqwest::Url::parse("https://prelive-oauth2.quran.foundation/oauth2/auth").expect("valid fallback url"));
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", &cfg.client_id)
        .append_pair("redirect_uri", &params.redirect_uri)
        .append_pair("scope", &params.scope)
        .append_pair("state", &params.state)
        .append_pair("nonce", &params.nonce)
        .append_pair("code_challenge", &params.code_challenge)
        .append_pair("code_challenge_method", "S256");
    url.into()
}

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
    pub expires_in: i64,
    pub scope: String,
    pub token_type: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: i64,
    pub scope: String,
}

pub async fn exchange_code(
    cfg: &QfConfig,
    http: &reqwest::Client,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> Result<TokenResponse, ApiError> {
    let endpoint = format!("{}/oauth2/token", cfg.auth_base_url);
    let response = http
        .post(endpoint)
        .basic_auth(&cfg.client_id, Some(&cfg.client_secret))
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("code_verifier", code_verifier),
        ])
        .send()
        .await
        .map_err(|_| ApiError::internal("qf_oauth_exchange_failed", "oauth request failed"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let short = body.chars().take(180).collect::<String>();
        tracing::warn!(qf_env = %cfg.qf_env, status = %status, body = %short, "QF token exchange failed");
        return Err(ApiError::bad_request(
            "qf_oauth_exchange_failed",
            format!("oauth exchange failed with status {}", status),
        ));
    }

    response
        .json::<TokenResponse>()
        .await
        .map_err(|_| ApiError::bad_request("qf_oauth_exchange_failed", "invalid token response"))
}

#[derive(Debug, Deserialize)]
pub struct IdTokenClaims {
    pub sub: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub first_name: Option<String>,
    pub nonce: Option<String>,
    pub exp: i64,
    pub iat: i64,
}

pub fn decode_id_token_unverified(id_token: &str) -> Result<IdTokenClaims, ApiError> {
    let mut parts = id_token.split('.');
    let _header = parts.next();
    let payload = parts
        .next()
        .ok_or_else(|| ApiError::bad_request("qf_invalid_id_token", "invalid id token format"))?;
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|_| ApiError::bad_request("qf_invalid_id_token", "invalid id token payload"))?;
    serde_json::from_slice::<IdTokenClaims>(&decoded)
        .map_err(|_| ApiError::bad_request("qf_invalid_id_token", "invalid id token claims"))
}

pub async fn exchange_refresh_token(
    cfg: &QfConfig,
    http: &reqwest::Client,
    refresh_token: &str,
) -> Result<RefreshTokenResponse, anyhow::Error> {
    let url = format!("{}/oauth2/token", cfg.auth_base_url);
    let resp = http
        .post(&url)
        .basic_auth(&cfg.client_id, Some(&cfg.client_secret))
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("scope", cfg.scopes.as_str()),
        ])
        .send()
        .await
        .context("qf refresh request failed")?;
    if !resp.status().is_success() {
        let status = resp.status();
        tracing::warn!(qf_status = %status, "QF refresh token HTTP error");
        return Err(anyhow!("qf refresh http {status}"));
    }
    let body: RefreshTokenResponse = resp
        .json()
        .await
        .context("qf refresh json parse failed")?;
    tracing::info!("QF token refreshed");
    Ok(body)
}
