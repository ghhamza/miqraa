// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

pub mod extractors;
pub mod handlers;
pub mod router;
pub mod types;
pub mod ws;

use crate::config::AppConfig;
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
        Self {
            db,
            storage,
            config,
            rooms,
            media_service,
        }
    }
}
