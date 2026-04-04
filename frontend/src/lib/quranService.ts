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

export type Riwaya = "hafs" | "warsh" | "qalun";

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

function riwayaModule(r: Riwaya): typeof hafs {
  switch (r) {
    case "hafs":
      return hafs;
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

export function getRiwayaInfo(riwaya: Riwaya): { name: string; nameAr: string; totalAyahs: number } {
  const meta = riwayaModule(riwaya).meta;
  const names: Record<Riwaya, { name: string; nameAr: string }> = {
    hafs: { name: "Hafs", nameAr: "حفص" },
    warsh: { name: "Warsh", nameAr: "ورش" },
    qalun: { name: "Qalun", nameAr: "قالون" },
  };
  return { ...names[riwaya], totalAyahs: meta.numAyahs };
}

export function getAvailableRiwayat(): { id: Riwaya; name: string; nameAr: string }[] {
  return [
    { id: "hafs", name: "Hafs", nameAr: "حفص" },
    { id: "warsh", name: "Warsh", nameAr: "ورش" },
    { id: "qalun", name: "Qalun", nameAr: "قالون" },
  ];
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

/** Page where the given surah begins (first ayah). */
export function getPageForSurahStart(surah: number, riwaya: Riwaya = "hafs"): number {
  const m = riwayaModule(riwaya);
  return m.findPage(surah as SurahN, 1 as AyahNo);
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
