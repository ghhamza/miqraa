// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use anyhow::Result;

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
        })
    }
}
