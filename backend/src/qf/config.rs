// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use crate::config::AppConfig;

#[derive(Clone, Debug)]
pub struct QfConfig {
    pub qf_env: String,
    pub auth_base_url: String,
    pub api_base_url: String,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub scopes: String,
    pub audio_cdn_base_url: String,
}

impl QfConfig {
    pub fn from_app_config(cfg: &AppConfig) -> Self {
        Self {
            qf_env: cfg.qf_env.clone(),
            auth_base_url: cfg.qf_auth_base_url(),
            api_base_url: cfg.qf_api_base_url(),
            client_id: cfg.qf_client_id.clone(),
            client_secret: cfg.qf_client_secret.clone(),
            redirect_uri: cfg.qf_redirect_uri.clone(),
            scopes: cfg.qf_scopes.clone(),
            audio_cdn_base_url: cfg.qf_audio_cdn_base_url.clone(),
        }
    }
}
