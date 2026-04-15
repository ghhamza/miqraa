// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::collections::HashMap;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::qf::config::QfConfig;
use crate::qf::oauth::{exchange_refresh_token, RefreshTokenResponse};

/// Mushaf ID = 1 (QCFV2), as required by QF activity-day payload.
pub const QF_MUSHAF_QCFV2: i32 = 1;
/// Heuristic recitation time used for activity-day credits.
pub const SECONDS_PER_AYAH: i64 = 3;

const STREAK_CACHE_TTL: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub struct UserApiClient {
    cfg: QfConfig,
    http: reqwest::Client,
    db: PgPool,
    streak_cache: std::sync::Arc<Mutex<HashMap<Uuid, (StreakData, Instant)>>>,
}

#[derive(Debug, Clone)]
pub struct QfAccountTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub access_token_expires_at: DateTime<Utc>,
}

#[derive(Debug)]
pub enum SyncError {
    NotLinked,
    NoRefreshToken,
    InsufficientScope,
    Upstream(String),
    Network(String),
}

impl std::fmt::Display for SyncError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotLinked => write!(f, "not_linked"),
            Self::NoRefreshToken => write!(f, "no_refresh_token"),
            Self::InsufficientScope => write!(f, "insufficient_scope"),
            Self::Upstream(s) => write!(f, "upstream:{s}"),
            Self::Network(s) => write!(f, "network:{s}"),
        }
    }
}

#[derive(Serialize)]
struct ActivityDayBody {
    seconds: i64,
    ranges: Vec<String>,
    #[serde(rename = "mushafId")]
    mushaf_id: i32,
    #[serde(rename = "type")]
    activity_type: &'static str,
}

#[derive(Serialize)]
struct ReadingSessionBody {
    #[serde(rename = "chapterNumber")]
    chapter_number: i32,
    #[serde(rename = "verseNumber")]
    verse_number: i32,
}

