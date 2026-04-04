// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { getApiBaseUrl } from "./api";

/** Build `ws:` / `wss:` URL for the same host as the REST API. */
export function getWebSocketBaseUrl(): string {
  const api = getApiBaseUrl();
  if (api.startsWith("http://")) {
    return `ws://${api.slice("http://".length)}`;
  }
  if (api.startsWith("https://")) {
    return `wss://${api.slice("https://".length)}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${api}`;
}

/** Live session signaling: `GET /api/ws/session/:id?token=JWT` upgraded to WebSocket. */
export function getSessionWebSocketUrl(sessionId: string, token: string): string {
  const base = getWebSocketBaseUrl().replace(/\/+$/, "");
  const q = new URLSearchParams({ token });
  return `${base}/ws/session/${encodeURIComponent(sessionId)}?${q.toString()}`;
}
