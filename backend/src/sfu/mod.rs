// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

//! Al-Miqraa (المقرأ) SFU — Selective Forwarding Unit for audio
//!
//! Architecture:
//! - Each room has one SFU session
//! - Audio tracks from the active reciter + teacher are forwarded to all participants
//! - Students are muted by default, unmuted only when they become the active reciter
//! - No audio mixing — pure Opus forwarding to preserve recitation quality

pub mod session;
pub mod track;
