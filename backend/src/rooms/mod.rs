// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use std::collections::HashMap;

use axum::extract::ws::Message;
use chrono::{DateTime, Utc};
use tokio::sync::mpsc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::api::ws::messages::{AyahPosition, ParticipantInfo, ServerMessage};

/// In-memory live session state (WebSocket senders).
pub struct SessionState {
    #[allow(dead_code)]
    pub session_id: Uuid,
    pub room_id: Uuid,
    pub teacher_id: Uuid,
    pub participants: HashMap<Uuid, ParticipantState>,
    pub active_reciter_id: Option<Uuid>,
    pub current_ayah: Option<AyahPosition>,
    pub current_page: Option<i32>,
    /// Updated on join, leave, and any client activity (for empty-session idle timeout).
    pub last_activity: DateTime<Utc>,
}

pub struct ParticipantState {
    pub user_id: Uuid,
    pub name: String,
    pub role: String,
    pub is_muted: bool,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub tx: mpsc::UnboundedSender<Message>,
}

pub struct RoomManager {
    sessions: RwLock<HashMap<Uuid, SessionState>>,
}

impl RoomManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    fn is_teacher_user(session: &SessionState, user_id: Uuid) -> bool {
        user_id == session.teacher_id
    }

    /// Adds or replaces a participant's outbound channel.
    /// `max_participants` is typically `max_students + 1` (teacher + students).
    /// If `user_id` is already connected, the old WebSocket receives an error and is replaced (latest tab wins).
    #[allow(clippy::too_many_arguments)]
    pub async fn join_session(
        &self,
        session_id: Uuid,
        room_id: Uuid,
        teacher_id: Uuid,
        user_id: Uuid,
        name: String,
        role: String,
        tx: mpsc::UnboundedSender<Message>,
        max_participants: usize,
    ) -> Result<ServerMessage, &'static str> {
        let mut guard = self.sessions.write().await;
        let session = guard.entry(session_id).or_insert_with(|| SessionState {
            session_id,
            room_id,
            teacher_id,
            participants: HashMap::new(),
            active_reciter_id: None,
            current_ayah: None,
            current_page: None,
            last_activity: Utc::now(),
        });

        if session.room_id != room_id || session.teacher_id != teacher_id {
            return Err("session_mismatch");
        }

        if let Some(old) = session.participants.remove(&user_id) {
            let _ = Self::send_json(
                &old.tx,
                &ServerMessage::Error {
                    message: "Connected from another tab".to_string(),
                },
            );
        } else if session.participants.len() >= max_participants {
            return Err("room_full");
        }

        session.last_activity = Utc::now();

        let joined_at = Utc::now();
        let is_teacher = role == "teacher";
        let is_muted = !is_teacher;

        session.participants.insert(
            user_id,
            ParticipantState {
                user_id,
                name: name.clone(),
                role: role.clone(),
                is_muted,
                joined_at,
                tx,
            },
        );

        RoomManager::apply_classroom_mute_rules(session);

        Ok(ServerMessage::RoomState {
            participants: Self::participant_infos(session),
            active_reciter_id: session.active_reciter_id,
            current_ayah: session.current_ayah.clone(),
            current_page: session.current_page,
            session_id,
            room_id,
        })
    }

    fn participant_infos(session: &SessionState) -> Vec<ParticipantInfo> {
        let mut v: Vec<ParticipantInfo> = session
            .participants
            .values()
            .map(|p| ParticipantInfo {
                user_id: p.user_id,
                name: p.name.clone(),
                role: p.role.clone(),
                is_muted: p.is_muted,
                joined_at: p.joined_at,
            })
            .collect();
        v.sort_by_key(|p| p.joined_at);
        v
    }

    /// Enforces: non-reciter students muted; teacher never auto-muted by rules here.
    fn apply_classroom_mute_rules(session: &mut SessionState) {
        let reciter = session.active_reciter_id;
        let teacher_id = session.teacher_id;
        let uids: Vec<Uuid> = session.participants.keys().copied().collect();
        for uid in uids {
            if uid == teacher_id {
                continue;
            }
            if let Some(p) = session.participants.get_mut(&uid) {
                p.is_muted = Some(uid) != reciter;
            }
        }
    }

    pub async fn leave_session(&self, session_id: Uuid, user_id: Uuid) {
        let mut guard = self.sessions.write().await;
        let Some(session) = guard.get_mut(&session_id) else {
            return;
        };
        session.participants.remove(&user_id);
        session.last_activity = Utc::now();
        if session.active_reciter_id == Some(user_id) {
            session.active_reciter_id = None;
        }
    }

    pub async fn touch_activity(&self, session_id: Uuid) {
        let mut guard = self.sessions.write().await;
        if let Some(session) = guard.get_mut(&session_id) {
            session.last_activity = Utc::now();
        }
    }

    /// Sessions with no participants whose last activity is older than the cutoff (e.g. 10 minutes ago).
    pub async fn inactive_empty_sessions(&self, idle_before: DateTime<Utc>) -> Vec<Uuid> {
        let guard = self.sessions.read().await;
        guard
            .iter()
            .filter(|(_, s)| s.participants.is_empty() && s.last_activity < idle_before)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Active reciter after any room mutation (e.g. sync SFU after leave).
    pub async fn get_active_reciter(&self, session_id: Uuid) -> Option<Uuid> {
        let guard = self.sessions.read().await;
        guard
            .get(&session_id)
            .and_then(|s| s.active_reciter_id)
    }

    fn send_json(
        tx: &mpsc::UnboundedSender<Message>,
        msg: &ServerMessage,
    ) -> Result<(), ()> {
        let text = msg.to_ws_text().map_err(|_| ())?;
        tx.send(Message::Text(text.into())).map_err(|_| ())
    }

    pub async fn broadcast(
        &self,
        session_id: Uuid,
        message: &ServerMessage,
        exclude_user_id: Option<Uuid>,
    ) {
        let guard = self.sessions.read().await;
        let Some(session) = guard.get(&session_id) else {
            return;
        };
        for (uid, p) in &session.participants {
            if exclude_user_id == Some(*uid) {
                continue;
            }
            let _ = Self::send_json(&p.tx, message);
        }
    }

    pub async fn send_to(&self, session_id: Uuid, user_id: Uuid, message: &ServerMessage) {
        let guard = self.sessions.read().await;
        let Some(session) = guard.get(&session_id) else {
            return;
        };
        let Some(p) = session.participants.get(&user_id) else {
            return;
        };
        let _ = Self::send_json(&p.tx, message);
    }

    pub async fn send_error(&self, session_id: Uuid, user_id: Uuid, message: impl Into<String>) {
        let msg = ServerMessage::Error {
            message: message.into(),
        };
        self.send_to(session_id, user_id, &msg).await;
    }

    pub async fn set_active_reciter(
        &self,
        session_id: Uuid,
        new_reciter: Uuid,
        requester_id: Uuid,
    ) -> Result<(), &'static str> {
        let mut guard = self.sessions.write().await;
        let session = guard
            .get_mut(&session_id)
            .ok_or("no_session")?;

        if !Self::is_teacher_user(session, requester_id) {
            return Err("forbidden");
        }

        if !session.participants.contains_key(&new_reciter) {
            return Err("unknown_user");
        }

        session.active_reciter_id = Some(new_reciter);
        Self::apply_classroom_mute_rules(session);

        let reciter_msg = ServerMessage::ReciterChanged {
            user_id: session.active_reciter_id,
        };
        for p in session.participants.values() {
            let _ = Self::send_json(&p.tx, &reciter_msg);
        }
        for p in session.participants.values() {
            let m = ServerMessage::MuteChanged {
                user_id: p.user_id,
                muted: p.is_muted,
            };
            let _ = Self::send_json(&p.tx, &m);
        }
        Ok(())
    }

    pub async fn clear_active_reciter(
        &self,
        session_id: Uuid,
        requester_id: Uuid,
    ) -> Result<(), &'static str> {
        let mut guard = self.sessions.write().await;
        let session = guard
            .get_mut(&session_id)
            .ok_or("no_session")?;

        if !Self::is_teacher_user(session, requester_id) {
            return Err("forbidden");
        }

        session.active_reciter_id = None;
        Self::apply_classroom_mute_rules(session);

        let reciter_msg = ServerMessage::ReciterChanged {
            user_id: session.active_reciter_id,
        };
        for p in session.participants.values() {
            let _ = Self::send_json(&p.tx, &reciter_msg);
        }
        for p in session.participants.values() {
            let m = ServerMessage::MuteChanged {
                user_id: p.user_id,
                muted: p.is_muted,
            };
            let _ = Self::send_json(&p.tx, &m);
        }
        Ok(())
    }

    pub async fn set_mute(
        &self,
        session_id: Uuid,
        user_id: Uuid,
        muted: bool,
    ) -> Result<(), &'static str> {
        let mut guard = self.sessions.write().await;
        let session = guard
            .get_mut(&session_id)
            .ok_or("no_session")?;

        let teacher_id = session.teacher_id;
        let active_reciter = session.active_reciter_id;
        let Some(p) = session.participants.get_mut(&user_id) else {
            return Err("not_in_session");
        };

        if user_id == teacher_id {
            p.is_muted = muted;
        } else if active_reciter != Some(user_id) {
            if !muted {
                return Err("cannot_unmute");
            }
            p.is_muted = true;
        } else {
            p.is_muted = muted;
        }

        let m = ServerMessage::MuteChanged { user_id, muted: p.is_muted };
        drop(guard);
        self.broadcast(session_id, &m, None).await;
        Ok(())
    }

    pub async fn set_current_ayah(
        &self,
        session_id: Uuid,
        surah: i32,
        ayah: i32,
        requester_id: Uuid,
    ) -> Result<(), &'static str> {
        let mut guard = self.sessions.write().await;
        let session = guard
            .get_mut(&session_id)
            .ok_or("no_session")?;

        if !Self::is_teacher_user(session, requester_id) {
            return Err("forbidden");
        }

        session.current_ayah = Some(AyahPosition { surah, ayah });
        let msg = ServerMessage::CurrentAyah { surah, ayah };
        drop(guard);
        self.broadcast(session_id, &msg, None).await;
        Ok(())
    }

    pub async fn clear_current_ayah(
        &self,
        session_id: Uuid,
        requester_id: Uuid,
    ) -> Result<(), &'static str> {
        let mut guard = self.sessions.write().await;
        let session = guard
            .get_mut(&session_id)
            .ok_or("no_session")?;

        if !Self::is_teacher_user(session, requester_id) {
            return Err("forbidden");
        }

        session.current_ayah = None;
        let msg = ServerMessage::AyahCleared;
        drop(guard);
        self.broadcast(session_id, &msg, None).await;
        Ok(())
    }

    pub async fn set_current_page(
        &self,
        session_id: Uuid,
        page: i32,
        requester_id: Uuid,
    ) -> Result<(), &'static str> {
        if !(1..=604).contains(&page) {
            return Err("invalid_page");
        }
        let mut guard = self.sessions.write().await;
        let session = guard
            .get_mut(&session_id)
            .ok_or("no_session")?;

        if !Self::is_teacher_user(session, requester_id) {
            return Err("forbidden");
        }

        session.current_page = Some(page);
        let msg = ServerMessage::CurrentPage { page };
        drop(guard);
        self.broadcast(session_id, &msg, None).await;
        Ok(())
    }

    /// Broadcast `session-ended`, drop all senders, remove session.
    pub async fn close_session(&self, session_id: Uuid) {
        let mut guard = self.sessions.write().await;
        let Some(mut session) = guard.remove(&session_id) else {
            return;
        };

        let ended = ServerMessage::SessionEnded;
        let text = match ended.to_ws_text() {
            Ok(t) => t,
            Err(_) => return,
        };

        for (_uid, p) in session.participants.drain() {
            let _ = p.tx.send(Message::Text(text.clone().into()));
        }
    }
}

impl Default for RoomManager {
    fn default() -> Self {
        Self::new()
    }
}
