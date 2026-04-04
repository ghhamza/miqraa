// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use uuid::Uuid;

/// Represents an SFU session for a single room
#[allow(dead_code)]
pub struct SfuSession {
    pub room_id: Uuid,
    // TODO: webrtc::peer_connection management
    // TODO: Track forwarding logic
}

#[allow(dead_code)]
impl SfuSession {
    pub fn new(room_id: Uuid) -> Self {
        Self { room_id }
    }
}
