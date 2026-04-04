// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

/// Audio track forwarding logic
/// Opus passthrough — no transcoding to preserve recitation quality
#[allow(dead_code)]
pub struct AudioTrack {
    pub ssrc: u32,
    pub participant_id: uuid::Uuid,
}
