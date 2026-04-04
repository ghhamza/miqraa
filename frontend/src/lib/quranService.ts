// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

/**
 * Quran structural metadata: static JSON (Hafs-based names) + quran-meta for riwaya-aware lookups.
 */
import surahsJson from "../data/quran/surahs.json";
import juzJson from "../data/quran/juz.json";
import hizbJson from "../data/quran/hizb.json";
import * as hafs from "quran-meta/hafs";
import * as warsh from "quran-meta/warsh";
import * as qalun from "quran-meta/qalun";
import type { AyahNo, Surah as SurahN } from "quran-meta/hafs";

/** Must match backend `riwaya` CHECK and `QuranRiwaya` in types. */
export type Riwaya =
  | "hafs"
  | "warsh"
  | "qalun"
  | "shubah"
  | "qunbul"
  | "bazzi"
  | "doori"
  | "susi"
  | "hisham"
  | "ibn_dhakwan"
  | "khalaf"
  | "khallad"
  | "doori_kisai"
  | "abu_harith";

export interface SurahInfo {
  number: number;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  nameTransliteration: string;
  meaningEn: string;
  meaningFr: string;
  totalAyahs: number;
  revelationType: "meccan" | "medinan";
  revelationOrder: number;
  juzStart: number;
  rukuCount: number;
}

export interface JuzInfo {
  number: number;
  nameAr: string;
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
}

export interface HizbInfo {
  number: number;
  juz: number;
  startSurah: number;
  startAyah: number;
}

/** Mushaf layout / ayah-index data: only Warsh and Qalun differ in quran-meta; all others use Hafs until more datasets ship. */
function riwayaModule(r: Riwaya): typeof hafs {
  switch (r) {
    case "warsh":
      return warsh as unknown as typeof hafs;
    case "qalun":
      return qalun as unknown as typeof hafs;
    default:
      return hafs;
  }
}

const surahs = surahsJson as SurahInfo[];
const juzAll = juzJson as JuzInfo[];
const hizbAll = hizbJson as HizbInfo[];

/** @deprecated Prefer getAllSurahs() — kept for backward compatibility */
export const QURAN_SURAHS: SurahInfo[] = surahs;

export function getAllSurahs(): SurahInfo[] {
  return surahs;
}

export function getSurah(number: number): SurahInfo | undefined {
  if (number < 1 || number > 114) return undefined;
  return surahs[number - 1];
}

export function getSurahName(number: number, locale: string): string {
  const s = getSurah(number);
  if (!s) return String(number);
  if (locale === "ar") return s.nameAr;
  if (locale === "fr") return s.nameFr;
  return s.nameEn;
}

/** Arabic plus localized name when UI is not Arabic; Arabic only when `locale` is `ar`. */
export function getSurahNameWithArabic(number: number, locale: string): string {
  const s = getSurah(number);
  if (!s) return String(number);
  if (locale === "ar") return s.nameAr;
  return `${s.nameAr} · ${getSurahName(number, locale)}`;
}

export function getSurahAyahCount(number: number, riwaya: Riwaya = "hafs"): number {
  if (number < 1 || number > 114) return 0;
  const m = riwayaModule(riwaya);
  return m.getAyahCountInSurah(number as SurahN);
}

export function searchSurahs(query: string, _locale: string): SurahInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return surahs;
  return surahs.filter((s) => {
    if (String(s.number).includes(q)) return true;
    if (s.nameAr.includes(query.trim())) return true;
    if (s.nameEn.toLowerCase().includes(q)) return true;
    if (s.nameFr.toLowerCase().includes(q)) return true;
    if (s.nameTransliteration.toLowerCase().includes(q)) return true;
    return false;
  });
}

export function getAllJuz(): JuzInfo[] {
  return juzAll;
}

export function getJuz(number: number): JuzInfo | undefined {
  if (number < 1 || number > 30) return undefined;
  return juzAll[number - 1];
}

export function getJuzForAyah(surah: number, ayah: number, riwaya: Riwaya = "hafs"): number {
  const m = riwayaModule(riwaya);
  return m.findJuz(surah as SurahN, ayah as AyahNo);
}

