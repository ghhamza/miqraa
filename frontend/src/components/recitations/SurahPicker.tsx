// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import {
  getSurah,
  getSurahAyahCount,
  getSurahNameWithArabic,
  searchSurahs,
} from "../../lib/quranService";
import type { SurahInfo } from "../../lib/quranService";
import type { QuranRiwaya } from "../../types";
import { cn } from "@/lib/utils";

export interface SurahPickerProps {
  /** Selected surah number, or `null` when `allowClear` and “all surahs” is chosen */
  value: number | null;
  onChange: (surah: number | null) => void;
  riwaya: QuranRiwaya;
  /** Show an “all surahs” row; `null` means all */
  allowClear?: boolean;
  disabled?: boolean;
  /** Merged onto the trigger button (e.g. align height with adjacent selects). */
  className?: string;
}

function surahRowLabel(s: SurahInfo, loc: string, riwaya: QuranRiwaya, ayahsWord: string): string {
  return `${s.number}. ${getSurahNameWithArabic(s.number, loc)} · ${getSurahAyahCount(s.number, riwaya)} ${ayahsWord}`;
}

export function SurahPicker({
  value,
  onChange,
  riwaya,
  allowClear = false,
  disabled = false,
  className,
}: SurahPickerProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const listboxId = useId();

  const ayahsWord = t("mushaf.ayahs");

  const options = useMemo(() => {
    const list = searchSurahs(query, loc);
    if (value != null && !list.some((s) => s.number === value)) {
      const s = getSurah(value);
      return s ? [s, ...list] : list;
    }
    return list;
  }, [query, loc, value]);

  useEffect(() => {
    if (!open) return;
    function handleDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDoc);
    return () => document.removeEventListener("mousedown", handleDoc);
  }, [open]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const triggerLabel =
    value != null
      ? (() => {
          const s = getSurah(value);
          return s ? surahRowLabel(s, loc, riwaya, ayahsWord) : String(value);
        })()
      : allowClear
        ? t("recitations.allSurahs")
        : "";

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full box-border items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 text-start text-sm text-[var(--color-text)] shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        style={{ fontFamily: "var(--font-quran)" }}
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-60 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-[min(22rem,70vh)] overflow-hidden rounded-xl border border-gray-200 bg-[var(--color-surface)] shadow-lg"
        >
          <div className="border-b border-gray-100 p-2">
            <label htmlFor={inputId} className="sr-only">
              {t("recitations.surahSearch")}
            </label>
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("recitations.surahSearch")}
              autoComplete="off"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-ui)" }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {allowClear ? (
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition hover:bg-gray-50 ${
                  value === null ? "bg-[var(--color-primary)]/10" : ""
                }`}
                style={{ fontFamily: "var(--font-ui)" }}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {value === null ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <span className="w-4" />}
                {t("recitations.allSurahs")}
              </button>
            ) : null}
            {options.map((s) => {
              const selected = value === s.number;
              const label = surahRowLabel(s, loc, riwaya, ayahsWord);
              return (
                <button
                  key={s.number}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition hover:bg-gray-50 ${
                    selected ? "bg-[var(--color-primary)]/10" : ""
                  }`}
                  style={{ fontFamily: "var(--font-quran)" }}
                  onClick={() => {
                    onChange(s.number);
                    setOpen(false);
                  }}
                >
                  {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <span className="w-4" />}
                  <span className="min-w-0 flex-1">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
