// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import { getRiwayaInfo } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import type { QCFPageRendererProps } from "./QCFPageRenderer";
import { QCFPageRenderer } from "./QCFPageRenderer";

export interface MushafCanvasProps {
  page: number;
  riwaya: Riwaya;
  highlightRange?: QCFPageRendererProps["highlightRange"];
  activeWord?: QCFPageRendererProps["activeWord"];
  onWordClick?: QCFPageRendererProps["onWordClick"];
  onWordMouseEnter?: QCFPageRendererProps["onWordMouseEnter"];
  onWordMouseLeave?: QCFPageRendererProps["onWordMouseLeave"];
  onAyahClick?: QCFPageRendererProps["onAyahClick"];
  getWordAnnotationClass?: QCFPageRendererProps["getWordAnnotationClass"];
}

export function MushafCanvas({
  page,
  riwaya,
  highlightRange,
  activeWord,
  onWordClick,
  onWordMouseEnter,
  onWordMouseLeave,
  onAyahClick,
  getWordAnnotationClass,
}: MushafCanvasProps) {
  const { t } = useTranslation();

  if (riwaya !== "hafs") {
    const info = getRiwayaInfo(riwaya);
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
        <p className="font-medium text-foreground">{t("mushaf.comingSoon")}</p>
        <p>{t("mushaf.comingSoonDesc", { riwaya: info.nameAr })}</p>
      </div>
    );
  }

  return (
    <QCFPageRenderer
      pageNumber={page}
      riwaya={riwaya}
      highlightRange={highlightRange}
      activeWord={activeWord}
      onWordClick={onWordClick}
      onWordMouseEnter={onWordMouseEnter}
      onWordMouseLeave={onWordMouseLeave}
      onAyahClick={onAyahClick}
      getWordAnnotationClass={getWordAnnotationClass}
    />
  );
}
