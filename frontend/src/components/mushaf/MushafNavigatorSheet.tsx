// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { InputControl } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  findHizbStartingAtPage,
  findJuzStartingAtPage,
  getAllHizb,
  getAllJuz,
  getJuz,
  getJuzForAyah,
  getPageForAyah,
  getPageForJuzStart,
  getPageForSurahStart,
  getSurahAyahAtPageStart,
  getSurahRangeOnPage,
  getSurahNameWithArabic,
  searchSurahs,
} from "../../lib/quranService";
import type { HizbInfo, JuzInfo, Riwaya, SurahInfo } from "../../lib/quranService";

export interface MushafNavigatorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riwaya: Riwaya;
  /** Current mushaf page (for highlighting the active row). */
  page: number;
  totalPages: number;
  /** When false, navigation is disabled (e.g. student in auto-follow). */
  canNavigate: boolean;
  onNavigateToPage: (page: number) => void;
  /** Sheet edge: LTR → left, RTL → right. */
  side?: "left" | "right";
}

function filterJuz(list: JuzInfo[], query: string): JuzInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (j) =>
      String(j.number).includes(q) ||
      j.nameAr.includes(query.trim()) ||
      String(j.number).toLowerCase().includes(q),
  );
}

function filterHizb(list: HizbInfo[], query: string): HizbInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (h) =>
      String(h.number).includes(q) ||
      String(h.juz).includes(q) ||
      String(h.startSurah).includes(q),
  );
}

function filterPages(total: number, query: string): number[] {
  const all = Array.from({ length: total }, (_, i) => i + 1);
  const q = query.trim();
  if (!q) return all;
  return all.filter((p) => String(p).includes(q));
}

