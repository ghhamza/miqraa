// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

/** Base URL for `/public/digitalkhatt/*` (WASM + binary assets fetched at runtime). */
export function dkAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`.replace(/([^:]\/)\/+/g, "$1");
}

let enginePromise: Promise<void> | null = null;

/** Loads WebAssembly once and registers the `dk-text` custom element. JS lives under `src/vendor` so Vite can bundle it; binaries stay in `public/digitalkhatt`. */
export function ensureDigitalKhattEngine(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!enginePromise) {
    window.__DK_BASE__ = dkAsset("digitalkhatt/");
    enginePromise = import("../vendor/digitalkhatt/quranservice.service.js")
      .then((m: { default: { promise: Promise<unknown> } }) => m.default.promise)
      .then(() => import("../vendor/digitalkhatt/df-text-component.js"))
      .then(() => undefined)
      .catch((e: unknown) => {
        enginePromise = null;
        throw e;
      });
  }
  return enginePromise;
}
