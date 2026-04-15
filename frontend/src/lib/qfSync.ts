// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { api } from "./api";

export interface QfSyncStatusResponse {
  synced_at: string | null;
  error: string | null;
}

export async function waitForQfSyncStatus(recitationId: string, timeoutMs = 8000): Promise<QfSyncStatusResponse | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const { data } = await api.get<QfSyncStatusResponse>(`recitations/${recitationId}/qf-sync`);
      if (data.synced_at || data.error) return data;
    } catch {
      // keep polling for transient failures
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
  return null;
}