export function MushafNavigatorSheet({
  open,
  onOpenChange,
  riwaya,
  page,
  totalPages,
  canNavigate,
  onNavigateToPage,
  side = "left",
}: MushafNavigatorSheetProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";
  const [tab, setTab] = useState("surah");
  const [query, setQuery] = useState("");

  const surahs = useMemo(() => searchSurahs(query, loc), [query, loc]);
  const juzList = useMemo(() => filterJuz(getAllJuz(), query), [query]);
  const hizbList = useMemo(() => filterHizb(getAllHizb(), query), [query]);
  const pages = useMemo(() => filterPages(totalPages, query), [query, totalPages]);

  const { startSurah, endSurah } = useMemo(() => getSurahRangeOnPage(page, riwaya), [page, riwaya]);
  const [s0, a0] = useMemo(() => getSurahAyahAtPageStart(page, riwaya), [page, riwaya]);
  const juzAtPage = useMemo(
    () => findJuzStartingAtPage(page, riwaya) ?? getJuz(getJuzForAyah(s0, a0, riwaya)),
    [page, riwaya, s0, a0],
  );
  const hizbAtPage = useMemo(() => findHizbStartingAtPage(page, riwaya), [page, riwaya]);

  const placeholder =
    tab === "surah"
      ? t("mushaf.navigator.searchSurah")
      : tab === "juz"
        ? t("mushaf.navigator.searchJuz")
        : tab === "hizb"
          ? t("mushaf.navigator.searchHizb")
          : t("mushaf.navigator.searchPage");

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform ?? navigator.userAgent);
  const shortcutHint = isMac ? t("mushaf.navigator.shortcutMac") : t("mushaf.navigator.shortcutWin");

  const go = (targetPage: number) => {
    if (!canNavigate) return;
    onNavigateToPage(Math.min(totalPages, Math.max(1, targetPage)));
    onOpenChange(false);
  };

  const surahRowActive = (s: SurahInfo) => s.number >= startSurah && s.number <= endSurah;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setTab("surah");
          setQuery("");
        }
        onOpenChange(next);
      }}
    >
      <SheetContent
        side={side}
        showCloseButton
        className="flex w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
      >
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setQuery("");
          }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetHeader className="shrink-0 space-y-3 border-b border-border px-4 pb-3 pt-12">
            <SheetTitle className="text-start font-heading text-base font-semibold text-foreground">
              {t("mushaf.jumpTitle")}
            </SheetTitle>
            <SheetDescription className="sr-only">{t("mushaf.navigator.description")}</SheetDescription>
            <TabsList className="grid h-auto w-full min-w-0 grid-cols-4 gap-0.5 p-1">
              <TabsTrigger value="surah" className="px-1">
                {t("mushaf.surah")}
              </TabsTrigger>
              <TabsTrigger value="juz" className="px-1">
                {t("mushaf.juz")}
              </TabsTrigger>
              <TabsTrigger value="hizb" className="px-1">
                {t("mushaf.hizb")}
              </TabsTrigger>
              <TabsTrigger value="page" className="px-1">
                {t("mushaf.page")}
              </TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">{shortcutHint}</p>
            <InputControl
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              aria-label={placeholder}
              className="rounded-lg"
            />
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
            <TabsContent value="surah" className="m-0 flex flex-col gap-0">
              <ul className="flex flex-col gap-0.5" role="listbox">
                {surahs.map((s) => (
                  <li key={s.number}>
                    <button
                      type="button"
                      disabled={!canNavigate}
                      onClick={() => go(getPageForSurahStart(s.number, riwaya))}
                      className={cn(
                        "w-full rounded-md px-3 py-2.5 text-start text-sm transition-colors",
                        "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        surahRowActive(s) && "bg-muted font-medium text-foreground",
                        !canNavigate && "cursor-not-allowed opacity-50",
                      )}
                      style={{ fontFamily: "var(--font-ui)" }}
                    >
                      <span className="tabular-nums text-muted-foreground">{s.number}</span>{" "}
                      <span>{getSurahNameWithArabic(s.number, loc)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="juz" className="m-0">
              <ul className="flex flex-col gap-0.5">
                {juzList.map((j) => {
                  const target = getPageForJuzStart(j.number, riwaya);
                  const active = juzAtPage?.number === j.number;
                  return (
                    <li key={j.number}>
                      <button
                        type="button"
                        disabled={!canNavigate}
                        onClick={() => go(target)}
                        className={cn(
                          "w-full rounded-md px-3 py-2.5 text-start text-sm transition-colors",
                          "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          active && "bg-muted font-medium",
                          !canNavigate && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="tabular-nums text-muted-foreground">{j.number}</span>{" "}
                        <span className="text-base" dir="rtl" style={{ fontFamily: "var(--font-ui)" }}>
                          {j.nameAr}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>

            <TabsContent value="hizb" className="m-0">
              <ul className="flex flex-col gap-0.5">
                {hizbList.map((h) => {
                  const target = getPageForAyah(h.startSurah, h.startAyah, riwaya);
                  const active = hizbAtPage?.number === h.number;
                  return (
                    <li key={h.number}>
                      <button
                        type="button"
                        disabled={!canNavigate}
                        onClick={() => go(target)}
                        className={cn(
                          "w-full rounded-md px-3 py-2.5 text-start text-sm transition-colors",
                          "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          active && "bg-muted font-medium",
                          !canNavigate && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <span className="tabular-nums text-muted-foreground">{h.number}</span>
                        <span className="ms-1 text-muted-foreground">
                          · {t("mushaf.juz")} {h.juz}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>

            <TabsContent value="page" className="m-0">
              <ul className="flex flex-col gap-0.5">
                {pages.map((p) => {
                  const active = p === page;
                  return (
                    <li key={p}>
                      <button
                        type="button"
                        disabled={!canNavigate}
                        onClick={() => go(p)}
                        className={cn(
                          "w-full rounded-md px-3 py-2.5 text-start text-sm tabular-nums transition-colors",
                          "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          active && "bg-muted font-medium",
                          !canNavigate && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {t("mushaf.pageOf", { n: p })}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
