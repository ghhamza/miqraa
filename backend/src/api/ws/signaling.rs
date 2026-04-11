// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use sqlx::PgPool;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::api::ws::messages::{ClientMessage, ServerMessage};
use crate::api::AppState;
use crate::auth::jwt::verify_token;
use crate::sfu::ParticipantRole;

#[derive(Deserialize)]
pub struct WsTokenQuery {
    pub token: String,
}

struct SessionJoinMeta {
    room_id: Uuid,
    teacher_id: Uuid,
    user_name: String,
    /// Participant role for `ParticipantInfo`: `"teacher"` | `"student"`.
    participant_role: String,
    /// Whether to update `session_attendance` on join/leave.
    track_attendance: bool,
    max_students: i32,
}

async fn load_session_join_meta(
    pool: &PgPool,
    session_id: Uuid,
    user_id: Uuid,
    jwt_role: &str,
) -> Result<SessionJoinMeta, StatusCode> {
    let row: Option<(Uuid, Uuid, String, i32)> = sqlx::query_as(
        "SELECT s.room_id, r.teacher_id, s.status::text, r.max_students \
         FROM sessions s \
         INNER JOIN rooms r ON r.id = s.room_id \
         WHERE s.id = $1",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "session lookup failed");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let (room_id, teacher_id, status, max_students) = row.ok_or(StatusCode::NOT_FOUND)?;

    if status != "in_progress" {
        tracing::warn!(%session_id, %status, "session not in progress");
        return Err(StatusCode::FORBIDDEN);
    }

    if jwt_role == "admin" {
        let name: String = sqlx::query_scalar("SELECT name FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
        return Ok(SessionJoinMeta {
            room_id,
            teacher_id,
            user_name: name,
            participant_role: "teacher".to_string(),
            track_attendance: false,
            max_students,
        });
    }

    if user_id == teacher_id {
        let name: String = sqlx::query_scalar("SELECT name FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
        return Ok(SessionJoinMeta {
            room_id,
            teacher_id,
            user_name: name,
            participant_role: "teacher".to_string(),
            track_attendance: false,
            max_students,
        });
    }

    let enrolled: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM enrollments \
         WHERE room_id = $1 AND student_id = $2 AND status = 'approved')",
    )
    .bind(room_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !enrolled {
        tracing::warn!(%user_id, %room_id, "user not enrolled");
        return Err(StatusCode::FORBIDDEN);
    }

    let name: String = sqlx::query_scalar("SELECT name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(SessionJoinMeta {
        room_id,
        teacher_id,
        user_name: name,
        participant_role: "student".to_string(),
        track_attendance: true,
        max_students,
    })
}

async fn record_attendance_join(pool: &PgPool, session_id: Uuid, student_id: Uuid) {
    let r = sqlx::query(
        "UPDATE session_attendance SET attended = true, \
         joined_at = COALESCE(joined_at, NOW()) \
         WHERE session_id = $1 AND student_id = $2",
    )
    .bind(session_id)
    .bind(student_id)
    .execute(pool)
    .await;

    if let Ok(exec) = r {
        if exec.rows_affected() == 0 {
            let _ = sqlx::query(
                "INSERT INTO session_attendance (session_id, student_id, attended, joined_at) \
                 VALUES ($1, $2, true, NOW()) \
                 ON CONFLICT (session_id, student_id) DO UPDATE SET \
                 attended = true, \
                 joined_at = COALESCE(session_attendance.joined_at, EXCLUDED.joined_at)",
            )
            .bind(session_id)
            .bind(student_id)
            .execute(pool)
            .await;
        }
    }
}

async fn record_attendance_leave(pool: &PgPool, session_id: Uuid, student_id: Uuid) {
    let _ = sqlx::query(
        "UPDATE session_attendance SET left_at = NOW() \
         WHERE session_id = $1 AND student_id = $2",
    )
    .bind(session_id)
    .bind(student_id)
    .execute(pool)
    .await;
}

