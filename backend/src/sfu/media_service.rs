// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use async_trait::async_trait;
use uuid::Uuid;

/// Events from the SFU back to WebSocket signaling (ICE trickle and renegotiation offers).
#[derive(Debug, Clone)]
pub enum SfuServerEvent {
    IceCandidate {
        session_id: Uuid,
        user_id: Uuid,
        candidate: String,
    },
    Offer {
        session_id: Uuid,
        user_id: Uuid,
        sdp: String,
    },
}

/// Abstraction over the media routing layer.
/// Current implementation: webrtc-rs SFU in-process.
/// Future: could be swapped for LiveKit, Janus, or any external SFU.
#[async_trait]
pub trait MediaService: Send + Sync + 'static {
    /// Create a new media session for a live session room
    async fn create_session(&self, session_id: Uuid) -> Result<(), MediaError>;

    /// Add a participant — returns an SDP offer to send to the client
    async fn add_participant(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        role: ParticipantRole,
    ) -> Result<String, MediaError>;

    /// Handle SDP answer from client
    async fn handle_answer(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        sdp: String,
    ) -> Result<(), MediaError>;

    /// Handle ICE candidate from client
    async fn handle_ice_candidate(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        candidate: String,
    ) -> Result<(), MediaError>;

    /// Update forwarding rules when active reciter changes
    async fn set_active_reciter(
        &self,
        session_id: Uuid,
        reciter_id: Option<Uuid>,
    ) -> Result<(), MediaError>;

    /// Remove a participant (disconnect their peer connection)
    async fn remove_participant(&self, session_id: Uuid, user_id: Uuid) -> Result<(), MediaError>;

    /// Tear down the entire media session
    async fn close_session(&self, session_id: Uuid) -> Result<(), MediaError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParticipantRole {
    Teacher,
    Student,
}

#[derive(Debug, thiserror::Error)]
pub enum MediaError {
    #[error("Session not found: {0}")]
    SessionNotFound(Uuid),
    #[error("Participant not found: {0}")]
    ParticipantNotFound(Uuid),
    #[error("WebRTC error: {0}")]
    WebRtc(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<webrtc::Error> for MediaError {
    fn from(e: webrtc::Error) -> Self {
        MediaError::WebRtc(e.to_string())
    }
}
