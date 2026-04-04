// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import axios from "axios";
import i18n from "../i18n";

/** Maps axios errors to localized messages (prefers API `code` then `message`). */
export function userFacingApiError(err: unknown, fallbackKey = "errors.generic"): string {
  if (!axios.isAxiosError(err)) return i18n.t(fallbackKey);
  const status = err.response?.status;
  const data = err.response?.data as { message?: string; code?: string } | undefined;
  if (data?.code) {
    const key = `errors.${data.code}`;
    if (i18n.exists(key)) return i18n.t(key);
  }
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  if (status === 409) return i18n.t("errors.duplicateEmail");
  if (status === 403) return i18n.t("errors.noPermission");
  if (status === 400) return i18n.t("errors.badRequest");
  if (status === 401) return i18n.t("errors.sessionExpired");
  if (status === 404) return i18n.t("errors.not_found");
  if (status === 500) return i18n.t("errors.serverDown");
  if (status === 503) return i18n.t("errors.serviceUnavailable");
  if (!err.response) return i18n.t("errors.network");
  return i18n.t(fallbackKey);
}

/**
 * API base URL (must end with `/api`, no trailing slash).
 * - Dev: default is direct `http://127.0.0.1:3000/api` so the browser talks to Axum without relying on the Vite proxy (avoids HTML/index.html responses when proxy misbehaves).
 * - Prod: use same-origin `/api` (reverse proxy) or set `VITE_API_BASE_URL`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  if (import.meta.env.DEV) {
    return "http://127.0.0.1:3000/api";
  }
  return "/api";
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("miqraa_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("miqraa_token");
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/register") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
