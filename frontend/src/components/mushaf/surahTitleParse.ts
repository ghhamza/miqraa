// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

/** Prefix used in Madinah mushaf text for surah heading lines. */
const SURAH_PREFIX = "سُورَةُ";

/** Split a surah heading line into label (سُورَةُ) and surah name for Madinah-style layout. */
export function parseSurahTitleLine(line: string): { prefix: string; name: string } | null {
  const t = line.trimStart();
  if (!t.startsWith(SURAH_PREFIX)) return null;
  const name = t.slice(SURAH_PREFIX.length).trimStart();
  return { prefix: SURAH_PREFIX, name };
}
