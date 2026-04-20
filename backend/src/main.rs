// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

mod api;
mod auth;
mod config;
mod db;
mod models;
mod media;
mod qf;
mod quran_ayah_counts;
mod riwaya;
mod rooms;
mod services;

use chrono::Utc;

use crate::api::ws::signaling::on_session_ended;
use crate::media::LivekitClient;
use crate::rooms::RoomManager;

#[derive(Parser)]
#[command(name = "miqraa-backend")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Create an admin user (bootstrap when no admin exists yet)
    CreateAdmin {
        #[arg(long)]
        name: String,
        #[arg(long)]
        email: String,
        #[arg(long)]
        password: String,
    },
}

fn init_tracing() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env().add_directive("miqraa_backend=debug".parse()?),
        )
        .init();
    Ok(())
}

async fn create_admin(name: String, email: String, password: String) -> Result<()> {
    init_tracing()?;

    let config = config::AppConfig::load()?;
    let pool = db::create_pool(&config.database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    let email_norm = email.trim().to_lowercase();
    let existing: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM users WHERE lower(trim(email)) = $1")
            .bind(&email_norm)
            .fetch_optional(&pool)
            .await?;

    if existing.is_some() {
        println!("❌ User with email {email_norm} already exists");
        std::process::exit(1);
    }

    let hash = auth::password::hash_password(&password)?;
    let id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, name, email, password_hash, role) \
         VALUES ($1, $2, $3, $4, 'admin'::user_role)",
    )
    .bind(id)
    .bind(name.trim())
    .bind(&email_norm)
    .bind(&hash)
    .execute(&pool)
    .await?;

    println!("✅ Admin user created: {id}");
    Ok(())
}

async fn run_server() -> Result<()> {
    init_tracing()?;

    tracing::info!("بسم الله الرحمن الرحيم");
    tracing::info!("Starting Al-Miqraa server...");

    let config = config::AppConfig::load()?;
    tracing::debug!(recordings_path = %config.recordings_path);

    std::fs::create_dir_all(&config.recordings_path)?;

    let db_pool = db::create_pool(&config.database_url).await?;

    sqlx::migrate!("./migrations").run(&db_pool).await?;

    let storage = services::storage::StorageService::new(&config.recordings_path);

    let rooms = std::sync::Arc::new(RoomManager::new());
    let livekit = std::sync::Arc::new(
        LivekitClient::new(config.livekit.clone())
            .expect("failed to initialize LiveKit client"),
    );
    tracing::info!("LiveKit client initialized: {}", livekit.ws_url());
    let state = api::AppState::new(db_pool, storage, config.clone(), rooms, livekit);
    let warm = state.content_api.clone();
    tokio::spawn(async move {
        match warm.get_access_token().await {
            Ok(_) => tracing::info!("QF content token pre-warmed"),
            Err(e) => tracing::warn!(
                error = %e,
                "QF content token pre-warm failed (will retry on first use)"
            ),
        }
    });
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            match sqlx::query("DELETE FROM qf_oauth_states WHERE expires_at < NOW()")
                .execute(&cleanup_state.db)
                .await
            {
                Ok(done) => tracing::debug!(
                    rows_deleted = done.rows_affected(),
                    "deleted expired qf oauth states"
                ),
                Err(err) => tracing::debug!(error = %err, "failed to cleanup qf oauth states"),
            }
        }
    });

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
    tracing::info!(
        "Al-Miqraa listening on {} (set HOST=127.0.0.1 to block LAN; default 0.0.0.0 accepts all interfaces)",
        addr
    );
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::CreateAdmin {
            name,
            email,
            password,
        }) => create_admin(name, email, password).await,
        None => run_server().await,
    }
}
