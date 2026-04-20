// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use livekit_api::access_token::VideoGrants;

/// Role of a participant within a specific live session.
/// This is not the same as `users.role`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionRole {
    Teacher,
    ActiveReciter,
    Student,
    Admin,
}

impl SessionRole {
    /// Miqraa's classroom model: teacher + active reciter can publish,
    /// everyone else listens.
    pub fn to_video_grants(self, room: &str) -> VideoGrants {
        let can_publish = matches!(self, Self::Teacher | Self::ActiveReciter);
        VideoGrants {
            room_join: true,
            room: room.to_string(),
            can_publish,
            can_subscribe: true,
            can_publish_data: true,
            ..Default::default()
        }
    }
}
