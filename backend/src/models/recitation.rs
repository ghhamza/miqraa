// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Recitation {
    pub id: Uuid,
    pub student_id: Option<Uuid>,
    pub room_id: Option<Uuid>,
    pub session_id: Option<Uuid>,
    pub surah: i32,
    pub ayah_start: i32,
    pub ayah_end: i32,
    pub grade: Option<String>,
    pub teacher_id: Option<Uuid>,
    pub riwaya: String,
    pub turn_type: String,
    pub pages_count: Option<f64>,
    pub star_rating: Option<i16>,
    pub recording_path: Option<String>,
    pub teacher_notes: Option<String>,
    pub created_at: DateTime<Utc>,
}
