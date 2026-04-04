// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::RwLock;
use uuid::Uuid;
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::interceptor::registry::Registry;
use webrtc::api::media_engine::MediaEngine;
use webrtc::api::APIBuilder;
use webrtc::ice_transport::ice_candidate::RTCIceCandidateInit;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::peer_connection::RTCPeerConnection;
use webrtc::rtp_transceiver::rtp_codec::RTPCodecType;
use webrtc::rtp_transceiver::rtp_sender::RTCRtpSender;
use webrtc::rtp_transceiver::rtp_transceiver_direction::RTCRtpTransceiverDirection;
use webrtc::rtp_transceiver::RTCRtpTransceiverInit;
use webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP;
use webrtc::track::track_local::TrackLocal;
use webrtc::track::track_remote::TrackRemote;

use crate::sfu::media_service::{MediaError, MediaService, ParticipantRole, SfuServerEvent};

fn create_api() -> webrtc::api::API {
    let mut media_engine = MediaEngine::default();
    media_engine
        .register_default_codecs()
        .expect("register_default_codecs");
    let mut registry = Registry::new();
    registry = register_default_interceptors(registry, &mut media_engine).expect("interceptors");
    APIBuilder::new()
        .with_media_engine(media_engine)
        .with_interceptor_registry(registry)
        .build()
}

pub struct WebRtcSfu {
    inner: Arc<WebRtcSfuInner>,
}

struct WebRtcSfuInner {
    sessions: RwLock<HashMap<Uuid, SfuSession>>,
    event_tx: tokio::sync::mpsc::UnboundedSender<SfuServerEvent>,
    api: Arc<webrtc::api::API>,
    stun_url: String,
}

struct SfuSession {
    peers: HashMap<Uuid, PeerState>,
    active_reciter_id: Option<Uuid>,
}

struct PeerState {
    role: ParticipantRole,
    peer_connection: Arc<RTCPeerConnection>,
    inbound_tracks: Vec<Arc<TrackRemote>>,
    outbound_senders: Vec<Arc<RTCRtpSender>>,
    forward_tasks: Vec<tokio::task::JoinHandle<()>>,
    negotiated: bool,
}

impl WebRtcSfu {
    pub fn new(
        event_tx: tokio::sync::mpsc::UnboundedSender<SfuServerEvent>,
        stun_url: String,
    ) -> Self {
        let api = Arc::new(create_api());
        Self {
            inner: Arc::new(WebRtcSfuInner {
                sessions: RwLock::new(HashMap::new()),
                event_tx,
                api,
                stun_url,
            }),
        }
    }

    fn rtc_configuration(stun_url: &str) -> RTCConfiguration {
        RTCConfiguration {
            ice_servers: vec![RTCIceServer {
                urls: vec![stun_url.to_string()],
                ..Default::default()
            }],
            ..Default::default()
        }
    }

    fn parse_client_ice(candidate: &str) -> RTCIceCandidateInit {
        serde_json::from_str::<RTCIceCandidateInit>(candidate).unwrap_or_else(|_| {
            RTCIceCandidateInit {
                candidate: candidate.to_string(),
                sdp_mid: None,
                sdp_mline_index: None,
                username_fragment: None,
            }
        })
    }
}

#[async_trait]
impl MediaService for WebRtcSfu {
    async fn create_session(&self, session_id: Uuid) -> Result<(), MediaError> {
        let mut guard = self.inner.sessions.write().await;
        guard.entry(session_id).or_insert_with(|| SfuSession {
            peers: HashMap::new(),
            active_reciter_id: None,
        });
        Ok(())
    }

