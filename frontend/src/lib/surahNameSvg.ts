// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/** Vite resolves each `n.svg` (1–114) to a URL string for use in <img src>. */
const modules = import.meta.glob<string>("../assets/surah-names/svg/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

const urlBySurah = new Map<number, string>();

for (const [path, url] of Object.entries(modules)) {
  const file = path.split("/").pop() ?? "";
  const m = /^(\d+)\.svg$/.exec(file);
  if (m && typeof url === "string") {
    urlBySurah.set(Number(m[1]), url);
  }
}

export function getSurahNameSvgUrl(surahNumber: number): string | undefined {
  if (surahNumber < 1 || surahNumber > 114) return undefined;
  return urlBySurah.get(surahNumber);
}
