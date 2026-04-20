// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use serde::Deserialize;

/// Currently only `livekit` is supported. The enum exists to allow future
/// media backends without a breaking config change.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MediaBackend {
    #[default]
    Livekit,
}

impl std::str::FromStr for MediaBackend {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_ascii_lowercase().as_str() {
            "" | "livekit" => Ok(Self::Livekit),
            other => Err(format!("unknown media backend: {other}")),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct LivekitConfig {
    /// WebSocket URL clients use to connect — e.g. `ws://localhost:7880`.
    pub url: String,
    /// HTTP URL the backend uses for server admin API — e.g. `http://localhost:7880`.
    pub http_url: String,
    pub api_key: String,
    pub api_secret: String,
}