    async fn add_participant(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        role: ParticipantRole,
    ) -> Result<String, MediaError> {
        let api = self.inner.api.clone();
        let stun = self.inner.stun_url.clone();
        let event_tx = self.inner.event_tx.clone();
        let inner = Arc::clone(&self.inner);

        let mut guard = self.inner.sessions.write().await;
        let session = guard
            .get_mut(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;

        let config = WebRtcSfu::rtc_configuration(&stun);
        let peer = api.new_peer_connection(config).await?;

        peer.add_transceiver_from_kind(
            RTPCodecType::Audio,
            Some(RTCRtpTransceiverInit {
                direction: RTCRtpTransceiverDirection::Recvonly,
                send_encodings: vec![],
            }),
        )
        .await?;

        if role == ParticipantRole::Teacher {
            peer.add_transceiver_from_kind(
                RTPCodecType::Video,
                Some(RTCRtpTransceiverInit {
                    direction: RTCRtpTransceiverDirection::Recvonly,
                    send_encodings: vec![],
                }),
            )
            .await?;
        }

        let pc = Arc::new(peer);

        let sid = session_id;
        let uid = user_id;
        pc.on_ice_candidate(Box::new(move |c| {
            let event_tx = event_tx.clone();
            Box::pin(async move {
                if let Some(c) = c {
                    if let Ok(j) = c.to_json() {
                        let _ = event_tx.send(SfuServerEvent::IceCandidate {
                            session_id: sid,
                            user_id: uid,
                            candidate: j.candidate,
                        });
                    }
                }
            })
        }));

        let sid_log = session_id;
        let uid_log = user_id;
        pc.on_peer_connection_state_change(Box::new(
            move |s: webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState| {
                tracing::debug!(
                    %sid_log,
                    %uid_log,
                    state = ?s,
                    "peer connection state"
                );
                Box::pin(async {})
            },
        ));

        let inner_track = Arc::clone(&inner);
        let sid_track = session_id;
        let uid_track = user_id;
        pc.on_track(Box::new(move |track, _, _| {
            let inner_track = Arc::clone(&inner_track);
            tokio::spawn(async move {
                if let Err(e) = inner_track
                    .on_inbound_track(sid_track, uid_track, track)
                    .await
                {
                    tracing::warn!(error = %e, "on_inbound_track");
                }
            });
            Box::pin(async {})
        }));

        session.peers.insert(
            user_id,
            PeerState {
                role,
                peer_connection: Arc::clone(&pc),
                inbound_tracks: Vec::new(),
                outbound_senders: Vec::new(),
                forward_tasks: Vec::new(),
                negotiated: false,
            },
        );

        drop(guard);

        let offer = pc.create_offer(None).await?;
        pc.set_local_description(offer.clone()).await?;
        Ok(offer.sdp)
    }

    async fn handle_answer(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        sdp: String,
    ) -> Result<(), MediaError> {
        let answer = RTCSessionDescription::answer(sdp)?;
        {
            let mut guard = self.inner.sessions.write().await;
            let session = guard
                .get_mut(&session_id)
                .ok_or(MediaError::SessionNotFound(session_id))?;
            let peer = session
                .peers
                .get_mut(&user_id)
                .ok_or(MediaError::ParticipantNotFound(user_id))?;
            peer.peer_connection
                .set_remote_description(answer)
                .await?;
            peer.negotiated = true;
        }
        self.inner.update_forwarding(session_id).await
    }

    async fn handle_ice_candidate(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        candidate: String,
    ) -> Result<(), MediaError> {
        let init = WebRtcSfu::parse_client_ice(&candidate);
        let guard = self.inner.sessions.read().await;
        let session = guard
            .get(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;
        let peer = session
            .peers
            .get(&user_id)
            .ok_or(MediaError::ParticipantNotFound(user_id))?;
        peer.peer_connection.add_ice_candidate(init).await?;
        Ok(())
    }

    async fn set_active_reciter(
        &self,
        session_id: Uuid,
        reciter_id: Option<Uuid>,
    ) -> Result<(), MediaError> {
        {
            let mut guard = self.inner.sessions.write().await;
            let session = guard
                .get_mut(&session_id)
                .ok_or(MediaError::SessionNotFound(session_id))?;
            session.active_reciter_id = reciter_id;
        }
        self.inner.update_forwarding(session_id).await
    }

    async fn remove_participant(&self, session_id: Uuid, user_id: Uuid) -> Result<(), MediaError> {
        let pc_opt = {
            let mut guard = self.inner.sessions.write().await;
            let Some(session) = guard.get_mut(&session_id) else {
                return Ok(());
            };
            let Some(mut peer) = session.peers.remove(&user_id) else {
                return Ok(());
            };
            for h in peer.forward_tasks.drain(..) {
                h.abort();
            }
            for s in &peer.outbound_senders {
                let _ = peer.peer_connection.remove_track(s).await;
            }
            peer.outbound_senders.clear();
            Some(peer.peer_connection)
        };
        if let Some(pc) = pc_opt {
            let _ = pc.close().await;
        }
        {
            let mut guard = self.inner.sessions.write().await;
            if let Some(s) = guard.get_mut(&session_id) {
                if s.peers.is_empty() {
                    guard.remove(&session_id);
                }
            }
        }
        self.inner.update_forwarding(session_id).await
    }

    async fn close_session(&self, session_id: Uuid) -> Result<(), MediaError> {
        let peers: Vec<Arc<RTCPeerConnection>> = {
            let mut guard = self.inner.sessions.write().await;
            let Some(mut session) = guard.remove(&session_id) else {
                return Ok(());
            };
            let mut pcs = Vec::new();
            for (_, mut peer) in session.peers.drain() {
                for h in peer.forward_tasks.drain(..) {
                    h.abort();
                }
                for s in &peer.outbound_senders {
                    let _ = peer.peer_connection.remove_track(s).await;
                }
                pcs.push(peer.peer_connection);
            }
            pcs
        };
        for pc in peers {
            let _ = pc.close().await;
        }
        Ok(())
    }
}

impl WebRtcSfuInner {
    async fn on_inbound_track(
        self: &Arc<Self>,
        session_id: Uuid,
        user_id: Uuid,
        track: Arc<TrackRemote>,
    ) -> Result<(), MediaError> {
        tracing::info!(
            %session_id,
            %user_id,
            kind = ?track.kind(),
            "received remote track"
        );
        {
            let mut guard = self.sessions.write().await;
            let session = guard
                .get_mut(&session_id)
                .ok_or(MediaError::SessionNotFound(session_id))?;
            let peer = session
                .peers
                .get_mut(&user_id)
                .ok_or(MediaError::ParticipantNotFound(user_id))?;
            peer.inbound_tracks.push(track);
        }
        self.update_forwarding(session_id).await
    }

    async fn update_forwarding(&self, session_id: Uuid) -> Result<(), MediaError> {
        let mut renegotiate: Vec<(Uuid, Arc<RTCPeerConnection>)> = Vec::new();
        let mut before_counts: HashMap<Uuid, usize> = HashMap::new();

        {
            let mut guard = self.sessions.write().await;
            let session = match guard.get_mut(&session_id) {
                Some(s) => s,
                None => return Ok(()),
            };

            for (id, peer) in &mut session.peers {
                before_counts.insert(*id, peer.outbound_senders.len());
                for h in peer.forward_tasks.drain(..) {
                    h.abort();
                }
                for s in &peer.outbound_senders {
                    let _ = peer.peer_connection.remove_track(s).await;
                }
                peer.outbound_senders.clear();
            }

            let sources: Vec<(Uuid, ParticipantRole, Vec<Arc<TrackRemote>>)> = session
                .peers
                .iter()
                .map(|(id, p)| (*id, p.role, p.inbound_tracks.clone()))
                .collect();

            let active_reciter = session.active_reciter_id;
            let mut link_list = Vec::new();

            for target_id in session.peers.keys().copied().collect::<Vec<_>>() {
                let negotiated = session
                    .peers
                    .get(&target_id)
                    .map(|p| p.negotiated)
                    .unwrap_or(false);
                if !negotiated {
                    continue;
                }

                for (source_id, role, tracks) in &sources {
                    if *source_id == target_id {
                        continue;
                    }
                    let forward_audio = match role {
                        ParticipantRole::Teacher => true,
                        ParticipantRole::Student => active_reciter == Some(*source_id),
                    };
                    let forward_video = matches!(role, ParticipantRole::Teacher);

                    for track in tracks {
                        let kind = track.kind();
                        if kind == RTPCodecType::Video && !forward_video {
                            continue;
                        }
                        if kind == RTPCodecType::Audio && !forward_audio {
                            continue;
                        }
                        if kind == RTPCodecType::Video && *role == ParticipantRole::Student {
                            continue;
                        }
                        link_list.push((target_id, *source_id, Arc::clone(track)));
                    }
                }
            }

            for (target_id, source_id, track) in link_list {
                let codec = track.codec().capability;
                // Must be unique per remote TrackRemote: same participant can expose multiple
                // audio (or video) tracks; reusing fwd-{source}-{kind} makes add_track hit
                // replace_track on an existing sender and triggers
                // ErrRTPSenderNewTrackHasIncorrectEnvelope ("same envelope").
                let stream_id = format!("fwd-stream-{source_id}-{}", track.tid());
                let track_id = format!("fwd-{source_id}-{}", track.tid());
                let local = Arc::new(TrackLocalStaticRTP::new(codec, track_id, stream_id));

                let peer = session
                    .peers
                    .get_mut(&target_id)
                    .ok_or(MediaError::Internal("target peer missing".into()))?;

                let sender = peer
                    .peer_connection
                    .add_track(local.clone() as Arc<dyn TrackLocal + Send + Sync>)
                    .await?;

                peer.outbound_senders.push(sender);
                let remote = Arc::clone(&track);
                let local_fwd = Arc::clone(&local);
                let h = tokio::spawn(async move {
                    loop {
                        match remote.read_rtp().await {
                            Ok((pkt, _)) => {
                                if local_fwd.write_rtp_with_extensions(&pkt, &[]).await.is_err() {
                                    break;
                                }
                            }
                            Err(_) => break,
                        }
                    }
                });
                peer.forward_tasks.push(h);
            }

            for (id, peer) in &session.peers {
                let before = before_counts.get(id).copied().unwrap_or(0);
                let after = peer.outbound_senders.len();
                if before > 0 || after > 0 {
                    renegotiate.push((*id, Arc::clone(&peer.peer_connection)));
                }
            }
        }

        let event_tx = self.event_tx.clone();
        for (user_id, pc) in renegotiate {
            match pc.create_offer(None).await {
                Ok(offer) => {
                    if let Err(e) = pc.set_local_description(offer.clone()).await {
                        tracing::warn!(error = %e, "set_local_description (renegotiation)");
                        continue;
                    }
                    let _ = event_tx.send(SfuServerEvent::Offer {
                        session_id,
                        user_id,
                        sdp: offer.sdp,
                    });
                }
                Err(e) => tracing::warn!(error = %e, "create_offer (renegotiation)"),
            }
        }

        Ok(())
    }
}
