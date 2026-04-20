// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::sync::Arc;
use std::time::Duration;

use livekit_api::access_token::{AccessToken, AccessTokenError};
use livekit_api::services::room::RoomClient;
use uuid::Uuid;

use super::config::LivekitConfig;
use super::grants::SessionRole;

#[derive(Clone)]
pub struct LivekitClient {
    config: LivekitConfig,
    room_client: Arc<RoomClient>,
}

#[derive(Debug, thiserror::Error)]
pub enum LivekitError {
    #[error("access token error: {0}")]
    Token(#[from] AccessTokenError),
    #[error("room client error: {0}")]
    RoomClient(String),
}

impl LivekitClient {
    pub fn new(config: LivekitConfig) -> Result<Self, LivekitError> {
        let room_client = RoomClient::with_api_key(
            &config.http_url,
            &config.api_key,
            &config.api_secret,
        );
        Ok(Self {
            config,
            room_client: Arc::new(room_client),
        })
    }

    /// Stable room name for a Miqraa session.
    pub fn room_name_for_session(session_id: Uuid) -> String {
        format!("session-{session_id}")
    }

    /// Mint an access token for a participant joining a session.
    pub fn mint_token(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        user_name: &str,
        role: SessionRole,
    ) -> Result<String, LivekitError> {
        let room = Self::room_name_for_session(session_id);
        let grants = role.to_video_grants(&room);
        let token = AccessToken::with_api_key(&self.config.api_key, &self.config.api_secret)
            .with_identity(&user_id.to_string())
            .with_name(user_name)
            .with_ttl(Duration::from_secs(6 * 60 * 60))
            .with_grants(grants)
            .to_jwt()?;
        Ok(token)
    }

    /// Returns the WebSocket URL clients use to connect.
    pub fn ws_url(&self) -> &str {
        &self.config.url
    }

    /// Scaffolded helper for P5.
    #[allow(dead_code)]
    pub async fn set_participant_can_publish(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        can_publish: bool,
    ) -> Result<(), LivekitError> {
        use livekit_api::services::room::UpdateParticipantOptions;
        use livekit_protocol::ParticipantPermission;

        let room = Self::room_name_for_session(session_id);
        let identity = user_id.to_string();

        let permission = ParticipantPermission {
            can_subscribe: true,
            can_publish,
            can_publish_data: true,
            ..Default::default()
        };

        self.room_client
            .update_participant(
                &room,
                &identity,
                UpdateParticipantOptions {
                    permission: Some(permission),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| LivekitError::RoomClient(e.to_string()))?;
        Ok(())
    }
}
