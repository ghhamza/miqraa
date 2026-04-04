// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

//! Al-Miqraa (المقرأ) SFU — Selective Forwarding Unit for audio/video
//!
//! - Each live session has one SFU session (`WebRtcSfu`)
//! - Opus / VP8 RTP passthrough — no transcoding

pub mod media_service;
pub mod webrtc_sfu;

#[allow(unused_imports)]
pub use media_service::{MediaError, MediaService, ParticipantRole, SfuServerEvent};
pub use webrtc_sfu::WebRtcSfu;
