// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, type DependencyList } from "react";

/**
 * Run an async effect that receives an `AbortSignal` for cancellation. The signal
 * is aborted on cleanup (deps change or unmount). Use it to bail early from
 * `await`s and to pass to fetch/axios via `{ signal }`.
 *
 * The effect MAY return a synchronous teardown function — it runs after the abort.
 *
 * Errors named "CanceledError" / "AbortError" are swallowed silently so callers
 * don't have to guard every catch.
 */
export function useCancellableEffect(
  effect: (signal: AbortSignal) => void | Promise<void | (() => void)>,
  deps: DependencyList,
): void {
  useEffect(() => {
    const controller = new AbortController();
    let teardown: (() => void) | void;
    void (async () => {
      try {
        const result = await effect(controller.signal);
        if (typeof result === "function") teardown = result;
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === "AbortError" || name === "CanceledError") return;
        // Surface unexpected errors so they're not swallowed silently.
        // Effect callers that want to handle them should do so themselves.
        console.error("[useCancellableEffect]", err);
      }
    })();
    return () => {
      controller.abort();
      if (typeof teardown === "function") teardown();
    };
  }, deps);
}
