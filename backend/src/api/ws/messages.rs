// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::types::ErrorAnnotationPublic;

/// Client → server messages. `offer` / `target` are kept for wire compatibility; SFU path ignores offers.
#[derive(Deserialize)]
#[serde(tag = "type")]
#[allow(dead_code)]
pub enum ClientMessage {
    #[serde(rename = "offer")]
    Offer { sdp: String, target: Option<Uuid> },

    #[serde(rename = "answer")]
    Answer { sdp: String, target: Option<Uuid> },

    #[serde(rename = "ice-candidate")]
    IceCandidate { candidate: String, target: Option<Uuid> },

    #[serde(rename = "mute")]
    Mute { muted: bool },

    #[serde(rename = "set-reciter")]
    SetReciter { user_id: Uuid },

    #[serde(rename = "clear-reciter")]
    ClearReciter,

    #[serde(rename = "current-ayah")]
    CurrentAyah { surah: i32, ayah: i32 },

    #[serde(rename = "clear-ayah")]
    ClearAyah,

    #[serde(rename = "current-page")]
    CurrentPage { page: i32 },

    #[serde(rename = "grade-notification")]
    GradeNotification {
        student_id: Uuid,
        grade: String,
        notes: Option<String>,
    },

    #[serde(rename = "create-annotation")]
    CreateAnnotation {
        recitation_id: Uuid,
        surah: i32,
        ayah: i32,
        word_position: Option<i32>,
        error_severity: String,
        error_category: String,
        teacher_comment: Option<String>,
        annotation_kind: String,
    },

    #[serde(rename = "remove-annotation")]
    RemoveAnnotation { annotation_id: Uuid },

    #[serde(rename = "ping")]
    Ping,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "room-state")]
    RoomState {
        participants: Vec<ParticipantInfo>,
        active_reciter_id: Option<Uuid>,
        current_ayah: Option<AyahPosition>,
        current_page: Option<i32>,
        session_id: Uuid,
        room_id: Uuid,
    },

    #[serde(rename = "user-joined")]
    UserJoined { user: ParticipantInfo },

    #[serde(rename = "user-left")]
    UserLeft { user_id: Uuid },

    #[serde(rename = "reciter-changed")]
    ReciterChanged { user_id: Option<Uuid> },

    #[serde(rename = "mute-changed")]
    MuteChanged { user_id: Uuid, muted: bool },

    #[serde(rename = "current-ayah")]
    CurrentAyah { surah: i32, ayah: i32 },

    #[serde(rename = "ayah-cleared")]
    AyahCleared,

    #[serde(rename = "current-page")]
    CurrentPage { page: i32 },

    #[serde(rename = "offer")]
    Offer { sdp: String, from: Uuid },

    /// Reserved for legacy P2P; SFU uses client `answer` only.
    #[allow(dead_code)]
    #[serde(rename = "answer")]
    Answer { sdp: String, from: Uuid },

    #[serde(rename = "ice-candidate")]
    IceCandidate { candidate: String, from: Uuid },

    #[serde(rename = "error")]
    Error { message: String },

    #[serde(rename = "pong")]
    Pong,

    #[serde(rename = "session-ended")]
    SessionEnded,

    #[serde(rename = "grade-notification")]
    GradeNotification { grade: String, notes: Option<String> },

    #[serde(rename = "annotation-added")]
    AnnotationAdded { annotation: ErrorAnnotationPublic },

    #[serde(rename = "annotation-removed")]
    AnnotationRemoved { annotation_id: Uuid },
}

#[derive(Serialize, Clone)]
pub struct ParticipantInfo {
    pub user_id: Uuid,
    pub name: String,
    pub role: String,
    pub is_muted: bool,
    pub joined_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AyahPosition {
    pub surah: i32,
    pub ayah: i32,
}

impl ServerMessage {
    pub fn to_ws_text(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}
