// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApiMutation } from "./useApiMutation";

function withClient(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useApiMutation", () => {
  it("invalidates listed keys on success", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useApiMutation<string, void>({
          mutationFn: async () => "ok",
          invalidates: [
            ["rooms", "list"] as const,
            ["rooms", "stats"] as const,
          ],
        }),
      { wrapper: withClient(qc) },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ["rooms", "list"] });
      expect(spy).toHaveBeenCalledWith({ queryKey: ["rooms", "stats"] });
    });
  });

  it("translates errors before onError callback", async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const onError = vi.fn();

    const { result } = renderHook(
      () =>
        useApiMutation<string, void>({
          mutationFn: async () => {
            const err = new Error("network down") as Error & { isAxiosError?: boolean };
            err.isAxiosError = true;
            throw err;
          },
          onError,
        }),
      { wrapper: withClient(qc) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        // expected
      }
    });

    expect(onError).toHaveBeenCalled();
    const [message] = onError.mock.calls[0]!;
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
  });
});
