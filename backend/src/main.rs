// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use std::sync::Arc;

use anyhow::Result;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

mod api;
mod auth;
mod config;
mod db;
mod models;
mod riwaya;
mod rooms;
mod services;
mod sfu;

use chrono::Utc;

use crate::api::ws::messages::ServerMessage;
use crate::api::ws::signaling::on_session_ended;
use crate::rooms::RoomManager;
use crate::sfu::{MediaService, SfuServerEvent, WebRtcSfu};

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

    let rooms = Arc::new(RoomManager::new());
    let (sfu_tx, mut sfu_rx) = tokio::sync::mpsc::unbounded_channel::<SfuServerEvent>();
    let media_service: Arc<dyn MediaService> =
        Arc::new(WebRtcSfu::new(sfu_tx, config.stun_server.clone()));
    let rooms_for_sfu = rooms.clone();
    tokio::spawn(async move {
        while let Some(ev) = sfu_rx.recv().await {
            match ev {
                SfuServerEvent::IceCandidate {
                    session_id,
                    user_id,
                    candidate,
                } => {
                    let msg = ServerMessage::IceCandidate {
                        candidate,
                        from: Uuid::nil(),
                    };
                    rooms_for_sfu.send_to(session_id, user_id, &msg).await;
                }
                SfuServerEvent::Offer {
                    session_id,
                    user_id,
                    sdp,
                } => {
                    let msg = ServerMessage::Offer {
                        sdp,
                        from: Uuid::nil(),
                    };
                    rooms_for_sfu.send_to(session_id, user_id, &msg).await;
                }
            }
        }
    });

    let state = api::AppState::new(db_pool, storage, config.clone(), rooms, media_service);

    let idle_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let cutoff = Utc::now() - chrono::Duration::minutes(10);
            let ids = idle_state.rooms.inactive_empty_sessions(cutoff).await;
            for sid in ids {
                tracing::info!(session_id = %sid, "Session auto-completed due to inactivity");
                let r = sqlx::query(
                    "UPDATE sessions SET status = 'completed'::session_status \
                     WHERE id = $1 AND status::text = 'in_progress'",
                )
                .bind(sid)
                .execute(&idle_state.db)
                .await;
                if let Err(e) = r {
                    tracing::warn!(error = %e, "failed to mark session completed (idle)");
                    continue;
                }
                on_session_ended(&idle_state, sid).await;
            }
        }
    });

    let app = api::router::build_router(state);

    let addr = format!("{}:{}", config.host, config.port);
    tracing::info!("Al-Miqraa listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
