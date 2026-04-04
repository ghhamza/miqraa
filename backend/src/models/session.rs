// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub room_id: Uuid,
    pub title: Option<String>,
    pub scheduled_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub status: String,
    pub notes: Option<String>,
    pub schedule_id: Option<Uuid>,
    pub recurrence_group_id: Option<Uuid>,
    pub recurrence_rule: Option<String>,
    pub created_at: DateTime<Utc>,
}
