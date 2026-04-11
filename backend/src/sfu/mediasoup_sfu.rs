// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

//! mediasoup-based [`MediaService`] — Worker, Router, WebRTC transports, Producer, Consumer.

use std::collections::HashMap;
use std::num::{NonZeroU32, NonZeroU8};
use std::sync::Arc;

use async_trait::async_trait;
use mediasoup::prelude::*;
use mediasoup::worker::WorkerSettings;
use mediasoup::worker_manager::WorkerManager;
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

use crate::sfu::media_service::{
    ConsumeParams, ConsumerInfo, DtlsParameters as ClientDtlsParameters, MediaError, MediaService,
    ParticipantRole, ProduceParams, RouterRtpCapabilities, TransportDirection, WebRtcTransportParams,
};

pub struct MediasoupMediaService {
    worker_manager: WorkerManager,
    /// Lazily created and reused for all session routers.
    shared_worker: Arc<Mutex<Option<Worker>>>,
    sessions: Arc<RwLock<HashMap<Uuid, SessionState>>>,
    announced_ip: String,
    rtc_min_port: u16,
    rtc_max_port: u16,
}

struct SessionState {
    router: Router,
    participants: HashMap<Uuid, ParticipantState>,
    active_reciter_id: Option<Uuid>,
}

struct ParticipantState {
    #[allow(dead_code)]
    role: ParticipantRole,
    send_transport: Option<WebRtcTransport>,
    recv_transport: Option<WebRtcTransport>,
    producers: HashMap<ProducerId, Producer>,
    consumers: HashMap<ConsumerId, Consumer>,
}

impl MediasoupMediaService {
    pub fn new(announced_ip: String, rtc_min_port: u16, rtc_max_port: u16) -> Self {
        Self {
            worker_manager: WorkerManager::new(),
            shared_worker: Arc::new(Mutex::new(None)),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            announced_ip,
            rtc_min_port,
            rtc_max_port,
        }
    }

    async fn ensure_worker(&self) -> Result<Worker, MediaError> {
        let mut guard = self.shared_worker.lock().await;
        if let Some(w) = guard.as_ref() {
            return Ok(w.clone());
        }
        let mut settings = WorkerSettings::default();
        settings.rtc_port_range = self.rtc_min_port..=self.rtc_max_port;
        let worker = self
            .worker_manager
            .create_worker(settings)
            .await
            .map_err(|e| MediaError::Internal(format!("create worker: {e}")))?;
        *guard = Some(worker.clone());
        Ok(worker)
    }

    fn media_codecs() -> Vec<RtpCodecCapability> {
        vec![RtpCodecCapability::Audio {
            mime_type: MimeTypeAudio::Opus,
            preferred_payload_type: None,
            clock_rate: NonZeroU32::new(48_000).expect("nonzero"),
            channels: NonZeroU8::new(2).expect("nonzero"),
            parameters: RtpCodecParametersParameters::from([("useinbandfec", 1u32.into())]),
            rtcp_feedback: vec![],
        }]
    }

    async fn create_router_inner(&self) -> Result<Router, MediaError> {
        let worker = self.ensure_worker().await?;
        let media_codecs = Self::media_codecs();
        worker
            .create_router(RouterOptions::new(media_codecs))
            .await
            .map_err(|e| MediaError::Internal(format!("create router: {e}")))
    }

    fn listen_info(&self) -> Result<ListenInfo, MediaError> {
        let ip: std::net::IpAddr = self
            .announced_ip
            .parse()
            .map_err(|e| MediaError::Internal(format!("invalid APP_MEDIASOUP_ANNOUNCED_IP: {e}")))?;
        Ok(ListenInfo {
            protocol: Protocol::Udp,
            ip,
            announced_address: None,
            expose_internal_ip: false,
            port: None,
            port_range: None,
            flags: None,
            send_buffer_size: None,
            recv_buffer_size: None,
        })
    }
}

#[async_trait]
impl MediaService for MediasoupMediaService {
    async fn create_session(&self, session_id: Uuid) -> Result<(), MediaError> {
        let mut sessions = self.sessions.write().await;
        if sessions.contains_key(&session_id) {
            return Ok(());
        }
        let router = self.create_router_inner().await?;
        sessions.insert(
            session_id,
            SessionState {
                router,
                participants: HashMap::new(),
                active_reciter_id: None,
            },
        );
        Ok(())
    }

