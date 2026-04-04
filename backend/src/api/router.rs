// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use super::handlers;
use super::ws;
use super::AppState;

pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(|| async { "بسم الله — Al-Miqraa is running" }))
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/login", post(handlers::auth::login))
        .route(
            "/api/auth/me",
            get(handlers::auth::me).put(handlers::auth::update_profile),
        )
        .route("/api/auth/password", put(handlers::auth::change_password))
        .route("/api/users/stats", get(handlers::users::stats))
        .route(
            "/api/users",
            get(handlers::users::list_users).post(handlers::users::create_user),
        )
        .route(
            "/api/users/{id}",
            get(handlers::users::get_user)
                .put(handlers::users::update_user)
                .delete(handlers::users::delete_user),
        )
        .route(
            "/api/students/{student_id}/recitations",
            get(handlers::recitations::list_by_student),
        )
        .route(
            "/api/students/{student_id}/progress",
            get(handlers::recitations::student_progress),
        )
        .route("/api/students", get(handlers::enrollments::list_students))
        .route("/api/recitations/stats", get(handlers::recitations::stats))
        .route(
            "/api/recitations",
            get(handlers::recitations::list_recitations).post(handlers::recitations::create_recitation),
        )
        .route(
            "/api/recitations/{id}",
            get(handlers::recitations::get_recitation)
                .put(handlers::recitations::update_recitation)
                .delete(handlers::recitations::delete_recitation),
        )
        .route("/api/rooms/stats", get(handlers::rooms::room_stats))
        .route("/api/teachers", get(handlers::rooms::list_teachers))
        .route(
            "/api/rooms/{room_id}/enrollments/count",
            get(handlers::enrollments::enrollment_count),
        )
        .route(
            "/api/rooms/{room_id}/join",
            post(handlers::enrollments::join_room),
        )
        .route(
            "/api/rooms/{room_id}/my-enrollment",
            get(handlers::enrollments::my_enrollment).delete(handlers::enrollments::cancel_my_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/enrollments/pending",
            get(handlers::enrollments::list_pending_enrollments),
        )
        .route(
            "/api/rooms/{room_id}/enrollments/{enrollment_id}/approve",
            put(handlers::enrollments::approve_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/enrollments/{enrollment_id}/reject",
            put(handlers::enrollments::reject_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/enrollments/{enrollment_id}",
            axum::routing::delete(handlers::enrollments::delete_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/enrollments",
            get(handlers::enrollments::list_enrollments).post(handlers::enrollments::create_enrollment),
        )
        .route(
            "/api/rooms/{room_id}/sessions",
            get(handlers::sessions::list_for_room),
        )
        .route(
            "/api/rooms/{room_id}/schedules",
            get(handlers::schedules::list_schedules),
        )
        .route(
            "/api/schedules/batch",
            post(handlers::schedules::create_batch_schedules),
        )
        .route(
            "/api/schedules/generate",
            post(handlers::schedules::generate_sessions),
        )
        .route(
            "/api/schedules",
            post(handlers::schedules::create_schedule),
        )
        .route(
            "/api/schedules/{id}",
            put(handlers::schedules::update_schedule).delete(handlers::schedules::delete_schedule),
        )
        .route(
            "/api/sessions/stats",
            get(handlers::sessions::session_stats),
        )
        .route(
            "/api/sessions/upcoming",
            get(handlers::sessions::upcoming),
        )
        .route(
            "/api/sessions/group/{group_id}",
            delete(handlers::sessions::delete_recurrence_group),
        )
        .route(
            "/api/sessions",
            get(handlers::sessions::list_sessions).post(handlers::sessions::create_session),
        )
        .route(
            "/api/sessions/{id}",
            get(handlers::sessions::get_session)
                .put(handlers::sessions::update_session)
                .delete(handlers::sessions::delete_session),
        )
        .route(
            "/api/sessions/{id}/attendance",
            put(handlers::sessions::update_attendance),
        )
        .route(
            "/api/rooms",
            get(handlers::rooms::list_rooms).post(handlers::rooms::create_room),
        )
        .route(
            "/api/rooms/{id}",
            get(handlers::rooms::get_room)
                .put(handlers::rooms::update_room)
                .delete(handlers::rooms::delete_room),
        )
        .route(
            "/api/ws/session/{session_id}",
            get(ws::signaling::ws_session_handler),
        )
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
