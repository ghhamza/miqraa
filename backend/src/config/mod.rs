// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub recordings_path: String,
    pub stun_server: String,
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: std::env::var("PORT").unwrap_or_else(|_| "3000".into()).parse()?,
            database_url: std::env::var("DATABASE_URL")?,
            jwt_secret: std::env::var("JWT_SECRET")?,
            recordings_path: std::env::var("RECORDINGS_PATH")
                .unwrap_or_else(|_| "./data/recordings".into()),
            stun_server: std::env::var("STUN_SERVER")
                .unwrap_or_else(|_| "stun:stun.l.google.com:19302".into()),
        })
    }
}