export function getAllHizb(): HizbInfo[] {
  return hizbAll;
}

export function getHizbForAyah(surah: number, ayah: number, riwaya: Riwaya = "hafs"): number {
  const m = riwayaModule(riwaya);
  const id = m.findAyahIdBySurah(surah as SurahN, ayah as AyahNo);
  return m.getRubAlHizbByAyahId(id).hizbId;
}

const RIWAYA_LABELS: Record<Riwaya, { name: string; nameAr: string }> = {
  hafs: { name: "Hafs (ʿan ʿĀṣim)", nameAr: "حفص عن عاصم" },
  shubah: { name: "Shuʿbah (ʿan ʿĀṣim)", nameAr: "شعبة عن عاصم" },
  warsh: { name: "Warsh (ʿan Nāfiʿ)", nameAr: "ورش عن نافع" },
  qalun: { name: "Qālūn (ʿan Nāfiʿ)", nameAr: "قالون عن نافع" },
  qunbul: { name: "Qunbul (ʿan Ibn Kathīr)", nameAr: "قنبل عن ابن كثير" },
  bazzi: { name: "al-Bazzī (ʿan Ibn Kathīr)", nameAr: "البزي عن ابن كثير" },
  doori: { name: "al-Dūrī (ʿan Abī ʿAmr)", nameAr: "الدوري عن أبي عمرو" },
  susi: { name: "al-Sūsī (ʿan Abī ʿAmr)", nameAr: "السوسي عن أبي عمرو" },
  hisham: { name: "Hishām (ʿan Ibn ʿĀmir)", nameAr: "هشام عن ابن عامر" },
  ibn_dhakwan: { name: "Ibn Dhakwān (ʿan Ibn ʿĀmir)", nameAr: "ابن ذكوان عن ابن عامر" },
  khalaf: { name: "Khalaf (ʿan Ḥamzah)", nameAr: "خلف عن حمزة" },
  khallad: { name: "Khallād (ʿan Ḥamzah)", nameAr: "خلاد عن حمزة" },
  doori_kisai: { name: "al-Dūrī (ʿan al-Kisāʾī)", nameAr: "الدوري عن الكسائي" },
  abu_harith: { name: "Abū al-Ḥārith (ʿan al-Kisāʾī)", nameAr: "أبو الحارث عن الكسائي" },
};

export function getRiwayaInfo(riwaya: Riwaya): { name: string; nameAr: string; totalAyahs: number } {
  const meta = riwayaModule(riwaya).meta;
  return { ...RIWAYA_LABELS[riwaya], totalAyahs: meta.numAyahs };
}

/** Display order: most widespread → least (classical teaching order). All selects use `getAvailableRiwayat()`. */
export const RIWAYA_ORDER: readonly Riwaya[] = [
  "hafs",
  "warsh",
  "qalun",
  "doori",
  "shubah",
  "qunbul",
  "bazzi",
  "hisham",
  "ibn_dhakwan",
  "susi",
  "khalaf",
  "khallad",
  "doori_kisai",
  "abu_harith",
] as const;

export function getAvailableRiwayat(): { id: Riwaya; name: string; nameAr: string }[] {
  return RIWAYA_ORDER.map((id) => ({ id, ...RIWAYA_LABELS[id] }));
}

export function isValidSurah(number: number): boolean {
  return Number.isInteger(number) && number >= 1 && number <= 114;
}

export function isValidAyahRange(surah: number, start: number, end: number, riwaya: Riwaya = "hafs"): boolean {
  if (!isValidSurah(surah)) return false;
  const max = getSurahAyahCount(surah, riwaya);
  return start >= 1 && end >= start && end <= max;
}

export function getNextAyah(
  surah: number,
  ayah: number,
  riwaya: Riwaya = "hafs",
): { surah: number; ayah: number } | null {
  const m = riwayaModule(riwaya);
  const [s, a] = m.nextAyah(surah as SurahN, ayah as AyahNo);
  if (s === 1 && a === 1) return null;
  return { surah: s, ayah: a };
}

