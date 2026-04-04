// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use anyhow::Result;
use tracing_subscriber::EnvFilter;

mod api;
mod auth;
mod config;
mod db;
mod models;
mod rooms;
mod services;
mod sfu;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env().add_directive("miqraa_backend=debug".parse()?),
        )
        .init();

    tracing::info!("بسم الله الرحمن الرحيم");
    tracing::info!("Starting Al-Miqraa server...");

    let config = config::AppConfig::load()?;

    tracing::debug!(
        stun_server = %config.stun_server,
        recordings_path = %config.recordings_path,
    );

    std::fs::create_dir_all(&config.recordings_path)?;

    let db_pool = db::create_pool(&config.database_url).await?;

    sqlx::migrate!("./migrations").run(&db_pool).await?;

    let storage = services::storage::StorageService::new(&config.recordings_path);
    let state = api::AppState::new(db_pool, storage, config.clone());

    let app = api::router::build_router(state);

    let addr = format!("{}:{}", config.host, config.port);
    tracing::info!("Al-Miqraa listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
