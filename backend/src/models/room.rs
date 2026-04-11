// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub name: String,
    pub teacher_id: Uuid,
    pub max_students: i32,
    pub is_active: bool,
    pub riwaya: String,
    pub halaqah_type: String,
    pub is_public: bool,
    pub enrollment_open: bool,
    pub requires_approval: bool,
    pub created_at: DateTime<Utc>,
}
