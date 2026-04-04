// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

/** Must match `quran_text_old_madinah.ts` exactly (surahs other than Al-Fatiha). */
export const BASMALAH_LINE_PLAIN = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

/** Al-Fatiha page: basmalah is verse 1 (includes ۝١). */
export const BASMALAH_LINE_FATIHA_V1 = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ۝١";

/** True for standalone basmalah or Fatiha v1 basmalah — not mid-verse mentions of بسم الله. */
export function isBasmalahLine(line: string): boolean {
  const t = line.trim();
  return t === BASMALAH_LINE_PLAIN || t === BASMALAH_LINE_FATIHA_V1;
}
