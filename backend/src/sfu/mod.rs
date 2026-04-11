// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

//! Al-Miqraa (المقرأ) SFU — Selective Forwarding Unit for audio/video
//!
//! - Each live session has one SFU session (`WebRtcSfu`)
//! - Opus / VP8 RTP passthrough — no transcoding

pub mod media_service;
pub mod mediasoup_sfu;
pub mod webrtc_sfu;

#[allow(unused_imports)]
pub use media_service::{
    ConsumeParams, ConsumerInfo, DtlsParameters, MediaError, MediaService, ParticipantRole,
    ProduceParams, RouterRtpCapabilities, SfuServerEvent, TransportDirection, WebRtcTransportParams,
};
pub use mediasoup_sfu::MediasoupMediaService;
pub use webrtc_sfu::WebRtcSfu;
