// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

/** Reference body size (px) — DigitalKhatt defaultSize ≈ 20.869px; actual size is responsive via ResizeObserver. */
export const MUSHAF_DK_BODY_FONT_PX = 20;

/** Surah title (HTML) scales slightly above body when using fixed reference sizes. */
export const MUSHAF_SURAH_TITLE_FONT_PX = Math.round(MUSHAF_DK_BODY_FONT_PX * 1.1);