/// Called when a session ends via REST — closes sockets and attendance.
pub async fn on_session_ended(state: &AppState, session_id: Uuid) {
    if let Err(e) = state.media_service.close_session(session_id).await {
        tracing::warn!(error = %e, "media close_session");
    }
    state.rooms.close_session(session_id).await;
    let _ = sqlx::query(
        "UPDATE session_attendance SET left_at = NOW() \
         WHERE session_id = $1 AND left_at IS NULL",
    )
    .bind(session_id)
    .execute(&state.db)
    .await;
}

pub async fn ws_session_handler(
    ws: WebSocketUpgrade,
    Path(session_id): Path<Uuid>,
    Query(query): Query<WsTokenQuery>,
    State(state): State<AppState>,
) -> Result<Response, (StatusCode, String)> {
    let claims = verify_token(&query.token, &state.config.jwt_secret).map_err(|e| {
        tracing::warn!(error = %e, "ws jwt invalid");
        (StatusCode::UNAUTHORIZED, "Invalid or expired token".to_string())
    })?;

    let meta = load_session_join_meta(&state.db, session_id, claims.sub, &claims.role)
        .await
        .map_err(|s| {
            let msg = match s {
                StatusCode::NOT_FOUND => "not_found",
                StatusCode::FORBIDDEN => "forbidden",
                StatusCode::UNAUTHORIZED => "unauthorized",
                _ => "error",
            };
            (s, msg.to_string())
        })?;

    tracing::info!(
        %session_id,
        user_id = %claims.sub,
        "WebSocket session upgrade authorized"
    );

    Ok(ws.on_upgrade(move |socket| {
        handle_socket(
            socket,
            state,
            session_id,
            claims.sub,
            meta,
        )
    }))
}