export function getPrevAyah(
  surah: number,
  ayah: number,
  riwaya: Riwaya = "hafs",
): { surah: number; ayah: number } | null {
  if (surah === 1 && ayah === 1) return null;
  const m = riwayaModule(riwaya);
  const [s, a] = m.prevAyah(surah as SurahN, ayah as AyahNo);
  return { surah: s, ayah: a };
}

export function getNextSurah(surah: number): number | null {
  if (surah < 1 || surah >= 114) return null;
  return surah + 1;
}

export function getPrevSurah(surah: number): number | null {
  if (surah <= 1 || surah > 114) return null;
  return surah - 1;
}

export function getPageForAyah(surah: number, ayah: number, riwaya: Riwaya = "hafs"): number {
  const m = riwayaModule(riwaya);
  return m.findPage(surah as SurahN, ayah as AyahNo);
}

export function getTotalPages(riwaya: Riwaya = "hafs"): number {
  return riwayaModule(riwaya).meta.numPages;
}

/** First surah/ayah on this Mushaf page (riwaya-specific pagination). */
export function getSurahAyahAtPageStart(page: number, riwaya: Riwaya = "hafs"): [number, number] {
  const m = riwayaModule(riwaya);
  const id = m.PageList[page];
  return m.findSurahAyahByAyahId(id);
}

/**
 * Surahs that appear on this Mushaf page (first ayah → last ayah). On boundary pages
 * (e.g. Hafs p. 106) this spans two surahs — use for headers so the title matches what
 * the reader sees on the page, not only the first ayah.
 */
export function getSurahRangeOnPage(page: number, riwaya: Riwaya = "hafs"): { startSurah: number; endSurah: number } {
  const m = riwayaModule(riwaya);
  const total = m.meta.numPages;
  const p = Math.min(Math.max(1, Math.floor(page)), total);
  const meta = m.getPageMeta(p as Parameters<typeof m.getPageMeta>[0]);
  return { startSurah: meta.first[0], endSurah: meta.last[0] };
}

/** Page where the given surah begins (first ayah). */
export function getPageForSurahStart(surah: number, riwaya: Riwaya = "hafs"): number {
  const m = riwayaModule(riwaya);
  return m.findPage(surah as SurahN, 1 as AyahNo);
}

/** Juz whose first ayah matches the first ayah on this Mushaf page (Madani marginal “juz begins” marker). */
export function findJuzStartingAtPage(page: number, riwaya: Riwaya = "hafs"): JuzInfo | null {
  const [s, a] = getSurahAyahAtPageStart(page, riwaya);
  return getAllJuz().find((j) => j.startSurah === s && j.startAyah === a) ?? null;
}

/** Rubʿ al-hizb (quarter) whose first ayah matches the first ayah on this page (Madani marginal hizb marker). */
export function findHizbStartingAtPage(page: number, riwaya: Riwaya = "hafs"): HizbInfo | null {
  const [s, a] = getSurahAyahAtPageStart(page, riwaya);
  return getAllHizb().find((h) => h.startSurah === s && h.startAyah === a) ?? null;
}

/** Page where the given juz begins. */
export function getPageForJuzStart(juz: number, riwaya: Riwaya = "hafs"): number {
  const m = riwayaModule(riwaya);
  const id = m.JuzList[juz];
  const total = m.meta.numPages;
  for (let p = 1; p <= total; p++) {
    if (m.PageList[p] === id) return p;
  }
  return 1;
}

/** Structured surah info for tooltips (progress grid, etc.) */
export function getSurahDisplayMeta(number: number): {
  number: number;
  nameAr: string;
  totalAyahs: number;
  revelationType: "meccan" | "medinan";
  revelationOrder: number;
} | null {
  const s = getSurah(number);
  if (!s) return null;
  return {
    number: s.number,
    nameAr: s.nameAr,
    totalAyahs: s.totalAyahs,
    revelationType: s.revelationType,
    revelationOrder: s.revelationOrder,
  };
}
