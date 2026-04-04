// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { quranText } from "../../data/quran/quran_text_old_madinah";
import { ensureDigitalKhattEngine } from "../../lib/digitalkhattEngine";
import { Button } from "../ui/Button";
import { isBasmalahLine } from "./basmalahLine";
import { isSurahTitleLine, SurahTitleBanner } from "./SurahTitleBanner";
import { parseSurahTitleLine } from "./surahTitleParse";

export interface DigitalKhattRendererProps {
  pageNumber: number;
  width?: number;
  /** Omit outer card chrome when embedded in Mushaf book frame. */
  embedInBook?: boolean;
  onWordClick?: (data: { surah: number; ayah: number; wordIndex: number }) => void;
  onAyahClick?: (data: { surah: number; ayah: number }) => void;
  highlightRange?: { surah: number; ayahStart: number; ayahEnd: number };
}

export function DigitalKhattRenderer({
  pageNumber,
  width: widthProp,
  embedInBook = false,
}: DigitalKhattRendererProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(20);

  const pageIndex = Math.min(604, Math.max(1, Math.floor(pageNumber))) - 1;
  const lines = useMemo(() => quranText[pageIndex] ?? [], [pageIndex]);

  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError(null);
    try {
      await ensureDigitalKhattEngine();
      setStatus("ready");
    } catch (e) {
      setLoadError(e);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || status !== "ready") return;

    const updateSize = () => {
      const w = el.clientWidth;
      if (w > 0) {
        const raw = w / 20;
        setFontSize(Math.min(56, Math.max(12, raw)));
      }
    };

    const ro = new ResizeObserver(() => {
      queueMicrotask(updateSize);
    });
    ro.observe(el);
    updateSize();
    window.addEventListener("resize", updateSize);
    window.visualViewport?.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
      window.visualViewport?.removeEventListener("resize", updateSize);
    };
  }, [status, pageNumber, embedInBook]);

  const containerStyle = useMemo(() => {
    const w = widthProp;
    if (w != null) return { width: w, maxWidth: "100%" };
    if (embedInBook) return { width: "100%", maxWidth: "100%" };
    return { width: "100%", maxWidth: "min(100%, 36rem)" };
  }, [widthProp, embedInBook]);

  if (status === "loading") {
    return (
      <div
        className={`flex min-h-[28rem] w-full flex-col items-center justify-center gap-4 ${
          embedInBook ? "rounded-none bg-transparent p-3 shadow-none" : "rounded-xl p-8 shadow-md"
        }`}
        style={embedInBook ? containerStyle : { backgroundColor: "#FDF6E3", ...containerStyle }}
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        <p className="text-sm text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-ui)" }}>
          {t("mushaf.loading")}
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className={`flex min-h-[28rem] w-full flex-col items-center justify-center gap-4 text-center ${
          embedInBook ? "rounded-none bg-transparent p-3 shadow-none" : "rounded-xl p-8 shadow-md"
        }`}
        style={embedInBook ? containerStyle : { backgroundColor: "#FDF6E3", ...containerStyle }}
      >
        <p className="text-sm text-[var(--color-text-muted)]" style={{ fontFamily: "var(--font-ui)" }}>
          {t("mushaf.loadError")}
        </p>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          {t("mushaf.retryLoad")}
        </Button>
        {loadError != null && import.meta.env.DEV ? (
          <p className="max-w-md text-xs text-red-600">{String(loadError)}</p>
        ) : null}
      </div>
    );
  }

  const titlePx = fontSize * 1.1;

  return (
    <div
      className={`w-full min-w-0 ${embedInBook ? "rounded-none bg-transparent p-0 shadow-none sm:p-0" : "mx-auto rounded-xl p-4 shadow-md sm:p-6"}`}
      style={embedInBook ? containerStyle : { backgroundColor: "#FDF6E3", ...containerStyle }}
    >
      <div
        className={`flex w-full min-w-0 flex-col items-stretch gap-0 ${embedInBook ? "px-[clamp(1rem,4vw,2rem)] pb-4 pt-3" : "px-[clamp(1rem,4vw,2rem)] pb-4 pt-5"}`}
        dir="rtl"
        style={{ direction: "rtl" }}
      >
        <div ref={measureRef} className="w-full min-w-0">
          {lines.map((line, i) => {
            const key = `${pageNumber}-${i}-${line.slice(0, 24)}`;
            const surahTitle = isSurahTitleLine(line);
            const basmalah = isBasmalahLine(line);
            const parsedTitle = surahTitle ? parseSurahTitleLine(line) : null;
            const lineStyleFull = {
              fontSize: `${fontSize}px`,
              display: "block" as const,
              width: "100%",
              direction: "rtl" as const,
            };
            if (parsedTitle) {
              return <SurahTitleBanner key={key} line={line} fontSizePx={titlePx} />;
            }
            if (surahTitle) {
              return (
                <div key={key} className="w-full min-w-0">
                  <dk-text just="false" tajweed="" style={{ ...lineStyleFull, fontSize: `${titlePx}px` }}>
                    {line}
                  </dk-text>
                </div>
              );
            }
            if (basmalah) {
              return (
                <div key={key} className="my-4 w-full min-w-0">
                  <dk-text
                    just="false"
                    tajweed=""
                    style={{
                      fontSize: `${fontSize}px`,
                      display: "block",
                      width: "auto",
                      maxWidth: "100%",
                      direction: "rtl",
                      margin: "0 auto",
                    }}
                  >
                    {line}
                  </dk-text>
                </div>
              );
            }
            return (
              <div key={key} className="w-full min-w-0">
                <dk-text just="" tajweed="" style={lineStyleFull}>
                  {line}
                </dk-text>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
