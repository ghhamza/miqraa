// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use anyhow::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MediaBackend {
    #[default]
    WebrtcRs,
    Mediasoup,
}

impl std::str::FromStr for MediaBackend {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_lowercase().as_str() {
            "" | "webrtc_rs" | "webrtc-rs" | "webrtcrs" => Ok(MediaBackend::WebrtcRs),
            "mediasoup" => Ok(MediaBackend::Mediasoup),
            other => Err(format!("unknown media backend: {other}")),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub recordings_path: String,
    pub stun_server: String,
    pub media_backend: MediaBackend,
    /// ICE announced IP for mediasoup transports (e.g. public IP in production).
    pub mediasoup_announced_ip: String,
    pub mediasoup_rtc_min_port: u16,
    pub mediasoup_rtc_max_port: u16,
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        dotenvy::dotenv().ok();

        let media_backend = std::env::var("APP_MEDIA_BACKEND")
            .unwrap_or_default()
            .parse::<MediaBackend>()
            .map_err(|e| anyhow::anyhow!(e))?;

        let mediasoup_announced_ip = std::env::var("APP_MEDIASOUP_ANNOUNCED_IP")
            .unwrap_or_else(|_| "127.0.0.1".into());
        let mediasoup_rtc_min_port = std::env::var("APP_MEDIASOUP_RTC_MIN_PORT")
            .unwrap_or_else(|_| "40000".into())
            .parse()?;
        let mediasoup_rtc_max_port = std::env::var("APP_MEDIASOUP_RTC_MAX_PORT")
            .unwrap_or_else(|_| "40100".into())
            .parse()?;

        Ok(Self {
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: std::env::var("PORT").unwrap_or_else(|_| "3000".into()).parse()?,
            database_url: std::env::var("DATABASE_URL")?,
            jwt_secret: std::env::var("JWT_SECRET")?,
            recordings_path: std::env::var("RECORDINGS_PATH")
                .unwrap_or_else(|_| "./data/recordings".into()),
            stun_server: std::env::var("STUN_SERVER")
                .unwrap_or_else(|_| "stun:stun.l.google.com:19302".into()),
            media_backend,
            mediasoup_announced_ip,
            mediasoup_rtc_min_port,
            mediasoup_rtc_max_port,
        })
    }
}
