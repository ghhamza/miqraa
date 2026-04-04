// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MushafCanvas } from "../../components/mushaf/MushafCanvas";
import { MushafNavigation } from "../../components/mushaf/MushafNavigation";
import {
  getAvailableRiwayat,
  getHizbForAyah,
  getJuzForAyah,
  getSurahName,
  getSurahAyahAtPageStart,
  getTotalPages,
} from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";

export function MushafPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { page: pageParam } = useParams<{ page?: string }>();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const [riwaya, setRiwaya] = useState<Riwaya>("hafs");
  const totalPages = getTotalPages(riwaya);

  const [page, setPage] = useState(() => {
    const tp = getTotalPages("hafs");
    const parsed = pageParam ? Number(pageParam) : 1;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= tp ? Math.floor(parsed) : 1;
  });

  useEffect(() => {
    const p = pageParam ? Number(pageParam) : 1;
    if (!Number.isFinite(p) || p < 1) {
      void navigate("/mushaf/1", { replace: true });
      return;
    }
    if (p > totalPages) {
      void navigate(`/mushaf/${totalPages}`, { replace: true });
      setPage(totalPages);
      return;
    }
    setPage(Math.floor(p));
  }, [pageParam, totalPages, navigate]);

  const goPage = useCallback(
    (p: number) => {
      const next = Math.min(totalPages, Math.max(1, p));
      setPage(next);
      void navigate(`/mushaf/${next}`, { replace: true });
    },
    [navigate, totalPages],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPage(page - 1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goPage(page + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPage, page]);

  const [surahStart, ayahStart] = getSurahAyahAtPageStart(page, riwaya);
  const juz = getJuzForAyah(surahStart, ayahStart, riwaya);
  const hizb = getHizbForAyah(surahStart, ayahStart, riwaya);

  const progress = totalPages > 0 ? (page / totalPages) * 100 : 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6">
      <header className="flex flex-col items-center gap-2 border-b border-gray-100 pb-4 text-center">
        <h1
          className="text-2xl font-bold text-[var(--color-text)] md:text-3xl"
          style={{ fontFamily: "var(--font-quran)" }}
        >
          {getSurahName(surahStart, loc)}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[var(--color-text-muted)]">
          <span>
            {t("mushaf.pageOf", { n: page })} / {totalPages}
          </span>
          <span>·</span>
          <span>{t("mushaf.juzOf", { n: juz })}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-2">
            <select
              className="rounded-lg border border-gray-200 bg-[var(--color-surface)] px-2 py-1 text-xs font-medium text-[var(--color-text)]"
              value={riwaya}
              onChange={(e) => {
                const r = e.target.value as Riwaya;
                const tp = getTotalPages(r);
                const next = Math.min(page, tp);
                setRiwaya(r);
                setPage(next);
                void navigate(`/mushaf/${next}`, { replace: true });
              }}
            >
              {getAvailableRiwayat().map((r) => (
                <option key={r.id} value={r.id}>
                  {t(`mushaf.${r.id}`)}
                </option>
              ))}
            </select>
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center gap-6">
        <MushafCanvas page={page} riwaya={riwaya} />
        <MushafNavigation page={page} totalPages={totalPages} riwaya={riwaya} onPageChange={goPage} />
      </div>

      <footer className="border-t border-gray-100 pt-4">
        <div className="mb-1 flex justify-between text-xs text-[var(--color-text-muted)]">
          <span>
            {t("mushaf.hizb")} · {hizb}
          </span>
          <span>{t("mushaf.totalPages", { n: totalPages })}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </footer>
    </div>
  );
}
