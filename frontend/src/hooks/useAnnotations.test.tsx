// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAnnotations } from "./useAnnotations";
import { sessionKeys } from "../lib/queryKeys";
import { api } from "../lib/api";

function withClient(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useAnnotations optimistic flow", () => {
  beforeEach(() => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rolls back when server returns error", async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const recId = "rec-1";

    qc.setQueryData(sessionKeys.annotations(recId), []);

    vi.spyOn(api, "request").mockRejectedValue(new Error("server angry"));

    const { result } = renderHook(() => useAnnotations(recId), {
      wrapper: withClient(qc),
    });

    await act(async () => {
      await result.current.addError(recId, 1, 1, 0, "khafi", "other", "x", "error");
    });

    await waitFor(() => {
      const cached = qc.getQueryData(sessionKeys.annotations(recId));
      expect(cached).toEqual([]);
    });
  });
});