async fn handle_socket(
    socket: WebSocket,
    state: AppState,
    session_id: Uuid,
    user_id: Uuid,
    meta: SessionJoinMeta,
) {
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let max_participants = (meta.max_students as usize).saturating_add(1);

    let initial = match state
        .rooms
        .join_session(
            session_id,
            meta.room_id,
            meta.teacher_id,
            user_id,
            meta.user_name.clone(),
            meta.participant_role.clone(),
            tx.clone(),
            max_participants,
        )
        .await
    {
        Ok(m) => m,
        Err(e) => {
            tracing::warn!(err = e, "join_session failed");
            let mut socket = socket;
            let msg = match e {
                "room_full" => ServerMessage::Error {
                    message: "Room is full".to_string(),
                },
                "session_mismatch" => ServerMessage::Error {
                    message: "Session mismatch".to_string(),
                },
                _ => ServerMessage::Error {
                    message: "Could not join session".to_string(),
                },
            };
            if let Ok(text) = msg.to_ws_text() {
                let _ = socket.send(Message::Text(text.into())).await;
            }
            let _ = socket.close().await;
            return;
        }
    };

    if meta.track_attendance {
        record_attendance_join(&state.db, session_id, user_id).await;
    }

    if let Ok(text) = initial.to_ws_text() {
        let _ = tx.send(Message::Text(text.into()));
    }

    let self_info = match &initial {
        ServerMessage::RoomState { participants, .. } => participants
            .iter()
            .find(|p| p.user_id == user_id)
            .cloned()
            .unwrap_or_else(|| crate::api::ws::messages::ParticipantInfo {
                user_id,
                name: meta.user_name.clone(),
                role: meta.participant_role.clone(),
                is_muted: meta.participant_role != "teacher",
                joined_at: chrono::Utc::now(),
            }),
        _ => crate::api::ws::messages::ParticipantInfo {
            user_id,
            name: meta.user_name.clone(),
            role: meta.participant_role.clone(),
            is_muted: meta.participant_role != "teacher",
            joined_at: chrono::Utc::now(),
        },
    };

    let joined = ServerMessage::UserJoined { user: self_info };
    state.rooms.broadcast(session_id, &joined, Some(user_id)).await;

    let active_reciter_room = match &initial {
        ServerMessage::RoomState {
            active_reciter_id, ..
        } => *active_reciter_id,
        _ => None,
    };

    let media_role = match meta.participant_role.as_str() {
        "teacher" => ParticipantRole::Teacher,
        _ => ParticipantRole::Student,
    };

    if let Err(e) = state.media_service.create_session(session_id).await {
        tracing::warn!(error = %e, "media create_session");
    }

    match state
        .media_service
        .add_participant(session_id, user_id, media_role)
        .await
    {
        Ok(sdp) => {
            let offer = ServerMessage::Offer {
                sdp,
                from: Uuid::nil(),
            };
            if let Ok(text) = offer.to_ws_text() {
                let _ = tx.send(Message::Text(text.into()));
            }
        }
        Err(e) => tracing::warn!(error = %e, "media add_participant"),
    }

    if let Err(e) = state
        .media_service
        .set_active_reciter(session_id, active_reciter_room)
        .await
    {
        tracing::warn!(error = %e, "media set_active_reciter (initial sync)");
    }

    let (mut sink, mut stream) = socket.split();

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    let teacher_id = meta.teacher_id;
    while let Some(result) = stream.next().await {
        match result {
            Ok(Message::Text(text)) => {
                let Ok(msg) = serde_json::from_str::<ClientMessage>(&text) else {
                    continue;
                };
                handle_client_message(
                    &state,
                    session_id,
                    user_id,
                    teacher_id,
                    &msg,
                )
                .await;
            }
            Ok(Message::Ping(p)) => {
                let _ = tx.send(Message::Pong(p));
            }
            Ok(Message::Close(_)) | Err(_) => break,
            _ => {}
        }
    }

    send_task.abort();
    if let Err(e) = state.media_service.remove_participant(session_id, user_id).await {
        tracing::warn!(error = %e, "media remove_participant");
    }
    state.rooms.leave_session(session_id, user_id).await;
    let ar = state.rooms.get_active_reciter(session_id).await;
    if let Err(e) = state
        .media_service
        .set_active_reciter(session_id, ar)
        .await
    {
        tracing::warn!(error = %e, "media set_active_reciter after leave");
    }

    let left = ServerMessage::UserLeft { user_id };
    state.rooms.broadcast(session_id, &left, Some(user_id)).await;

    if meta.track_attendance {
        record_attendance_leave(&state.db, session_id, user_id).await;
    }

    tracing::info!(%session_id, %user_id, "WebSocket session disconnected");
}

