/**
 * Generates surahs.json, juz.json, hizb.json from quran-meta + i18n names.
 * Run: node scripts/generate-quran-json.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getSurahMeta,
  JuzList,
  HizbQuarterList,
  findSurahAyahByAyahId,
  prevAyah,
  findJuz,
  getRubAlHizbByAyahId,
} from "quran-meta/hafs";
import { surahNamesEn, surahNamesFr } from "quran-meta/i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../src/data/quran");

const JUZ_AR = [
  "الجزء الأول",
  "الجزء الثاني",
  "الجزء الثالث",
  "الجزء الرابع",
  "الجزء الخامس",
  "الجزء السادس",
  "الجزء السابع",
  "الجزء الثامن",
  "الجزء التاسع",
  "الجزء العاشر",
  "الجزء الحادي عشر",
  "الجزء الثاني عشر",
  "الجزء الثالث عشر",
  "الجزء الرابع عشر",
  "الجزء الخامس عشر",
  "الجزء السادس عشر",
  "الجزء السابع عشر",
  "الجزء الثامن عشر",
  "الجزء التاسع عشر",
  "الجزء العشرون",
  "الجزء الحادي والعشرون",
  "الجزء الثاني والعشرون",
  "الجزء الثالث والعشرون",
  "الجزء الرابع والعشرون",
  "الجزء الخامس والعشرون",
  "الجزء السادس والعشرون",
  "الجزء السابع والعشرون",
  "الجزء الثامن والعشرون",
  "الجزء التاسع والعشرون",
  "الجزء الثلاثون",
];

const surahs = [];
for (let n = 1; n <= 114; n++) {
  const m = getSurahMeta(n);
  const en = surahNamesEn[n];
  const fr = surahNamesFr[n];
  surahs.push({
    number: n,
    nameAr: m.name,
    nameEn: en[0],
    nameFr: fr[0],
    nameTransliteration: en[0],
    meaningEn: en[1],
    meaningFr: fr[1],
    totalAyahs: m.ayahCount,
    revelationType: m.isMeccan ? "meccan" : "medinan",
    revelationOrder: m.surahOrder,
    juzStart: findJuz(n, 1),
    rukuCount: m.rukuCount,
  });
}

const juz = [];
for (let j = 1; j <= 30; j++) {
  const startId = JuzList[j];
  const [startSurah, startAyah] = findSurahAyahByAyahId(startId);
  let endSurah;
  let endAyah;
  if (j < 30) {
    const [ns, na] = findSurahAyahByAyahId(JuzList[j + 1]);
    [endSurah, endAyah] = prevAyah(ns, na);
  } else {
    endSurah = 114;
    endAyah = 6;
  }
  juz.push({
    number: j,
    nameAr: JUZ_AR[j - 1],
    startSurah,
    startAyah,
    endSurah,
    endAyah,
  });
}

const hizb = [];
for (let h = 1; h <= 60; h++) {
  const idx = (h - 1) * 4 + 1;
  const id = HizbQuarterList[idx];
  const [startSurah, startAyah] = findSurahAyahByAyahId(id);
  const { juz } = getRubAlHizbByAyahId(id);
  hizb.push({
    number: h,
    juz,
    startSurah,
    startAyah,
  });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "surahs.json"), JSON.stringify(surahs, null, 2));
fs.writeFileSync(path.join(outDir, "juz.json"), JSON.stringify(juz, null, 2));
fs.writeFileSync(path.join(outDir, "hizb.json"), JSON.stringify(hizb, null, 2));
console.log("Wrote", surahs.length, "surahs,", juz.length, "juz,", hizb.length, "hizb →", outDir);
