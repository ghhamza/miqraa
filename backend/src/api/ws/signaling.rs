// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::AppState;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SignalMessage {
    #[serde(rename = "join")]
    Join { user_id: Uuid, room_id: Uuid },
    #[serde(rename = "offer")]
    Offer { sdp: String, target: Uuid },
    #[serde(rename = "answer")]
    Answer { sdp: String, target: Uuid },
    #[serde(rename = "ice-candidate")]
    IceCandidate { candidate: String, target: Uuid },
    #[serde(rename = "mute")]
    Mute { user_id: Uuid, muted: bool },
    #[serde(rename = "active-reciter")]
    ActiveReciter { user_id: Uuid },
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<Uuid>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, room_id, state))
}

async fn handle_socket(mut socket: WebSocket, room_id: Uuid, state: AppState) {
    tracing::info!("New WebSocket connection for room {}", room_id);

    while let Some(Ok(msg)) = socket.recv().await {
        match msg {
            Message::Text(text) => {
                if let Ok(signal) = serde_json::from_str::<SignalMessage>(&text) {
                    tracing::debug!("Signal: {:?}", signal);
                    state.rooms.handle_signal(room_id, signal).await;
                }
            }
            Message::Close(_) => {
                tracing::info!("WebSocket closed for room {}", room_id);
                break;
            }
            _ => {}
        }
    }
}
