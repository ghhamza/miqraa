// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use async_trait::async_trait;
use uuid::Uuid;

/// Identifies which direction a WebRTC transport flows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransportDirection {
    Send,
    Recv,
}

/// RTP capabilities of a router, returned to clients so they can create a Device.
/// Serialized as JSON — the mediasoup implementation produces mediasoup's
/// RtpCapabilities struct serialized to a `serde_json::Value`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RouterRtpCapabilities(pub serde_json::Value);

/// Parameters returned from create_webrtc_transport — the client uses these to
/// build its local transport via mediasoup-client.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WebRtcTransportParams {
    pub id: String,
    pub ice_parameters: serde_json::Value,
    pub ice_candidates: serde_json::Value,
    pub dtls_parameters: serde_json::Value,
}

/// Parameters the client sends when connecting a transport (DTLS parameters).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DtlsParameters(pub serde_json::Value);

/// Parameters the client sends when producing a track.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProduceParams {
    pub transport_id: String,
    pub kind: String, // "audio" | "video" — for Miqraa always "audio"
    pub rtp_parameters: serde_json::Value,
}

/// Parameters the client sends when requesting to consume a producer.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConsumeParams {
    pub transport_id: String,
    pub producer_id: String,
    pub rtp_capabilities: serde_json::Value,
}

/// Response returned to the client after a successful consume.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConsumerInfo {
    pub id: String,
    pub producer_id: String,
    pub kind: String,
    pub rtp_parameters: serde_json::Value,
}

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

    // === mediasoup-specific methods (M2a) ===

    /// Return the RTP capabilities of the router for this session. The client
    /// loads these into its mediasoup-client Device.
    async fn get_router_rtp_capabilities(
        &self,
        session_id: Uuid,
    ) -> Result<RouterRtpCapabilities, MediaError>;

    /// Create a WebRtcTransport for a participant. Returns the parameters the
    /// client needs to construct its local transport.
    async fn create_webrtc_transport(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        direction: TransportDirection,
    ) -> Result<WebRtcTransportParams, MediaError>;

    /// Complete the DTLS handshake on a previously-created transport.
    async fn connect_webrtc_transport(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        transport_id: String,
        dtls_parameters: DtlsParameters,
    ) -> Result<(), MediaError>;

    /// Create a Producer on a send transport. Returns the new producer's ID.
    async fn produce(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        params: ProduceParams,
    ) -> Result<String, MediaError>;

    /// Create a Consumer on a recv transport for a specific producer. Returns
    /// RTP parameters the client uses to construct its local consumer.
    async fn consume(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        params: ConsumeParams,
    ) -> Result<ConsumerInfo, MediaError>;

    /// Resume a paused consumer (consumers start paused; resume after the
    /// client has wired up its local receiver).
    async fn resume_consumer(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        consumer_id: String,
    ) -> Result<(), MediaError>;

    /// Close a producer (e.g. when a participant stops publishing).
    async fn close_producer(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        producer_id: String,
    ) -> Result<(), MediaError>;

    /// Active reciter for mediasoup produce permission; default: none (webrtc-rs ignores).
    async fn get_active_reciter(&self, _session_id: Uuid) -> Option<Uuid> {
        None
    }

    /// Other participants' producers for late-joiner catchup; default empty (webrtc-rs).
    async fn list_other_producers(
        &self,
        _session_id: Uuid,
        _excluding_user_id: Uuid,
    ) -> Vec<(Uuid, String, String)> {
        Vec::new()
    }
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
