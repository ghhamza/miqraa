// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use tokio::sync::Mutex;

use crate::quran_ayah_counts::total_ayahs_in_surah;
use crate::qf::config::QfConfig;

const TOKEN_REFRESH_BUFFER: Duration = Duration::from_secs(30);
const CHAPTER_CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);
/// Default reciter — AbdulBaset AbdulSamad, Mujawwad style.
pub const DEFAULT_RECITATION_ID: i32 = 1;

#[derive(Clone)]
pub struct ContentApiClient {
    cfg: QfConfig,
    http: reqwest::Client,
    token: Arc<Mutex<Option<CachedToken>>>,
    /// Key: (chapter, recitation_id). Value: verse_key -> full audio URL
    chapter_cache: Arc<Mutex<HashMap<(i32, i32), CachedChapter>>>,
}

#[derive(Clone)]
struct CachedToken {
    access_token: String,
    expires_at: Instant,
}

#[derive(Clone)]
struct CachedChapter {
    audio_files: HashMap<String, String>,
    cached_at: Instant,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Deserialize)]
struct AudioFilesResponse {
    audio_files: Vec<AudioFile>,
}

#[derive(Deserialize)]
struct AudioFile {
    verse_key: String,
    /// May be a relative path or an absolute URL.
    url: String,
}

impl ContentApiClient {
    pub fn new(cfg: QfConfig, http: reqwest::Client) -> Self {
        Self {
            cfg,
            http,
            token: Arc::new(Mutex::new(None)),
            chapter_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get cached token or fetch new one.
    pub async fn get_access_token(&self) -> Result<String> {
        let mut guard = self.token.lock().await;
        if let Some(cached) = guard.as_ref() {
            if cached.expires_at > Instant::now() + TOKEN_REFRESH_BUFFER {
                return Ok(cached.access_token.clone());
            }
        }
        let resp = self.fetch_token_inner().await?;
        let cached = CachedToken {
            access_token: resp.access_token.clone(),
            expires_at: Instant::now() + Duration::from_secs(resp.expires_in),
        };
        *guard = Some(cached);
        Ok(resp.access_token)
    }

    async fn fetch_token_inner(&self) -> Result<TokenResponse> {
        let url = format!("{}/oauth2/token", self.cfg.auth_base_url);
        let resp = self
            .http
            .post(&url)
            .basic_auth(&self.cfg.client_id, Some(&self.cfg.client_secret))
            .form(&[("grant_type", "client_credentials"), ("scope", "content")])
            .send()
            .await
            .context("qf content token request failed")?;
        let status = resp.status();
        if !status.is_success() {
            tracing::error!(qf_status = %status, "QF content token: HTTP error");
            return Err(anyhow!("qf token http {}", status));
        }
        let body: TokenResponse = resp
            .json()
            .await
            .context("qf content token json parse failed")?;
        tracing::info!(expires_in = body.expires_in, "QF content token acquired");
        Ok(body)
    }

    /// Returns map of verse_key ("1:1") -> full audio URL.
    pub async fn get_chapter_audio_files(
        &self,
        chapter: i32,
        recitation_id: i32,
    ) -> Result<HashMap<String, String>> {
        let expected_count = total_ayahs_in_surah(chapter).max(0) as usize;
        {
            let guard = self.chapter_cache.lock().await;
            if let Some(cached) = guard.get(&(chapter, recitation_id)) {
                let cache_fresh = cached.cached_at.elapsed() < CHAPTER_CACHE_TTL;
                // Guard against stale, paginated payloads (e.g. only first 10 ayahs).
                let cache_complete =
                    expected_count == 0 || cached.audio_files.len() >= expected_count;
                if cache_fresh && cache_complete {
                    return Ok(cached.audio_files.clone());
                }
            }
        }

        let map = match self.fetch_chapter_audio_inner(chapter, recitation_id).await {
            Ok(m) => m,
            Err(e) if e.to_string().contains("401") => {
                {
                    let mut g = self.token.lock().await;
                    *g = None;
                }
                self.fetch_chapter_audio_inner(chapter, recitation_id)
                    .await?
            }
            Err(e) => return Err(e),
        };

        {
            let mut guard = self.chapter_cache.lock().await;
            guard.insert(
                (chapter, recitation_id),
                CachedChapter {
                    audio_files: map.clone(),
                    cached_at: Instant::now(),
                },
            );
        }
        if expected_count > 0 && map.len() < expected_count {
            tracing::warn!(
                chapter,
                recitation_id,
                got = map.len(),
                expected = expected_count,
                "QF chapter audio appears incomplete"
            );
        }
        Ok(map)
    }

    async fn fetch_chapter_audio_inner(
        &self,
        chapter: i32,
        recitation_id: i32,
    ) -> Result<HashMap<String, String>> {
        let token = self.get_access_token().await?;
        let url = format!(
            "{}/content/api/v4/recitations/{}/by_chapter/{}?per_page=300",
            self.cfg.api_base_url, recitation_id, chapter
        );
        let resp = self
            .http
            .get(&url)
            .header("x-auth-token", &token)
            .header("x-client-id", &self.cfg.client_id)
            .send()
            .await
            .context("qf content audio request failed")?;
        let status = resp.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(anyhow!("qf content api 401"));
        }
        if !status.is_success() {
            tracing::error!(qf_status = %status, chapter, "QF audio fetch: HTTP error");
            return Err(anyhow!("qf content api http {}", status));
        }
        let body: AudioFilesResponse = resp.json().await.context("qf audio json parse failed")?;
        let mut map = HashMap::with_capacity(body.audio_files.len());
        for f in body.audio_files {
            let full_url = if f.url.starts_with("http://") || f.url.starts_with("https://") {
                f.url
            } else if f.url.starts_with("//") {
                format!("https:{}", f.url)
            } else {
                format!(
                    "{}/{}",
                    self.cfg.audio_cdn_base_url.trim_end_matches('/'),
                    f.url.trim_start_matches('/')
                )
            };
            map.insert(f.verse_key, full_url);
        }
        tracing::debug!(chapter, count = map.len(), "QF audio chapter fetched");
        Ok(map)
    }

    pub async fn debug_state(&self) -> serde_json::Value {
        let token_guard = self.token.lock().await;
        let token_cached = token_guard.is_some();
        let token_expires_in = token_guard.as_ref().map(|t| {
            t.expires_at
                .checked_duration_since(Instant::now())
                .map(|d| d.as_secs())
                .unwrap_or(0)
        });
        drop(token_guard);

        let cache_guard = self.chapter_cache.lock().await;
        let chapters_cached: Vec<i32> = cache_guard.keys().map(|(ch, _)| *ch).collect();
        serde_json::json!({
            "content_api_token_cached": token_cached,
            "content_api_token_expires_in_seconds": token_expires_in,
            "audio_cdn_base_url": self.cfg.audio_cdn_base_url,
            "chapters_cached": chapters_cached,
            "default_recitation_id": DEFAULT_RECITATION_ID,
        })
    }
}