    async fn add_participant(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        role: ParticipantRole,
    ) -> Result<String, MediaError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;
        session.participants.insert(
            user_id,
            ParticipantState {
                role,
                send_transport: None,
                recv_transport: None,
                producers: HashMap::new(),
                consumers: HashMap::new(),
            },
        );
        Ok(String::new())
    }

    async fn handle_answer(
        &self,
        _session_id: Uuid,
        _user_id: Uuid,
        _sdp: String,
    ) -> Result<(), MediaError> {
        tracing::warn!("mediasoup: handle_answer ignored (not used on mediasoup path)");
        Ok(())
    }

    async fn handle_ice_candidate(
        &self,
        _session_id: Uuid,
        _user_id: Uuid,
        _candidate: String,
    ) -> Result<(), MediaError> {
        tracing::warn!("mediasoup: handle_ice_candidate ignored (not used on mediasoup path)");
        Ok(())
    }

    async fn set_active_reciter(
        &self,
        session_id: Uuid,
        reciter_id: Option<Uuid>,
    ) -> Result<(), MediaError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;
        session.active_reciter_id = reciter_id;
        Ok(())
    }

    async fn get_active_reciter(&self, session_id: Uuid) -> Option<Uuid> {
        let sessions = self.sessions.read().await;
        sessions
            .get(&session_id)
            .and_then(|s| s.active_reciter_id)
    }

    async fn list_other_producers(
        &self,
        session_id: Uuid,
        excluding_user_id: Uuid,
    ) -> Vec<(Uuid, String, String)> {
        let sessions = self.sessions.read().await;
        let Some(session) = sessions.get(&session_id) else {
            return vec![];
        };
        let mut out = Vec::new();
        for (user_id, participant) in &session.participants {
            if *user_id == excluding_user_id {
                continue;
            }
            for (producer_id, producer) in &participant.producers {
                let kind = match producer.kind() {
                    MediaKind::Audio => "audio".to_string(),
                    MediaKind::Video => "video".to_string(),
                };
                out.push((*user_id, producer_id.to_string(), kind));
            }
        }
        out
    }

    async fn remove_participant(&self, session_id: Uuid, user_id: Uuid) -> Result<(), MediaError> {
        let mut sessions = self.sessions.write().await;
        let Some(session) = sessions.get_mut(&session_id) else {
            return Ok(());
        };
        session.participants.remove(&user_id);
        if session.participants.is_empty() {
            sessions.remove(&session_id);
        }
        Ok(())
    }

    async fn close_session(&self, session_id: Uuid) -> Result<(), MediaError> {
        let mut sessions = self.sessions.write().await;
        sessions.remove(&session_id);
        Ok(())
    }

    async fn get_router_rtp_capabilities(
        &self,
        session_id: Uuid,
    ) -> Result<RouterRtpCapabilities, MediaError> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;
        let caps = session.router.rtp_capabilities().clone();
        let json = serde_json::to_value(&caps)
            .map_err(|e| MediaError::Internal(format!("serialize rtp caps: {e}")))?;
        Ok(RouterRtpCapabilities(json))
    }

    async fn create_webrtc_transport(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        direction: TransportDirection,
    ) -> Result<WebRtcTransportParams, MediaError> {
        let listen_info = self.listen_info()?;
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;

        let mut options =
            WebRtcTransportOptions::new(WebRtcTransportListenInfos::new(listen_info));
        options.enable_udp = true;
        options.enable_tcp = true;
        options.prefer_udp = true;

        let transport = session
            .router
            .create_webrtc_transport(options)
            .await
            .map_err(|e| MediaError::Internal(format!("create transport: {e}")))?;

        let id = transport.id().to_string();
        let ice_parameters = serde_json::to_value(transport.ice_parameters())
            .map_err(|e| MediaError::Internal(format!("{e}")))?;
        let ice_candidates = serde_json::to_value(transport.ice_candidates())
            .map_err(|e| MediaError::Internal(format!("{e}")))?;
        let dtls_parameters = serde_json::to_value(transport.dtls_parameters())
            .map_err(|e| MediaError::Internal(format!("{e}")))?;

        let participant = session
            .participants
            .get_mut(&user_id)
            .ok_or(MediaError::ParticipantNotFound(user_id))?;
        match direction {
            TransportDirection::Send => participant.send_transport = Some(transport),
            TransportDirection::Recv => participant.recv_transport = Some(transport),
        }

        Ok(WebRtcTransportParams {
            id,
            ice_parameters,
            ice_candidates,
            dtls_parameters,
        })
    }

    async fn connect_webrtc_transport(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        transport_id: String,
        dtls_parameters: ClientDtlsParameters,
    ) -> Result<(), MediaError> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;
        let participant = session
            .participants
            .get(&user_id)
            .ok_or(MediaError::ParticipantNotFound(user_id))?;

        let transport = participant
            .send_transport
            .as_ref()
            .filter(|t| t.id().to_string() == transport_id)
            .or_else(|| {
                participant
                    .recv_transport
                    .as_ref()
                    .filter(|t| t.id().to_string() == transport_id)
            })
            .ok_or_else(|| MediaError::Internal(format!("transport not found: {transport_id}")))?;

        let dtls: DtlsParameters = serde_json::from_value(dtls_parameters.0)
            .map_err(|e| MediaError::Internal(format!("parse dtls: {e}")))?;

        transport
            .connect(WebRtcTransportRemoteParameters { dtls_parameters: dtls })
            .await
            .map_err(|e| MediaError::Internal(format!("transport connect: {e}")))?;

        Ok(())
    }

    async fn produce(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        params: ProduceParams,
    ) -> Result<String, MediaError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;
        let participant = session
            .participants
            .get_mut(&user_id)
            .ok_or(MediaError::ParticipantNotFound(user_id))?;
        let transport = participant
            .send_transport
            .as_ref()
            .filter(|t| t.id().to_string() == params.transport_id)
            .ok_or_else(|| MediaError::Internal("send transport not found".into()))?;

        let kind = match params.kind.as_str() {
            "audio" => MediaKind::Audio,
            "video" => MediaKind::Video,
            _ => {
                return Err(MediaError::Internal(format!(
                    "unknown kind: {}",
                    params.kind
                )));
            }
        };

        let rtp_parameters: RtpParameters = serde_json::from_value(params.rtp_parameters)
            .map_err(|e| MediaError::Internal(format!("parse rtp params: {e}")))?;

        let producer = transport
            .produce(ProducerOptions::new(kind, rtp_parameters))
            .await
            .map_err(|e| MediaError::Internal(format!("produce: {e}")))?;

        let id = producer.id().to_string();
        participant.producers.insert(producer.id(), producer);
        Ok(id)
    }

    async fn consume(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        params: ConsumeParams,
    ) -> Result<ConsumerInfo, MediaError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;

        let producer_id: ProducerId = params
            .producer_id
            .parse()
            .map_err(|_| MediaError::Internal("invalid producer id".into()))?;
        let rtp_capabilities: RtpCapabilities = serde_json::from_value(params.rtp_capabilities)
            .map_err(|e| MediaError::Internal(format!("parse caps: {e}")))?;

        if !session
            .router
            .can_consume(&producer_id, &rtp_capabilities)
        {
            return Err(MediaError::Internal(
                "router cannot consume this producer".into(),
            ));
        }

        let participant = session
            .participants
            .get_mut(&user_id)
            .ok_or(MediaError::ParticipantNotFound(user_id))?;
        let transport = participant
            .recv_transport
            .as_ref()
            .filter(|t| t.id().to_string() == params.transport_id)
            .ok_or_else(|| MediaError::Internal("recv transport not found".into()))?;

        let mut options = ConsumerOptions::new(producer_id, rtp_capabilities);
        options.paused = true;

        let consumer = transport
            .consume(options)
            .await
            .map_err(|e| MediaError::Internal(format!("consume: {e}")))?;

        let info = ConsumerInfo {
            id: consumer.id().to_string(),
            producer_id: consumer.producer_id().to_string(),
            kind: match consumer.kind() {
                MediaKind::Audio => "audio".to_string(),
                MediaKind::Video => "video".to_string(),
            },
            rtp_parameters: serde_json::to_value(consumer.rtp_parameters())
                .map_err(|e| MediaError::Internal(format!("{e}")))?,
        };
        participant.consumers.insert(consumer.id(), consumer);
        Ok(info)
    }

    async fn resume_consumer(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        consumer_id: String,
    ) -> Result<(), MediaError> {
        let cid: ConsumerId = consumer_id
            .parse()
            .map_err(|_| MediaError::Internal("invalid consumer id".into()))?;
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;
        let participant = session
            .participants
            .get(&user_id)
            .ok_or(MediaError::ParticipantNotFound(user_id))?;
        let consumer = participant
            .consumers
            .get(&cid)
            .ok_or_else(|| MediaError::Internal("consumer not found".into()))?;
        consumer
            .resume()
            .await
            .map_err(|e| MediaError::Internal(format!("resume consumer: {e}")))?;
        Ok(())
    }

    async fn close_producer(
        &self,
        session_id: Uuid,
        _user_id: Uuid,
        producer_id: String,
    ) -> Result<(), MediaError> {
        let pid: ProducerId = producer_id
            .parse()
            .map_err(|_| MediaError::Internal("invalid producer id".into()))?;
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or(MediaError::SessionNotFound(session_id))?;
        for p in session.participants.values_mut() {
            if p.producers.remove(&pid).is_some() {
                return Ok(());
            }
        }
        Err(MediaError::Internal("producer not found".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn mediasoup_runtime_init_and_transport() {
        let svc = MediasoupMediaService::new("127.0.0.1".to_string(), 40_000, 40_100);
        let session_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        svc.create_session(session_id).await.expect("create_session");
        svc.add_participant(session_id, user_id, ParticipantRole::Teacher)
            .await
            .expect("add_participant");

        let caps = svc
            .get_router_rtp_capabilities(session_id)
            .await
            .expect("rtp caps");
        assert!(!caps.0.is_null());

        let t = svc
            .create_webrtc_transport(session_id, user_id, TransportDirection::Send)
            .await
            .expect("create send transport");
        assert!(!t.id.is_empty());
        assert!(!t.ice_parameters.is_null());
        assert!(!t.dtls_parameters.is_null());
    }
}
