// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use anyhow::Result;

use crate::media::{LivekitConfig, MediaBackend};

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub recordings_path: String,
    pub qf_env: String,
    pub qf_client_id: String,
    pub qf_client_secret: String,
    pub qf_redirect_uri: String,
    pub qf_scopes: String,
    pub qf_audio_cdn_base_url: String,
    /// Selector for the media backend. Currently only `Livekit` is supported.
    /// Retained for future variants (e.g. a self-hosted mediasoup sidecar).
    #[allow(dead_code)]
    pub media_backend: MediaBackend,
    pub livekit: LivekitConfig,
}

impl AppConfig {
    pub fn qf_auth_base_url(&self) -> String {
        if self.qf_env == "production" {
            "https://oauth2.quran.foundation".to_string()
        } else {
            "https://prelive-oauth2.quran.foundation".to_string()
        }
    }

    pub fn qf_api_base_url(&self) -> String {
        if self.qf_env == "production" {
            "https://apis.quran.foundation".to_string()
        } else {
            "https://apis-prelive.quran.foundation".to_string()
        }
    }

    pub fn load() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: std::env::var("PORT").unwrap_or_else(|_| "3000".into()).parse()?,
            database_url: std::env::var("DATABASE_URL")?,
            jwt_secret: std::env::var("JWT_SECRET")?,
            recordings_path: std::env::var("RECORDINGS_PATH")
                .unwrap_or_else(|_| "./data/recordings".into()),
            qf_env: std::env::var("QF_ENV").unwrap_or_else(|_| "prelive".into()),
            qf_client_id: std::env::var("QF_CLIENT_ID").unwrap_or_default(),
            qf_client_secret: std::env::var("QF_CLIENT_SECRET").unwrap_or_default(),
            qf_redirect_uri: std::env::var("QF_REDIRECT_URI").unwrap_or_default().trim().to_string(),
            qf_scopes: std::env::var("QF_SCOPES")
                .unwrap_or_else(|_| "openid offline_access reading_session streak activity_day user".into()),
            qf_audio_cdn_base_url: std::env::var("QF_AUDIO_CDN_BASE_URL")
                .unwrap_or_else(|_| "https://audio.qurancdn.com".into()),
            media_backend: std::env::var("APP_MEDIA_BACKEND")
                .unwrap_or_else(|_| "livekit".into())
                .parse()
                .unwrap_or(MediaBackend::Livekit),
            livekit: LivekitConfig {
                url: std::env::var("APP_LIVEKIT_URL")
                    .unwrap_or_else(|_| "ws://localhost:7880".into()),
                http_url: std::env::var("APP_LIVEKIT_HTTP_URL")
                    .unwrap_or_else(|_| "http://localhost:7880".into()),
                api_key: std::env::var("APP_LIVEKIT_API_KEY")
                    .unwrap_or_else(|_| "devkey".into()),
                api_secret: std::env::var("APP_LIVEKIT_API_SECRET")
                    .unwrap_or_else(|_| "secret".into()),
            },
        })
    }
}
