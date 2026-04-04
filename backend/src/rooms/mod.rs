// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use std::collections::HashMap;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::api::ws::signaling::SignalMessage;

#[derive(Debug)]
pub struct Participant {
    #[allow(dead_code)]
    pub user_id: Uuid,
    pub is_muted: bool,
    pub is_active_reciter: bool,
}

#[derive(Debug, Default)]
pub struct RoomState {
    pub participants: HashMap<Uuid, Participant>,
    pub active_reciter: Option<Uuid>,
}

pub struct RoomManager {
    rooms: RwLock<HashMap<Uuid, RoomState>>,
}

impl RoomManager {
    pub fn new() -> Self {
        Self {
            rooms: RwLock::new(HashMap::new()),
        }
    }

    pub async fn handle_signal(&self, room_id: Uuid, signal: SignalMessage) {
        let mut rooms = self.rooms.write().await;
        let room = rooms.entry(room_id).or_insert_with(RoomState::default);

        match signal {
            SignalMessage::Join { user_id, .. } => {
                room.participants.insert(
                    user_id,
                    Participant {
                        user_id,
                        is_muted: true,
                        is_active_reciter: false,
                    },
                );
                tracing::info!("User {} joined room {}", user_id, room_id);
            }
            SignalMessage::ActiveReciter { user_id } => {
                if let Some(prev) = room.active_reciter {
                    if let Some(p) = room.participants.get_mut(&prev) {
                        p.is_active_reciter = false;
                        p.is_muted = true;
                    }
                }
                room.active_reciter = Some(user_id);
                if let Some(p) = room.participants.get_mut(&user_id) {
                    p.is_active_reciter = true;
                    p.is_muted = false;
                }
                tracing::info!(
                    "User {} is now the active reciter in room {}",
                    user_id,
                    room_id
                );
            }
            _ => {}
        }
    }
}