#[derive(Deserialize)]
struct StreakApiResponse {
    data: Option<StreakData>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct StreakData {
    /// Current streak in days.
    #[serde(default)]
    pub days: i64,
    /// Longest streak, when available.
    #[serde(default)]
    pub longest: Option<i64>,
}

impl UserApiClient {
    pub fn new(cfg: QfConfig, http: reqwest::Client, db: PgPool) -> Self {
        Self {
            cfg,
            http,
            db,
            streak_cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn load_tokens(&self, user_id: Uuid) -> Result<Option<QfAccountTokens>> {
        let row: Option<(String, Option<String>, DateTime<Utc>)> = sqlx::query_as(
            "SELECT access_token, refresh_token, access_token_expires_at FROM qf_accounts WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.db)
        .await
        .context("qf_accounts query failed")?;
        Ok(row.map(|(access_token, refresh_token, access_token_expires_at)| {
            QfAccountTokens {
                access_token,
                refresh_token,
                access_token_expires_at,
            }
        }))
    }

    async fn persist_refreshed_tokens(
        &self,
        user_id: Uuid,
        refreshed: &RefreshTokenResponse,
    ) -> Result<()> {
        let expires_at = Utc::now() + chrono::Duration::seconds(refreshed.expires_in.max(0));
        sqlx::query(
            "UPDATE qf_accounts
             SET access_token = $1,
                 refresh_token = COALESCE($2, refresh_token),
                 access_token_expires_at = $3,
                 scope = $4,
                 updated_at = NOW()
             WHERE user_id = $5",
        )
        .bind(&refreshed.access_token)
        .bind(refreshed.refresh_token.as_deref())
        .bind(expires_at)
        .bind(&refreshed.scope)
        .bind(user_id)
        .execute(&self.db)
        .await
        .context("update qf_accounts after refresh failed")?;
        Ok(())
    }

    async fn get_valid_access_token(&self, user_id: Uuid) -> Result<String, SyncError> {
        let tokens = self
            .load_tokens(user_id)
            .await
            .map_err(|e| SyncError::Upstream(e.to_string()))?
            .ok_or(SyncError::NotLinked)?;

        let needs_refresh =
            tokens.access_token_expires_at <= Utc::now() + chrono::Duration::seconds(60);
        if !needs_refresh {
            return Ok(tokens.access_token);
        }

        let refresh_token = tokens.refresh_token.ok_or(SyncError::NoRefreshToken)?;
        let refreshed = exchange_refresh_token(&self.cfg, &self.http, &refresh_token)
            .await
            .map_err(|e| {
                tracing::warn!(user_id = %user_id, error = %e, "QF refresh token failed");
                SyncError::Upstream(format!("refresh_failed:{e}"))
            })?;
        self.persist_refreshed_tokens(user_id, &refreshed)
            .await
            .map_err(|e| SyncError::Upstream(e.to_string()))?;
        Ok(refreshed.access_token)
    }

    /// POST /auth/v1/activity-days - the streak-driving endpoint.
    pub async fn push_activity_day(
        &self,
        user_id: Uuid,
        surah: i32,
        ayah_start: i32,
        ayah_end: i32,
        timezone: Option<&str>,
    ) -> Result<(), SyncError> {
        let token = self.get_valid_access_token(user_id).await?;
        let body = ActivityDayBody {
            seconds: ((ayah_end - ayah_start + 1).max(1) as i64) * SECONDS_PER_AYAH,
            ranges: vec![format!("{surah}:{ayah_start}-{surah}:{ayah_end}")],
            mushaf_id: QF_MUSHAF_QCFV2,
            activity_type: "QURAN",
        };
        let url = format!("{}/auth/v1/activity-days", self.cfg.api_base_url);
        let mut req = self
            .http
            .post(&url)
            .header("x-auth-token", &token)
            .header("x-client-id", &self.cfg.client_id)
            .json(&body);
        if let Some(tz) = timezone {
            req = req.header("x-timezone", tz);
        }
        let resp = req
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;
        if resp.status().is_success() {
            tracing::info!(user_id = %user_id, surah, ayah_start, ayah_end, "QF activity-day synced");
            return Ok(());
        }
        if resp.status() == reqwest::StatusCode::FORBIDDEN {
            return Err(SyncError::InsufficientScope);
        }
        Err(SyncError::Upstream(format!(
            "activity_day_http_{}",
            resp.status()
        )))
    }

    /// POST /auth/v1/reading-sessions - updates continue-reading position.
    pub async fn push_reading_session(
        &self,
        user_id: Uuid,
        surah: i32,
        ayah: i32,
    ) -> Result<(), SyncError> {
        let token = self.get_valid_access_token(user_id).await?;
        let body = ReadingSessionBody {
            chapter_number: surah,
            verse_number: ayah,
        };
        let url = format!("{}/auth/v1/reading-sessions", self.cfg.api_base_url);
        let resp = self
            .http
            .post(&url)
            .header("x-auth-token", &token)
            .header("x-client-id", &self.cfg.client_id)
            .json(&body)
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;
        if resp.status().is_success() {
            return Ok(());
        }
        if resp.status() == reqwest::StatusCode::FORBIDDEN {
            return Err(SyncError::InsufficientScope);
        }
        Err(SyncError::Upstream(format!(
            "reading_session_http_{}",
            resp.status()
        )))
    }

    pub async fn get_streak(&self, user_id: Uuid) -> Result<StreakData, SyncError> {
        {
            let cache = self.streak_cache.lock().await;
            if let Some((cached, at)) = cache.get(&user_id) {
                if at.elapsed() < STREAK_CACHE_TTL {
                    return Ok(cached.clone());
                }
            }
        }

        let token = self.get_valid_access_token(user_id).await?;
        let url = format!("{}/auth/v1/streaks", self.cfg.api_base_url);
        let resp = self
            .http
            .get(&url)
            .header("x-auth-token", &token)
            .header("x-client-id", &self.cfg.client_id)
            .timeout(Duration::from_secs(8))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;
        if !resp.status().is_success() {
            if resp.status() == reqwest::StatusCode::FORBIDDEN {
                return Err(SyncError::InsufficientScope);
            }
            return Err(SyncError::Upstream(format!("streak_http_{}", resp.status())));
        }
        let body: StreakApiResponse = resp
            .json()
            .await
            .map_err(|e| SyncError::Upstream(format!("streak_json:{e}")))?;
        let data = body
            .data
            .ok_or_else(|| SyncError::Upstream("streak_no_data".to_string()))?;

        let mut cache = self.streak_cache.lock().await;
        cache.insert(user_id, (data.clone(), Instant::now()));
        Ok(data)
    }

    pub async fn sync_recitation(
        &self,
        recitation_id: Uuid,
        student_id: Uuid,
        surah: i32,
        ayah_start: i32,
        ayah_end: i32,
        timezone: Option<String>,
    ) -> Result<(), SyncError> {
        self.push_activity_day(student_id, surah, ayah_start, ayah_end, timezone.as_deref())
            .await?;
        let _ = self.push_reading_session(student_id, surah, ayah_end).await;
        sqlx::query("UPDATE recitations SET qf_synced_at = NOW(), qf_sync_error = NULL WHERE id = $1")
            .bind(recitation_id)
            .execute(&self.db)
            .await
            .map_err(|e| SyncError::Upstream(format!("db_update:{e}")))?;
        Ok(())
    }

    pub async fn mark_sync_error(&self, recitation_id: Uuid, error: &SyncError) {
        let code = match error {
            SyncError::NotLinked => "not_linked".to_string(),
            SyncError::NoRefreshToken => "no_refresh_token".to_string(),
            SyncError::InsufficientScope => "insufficient_scope".to_string(),
            SyncError::Upstream(s) => format!("upstream:{}", s.chars().take(180).collect::<String>()),
            SyncError::Network(_) => "network".to_string(),
        };
        let _ = sqlx::query(
            "UPDATE recitations SET qf_sync_error = $1 WHERE id = $2 AND qf_synced_at IS NULL",
        )
        .bind(code)
        .bind(recitation_id)
        .execute(&self.db)
        .await;
    }
}
