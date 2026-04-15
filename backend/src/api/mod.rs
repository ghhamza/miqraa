// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

pub mod extractors;
pub mod handlers;
pub mod router;
pub mod types;
pub mod ws;

use crate::config::AppConfig;
use crate::qf::config::QfConfig;
use crate::qf::content::ContentApiClient;
use crate::qf::user_api::UserApiClient;
use crate::rooms::RoomManager;
use crate::services::storage::StorageService;
use crate::sfu::MediaService;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    /// Used by recording upload handlers (forthcoming).
    #[allow(dead_code)]
    pub storage: StorageService,
    pub config: AppConfig,
    pub qf_config: QfConfig,
    pub http: reqwest::Client,
    pub content_api: Arc<ContentApiClient>,
    pub user_api: Arc<UserApiClient>,
    pub rooms: Arc<RoomManager>,
    pub media_service: Arc<dyn MediaService>,
}

impl AppState {
    pub fn new(
        db: PgPool,
        storage: StorageService,
        config: AppConfig,
        rooms: Arc<RoomManager>,
        media_service: Arc<dyn MediaService>,
    ) -> Self {
        let qf_config = QfConfig::from_app_config(&config);
        let http = reqwest::Client::new();
        let content_api = Arc::new(ContentApiClient::new(qf_config.clone(), http.clone()));
        let user_api = Arc::new(UserApiClient::new(qf_config.clone(), http.clone(), db.clone()));
        Self {
            db,
            storage,
            qf_config,
            http,
            content_api,
            user_api,
            config,
            rooms,
            media_service,
        }
    }
}