async fn handle_client_message(
    state: &AppState,
    session_id: Uuid,
    user_id: Uuid,
    teacher_id: Uuid,
    msg: &ClientMessage,
) {
    state.rooms.touch_activity(session_id).await;
    match msg {
        ClientMessage::Ping => {
            state.rooms.send_to(session_id, user_id, &ServerMessage::Pong).await;
        }
        ClientMessage::Mute { muted } => {
            match state.rooms.set_mute(session_id, user_id, *muted).await {
                Ok(()) => {}
                Err("cannot_unmute") => {
                    state
                        .rooms
                        .send_error(
                            session_id,
                            user_id,
                            "Only the active reciter can unmute",
                        )
                        .await;
                }
                Err(_) => {
                    state
                        .rooms
                        .send_error(session_id, user_id, "Mute failed")
                        .await;
                }
            }
        }
        ClientMessage::SetReciter { user_id: target } => {
            if user_id != teacher_id {
                state
                    .rooms
                    .send_error(session_id, user_id, "Only the teacher can set reciter")
                    .await;
                return;
            }
            if let Err(e) = state
                .rooms
                .set_active_reciter(session_id, *target, user_id)
                .await
            {
                let m = match e {
                    "forbidden" => "Forbidden",
                    "unknown_user" => "User not in session",
                    "no_session" => "Session not found",
                    _ => "set-reciter failed",
                };
                state.rooms.send_error(session_id, user_id, m).await;
            } else if let Err(me) = state
                .media_service
                .set_active_reciter(session_id, Some(*target))
                .await
            {
                tracing::warn!(error = %me, "media set_active_reciter");
            }
        }
        ClientMessage::ClearReciter => {
            if user_id != teacher_id {
                state
                    .rooms
                    .send_error(session_id, user_id, "Only the teacher can clear reciter")
                    .await;
                return;
            }
            if let Err(e) = state
                .rooms
                .clear_active_reciter(session_id, user_id)
                .await
            {
                let m = match e {
                    "forbidden" => "Forbidden",
                    "no_session" => "Session not found",
                    _ => "clear-reciter failed",
                };
                state.rooms.send_error(session_id, user_id, m).await;
            } else if let Err(me) = state
                .media_service
                .set_active_reciter(session_id, None)
                .await
            {
                tracing::warn!(error = %me, "media set_active_reciter after clear");
            }
        }
        ClientMessage::CurrentAyah { surah, ayah } => {
            if user_id != teacher_id {
                state
                    .rooms
                    .send_error(session_id, user_id, "Only the teacher can set ayah")
                    .await;
                return;
            }
            if state
                .rooms
                .set_current_ayah(session_id, *surah, *ayah, user_id)
                .await
                .is_err()
            {
                state
                    .rooms
                    .send_error(session_id, user_id, "current-ayah failed")
                    .await;
            }
        }
        ClientMessage::ClearAyah => {
            if user_id != teacher_id {
                state
                    .rooms
                    .send_error(session_id, user_id, "Only the teacher can clear ayah")
                    .await;
                return;
            }
            if state
                .rooms
                .clear_current_ayah(session_id, user_id)
                .await
                .is_err()
            {
                state
                    .rooms
                    .send_error(session_id, user_id, "clear-ayah failed")
                    .await;
            }
        }
        ClientMessage::CurrentPage { page } => {
            if user_id != teacher_id {
                state
                    .rooms
                    .send_error(session_id, user_id, "Only the teacher can set page")
                    .await;
                return;
            }
            match state
                .rooms
                .set_current_page(session_id, *page, user_id)
                .await
            {
                Ok(()) => {}
                Err("invalid_page") => {
                    state
                        .rooms
                        .send_error(session_id, user_id, "Invalid page")
                        .await;
                }
                Err(_) => {
                    state
                        .rooms
                        .send_error(session_id, user_id, "current-page failed")
                        .await;
                }
            }
        }
        ClientMessage::GradeNotification {
            student_id,
            grade,
            notes,
        } => {
            if user_id != teacher_id {
                state
                    .rooms
                    .send_error(session_id, user_id, "Only the teacher can send grades")
                    .await;
                return;
            }
            let msg = ServerMessage::GradeNotification {
                grade: grade.clone(),
                notes: notes.clone(),
            };
            state
                .rooms
                .send_to(session_id, *student_id, &msg)
                .await;
        }
        ClientMessage::CreateAnnotation {
            recitation_id,
            surah,
            ayah,
            word_position,
            error_severity,
            error_category,
            teacher_comment,
            annotation_kind,
        } => {
            if user_id != teacher_id {
                state
                    .rooms
                    .send_error(session_id, user_id, "Only the teacher can create annotations")
                    .await;
                return;
            }

            let valid_sev = matches!(error_severity.as_str(), "jali" | "khafi");
            let valid_cat = matches!(
                error_category.as_str(),
                "harf" | "haraka" | "kalima" | "waqf_qabih" | "makharij" | "sifat"
                    | "tafkhim" | "madd" | "ghunnah" | "noon_sakin" | "meem_sakin"
                    | "waqf_ibtida" | "shadda" | "other"
            );
            let valid_kind = matches!(
                annotation_kind.as_str(),
                "error" | "repeat" | "good" | "note"
            );
            if !valid_sev || !valid_cat || !valid_kind {
                state
                    .rooms
                    .send_error(session_id, user_id, "Invalid annotation payload")
                    .await;
                return;
            }

            let ctx = match crate::api::handlers::error_annotations_db::fetch_recitation_context(
                &state.db,
                *recitation_id,
            )
            .await
            {
                Ok(Some(ctx)) => ctx,
                _ => {
                    state
                        .rooms
                        .send_error(session_id, user_id, "Recitation not found")
                        .await;
                    return;
                }
            };
            if ctx.0 != Some(teacher_id) {
                state
                    .rooms
                    .send_error(session_id, user_id, "Not your recitation")
                    .await;
                return;
            }

            let input = crate::api::handlers::error_annotations_db::CreateAnnotationInput {
                recitation_id: *recitation_id,
                surah: *surah,
                ayah: *ayah,
                word_position: *word_position,
                error_severity: error_severity.clone(),
                error_category: error_category.clone(),
                teacher_comment: teacher_comment.clone(),
                annotation_kind: annotation_kind.clone(),
            };

            match crate::api::handlers::error_annotations_db::insert_annotation(&state.db, &input).await {
                Ok(outcome) => {
                    for id in &outcome.deleted_ids {
                        let rm = ServerMessage::AnnotationRemoved {
                            annotation_id: *id,
                        };
                        state.rooms.broadcast(session_id, &rm, None).await;
                    }
                    let msg = ServerMessage::AnnotationAdded {
                        annotation: outcome.annotation,
                    };
                    state.rooms.broadcast(session_id, &msg, None).await;
                }
                Err(e) => {
                    tracing::warn!(error = %e, "insert annotation (ws) failed");
                    state
                        .rooms
                        .send_error(session_id, user_id, "Annotation save failed")
                        .await;
                }
            }
        }
        ClientMessage::RemoveAnnotation { annotation_id } => {
            if user_id != teacher_id {
                state
                    .rooms
                    .send_error(session_id, user_id, "Only the teacher can remove annotations")
                    .await;
                return;
            }

            let row = match crate::api::handlers::error_annotations_db::fetch_annotation_for_delete(
                &state.db,
                *annotation_id,
            )
            .await
            {
                Ok(Some(r)) => r,
                _ => {
                    state
                        .rooms
                        .send_error(session_id, user_id, "Annotation not found")
                        .await;
                    return;
                }
            };
            if row.1 != Some(teacher_id) {
                state
                    .rooms
                    .send_error(session_id, user_id, "Not your annotation")
                    .await;
                return;
            }

            match crate::api::handlers::error_annotations_db::delete_annotation_row(
                &state.db,
                *annotation_id,
            )
            .await
            {
                Ok(n) if n > 0 => {
                    let msg = ServerMessage::AnnotationRemoved {
                        annotation_id: *annotation_id,
                    };
                    state.rooms.broadcast(session_id, &msg, None).await;
                }
                _ => {
                    state
                        .rooms
                        .send_error(session_id, user_id, "Annotation delete failed")
                        .await;
                }
            }
        }
        ClientMessage::Offer { .. } => {
            tracing::debug!(%session_id, %user_id, "ignoring client offer (SFU sends offers)");
        }
        ClientMessage::Answer { sdp, .. } => {
            if let Err(e) = state
                .media_service
                .handle_answer(session_id, user_id, sdp.clone())
                .await
            {
                tracing::warn!(error = %e, "media handle_answer");
                state
                    .rooms
                    .send_error(session_id, user_id, "WebRTC answer failed")
                    .await;
            }
        }
        ClientMessage::IceCandidate { candidate, .. } => {
            if let Err(e) = state
                .media_service
                .handle_ice_candidate(session_id, user_id, candidate.clone())
                .await
            {
                tracing::warn!(error = %e, "media handle_ice_candidate");
            }
        }
    }
}
