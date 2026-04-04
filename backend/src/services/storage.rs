// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

use std::path::PathBuf;

use anyhow::Result;
use uuid::Uuid;

#[derive(Clone)]
pub struct StorageService {
    #[allow(dead_code)]
    base_path: PathBuf,
}

#[allow(dead_code)]
impl StorageService {
    pub fn new(base_path: &str) -> Self {
        Self {
            base_path: PathBuf::from(base_path),
        }
    }

    /// Save a recording to disk. Returns the relative file path.
    pub async fn save_recording(&self, room_id: Uuid, user_id: Uuid, data: &[u8]) -> Result<String> {
        let dir = self.base_path.join(room_id.to_string());
        tokio::fs::create_dir_all(&dir).await?;

        let filename = format!(
            "{}_{}.opus",
            user_id,
            chrono::Utc::now().format("%Y%m%d_%H%M%S")
        );
        let path = dir.join(&filename);
        tokio::fs::write(&path, data).await?;

        let relative = format!("{}/{}", room_id, filename);
        tracing::info!("Recording saved: {}", relative);
        Ok(relative)
    }

    /// Get the full path to a recording
    pub fn recording_path(&self, relative_path: &str) -> PathBuf {
        self.base_path.join(relative_path)
    }
}
