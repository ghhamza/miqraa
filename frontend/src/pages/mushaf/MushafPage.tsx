// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MushafNavigation } from "../../components/mushaf/MushafNavigation";
import { MushafPageTurnButtons } from "../../components/mushaf/MushafPageTurnButtons";
import { getTotalPages } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";

const LEGACY_MUSHAF_ZOOM_STORAGE_KEY = "miqraa.mushaf.zoomPercent";

export function MushafPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { page: pageParam } = useParams<{ page?: string }>();
  const isRtl = (i18n.language || "ar").split("-")[0] === "ar";

  const riwaya: Riwaya = "hafs";
  const totalPages = getTotalPages(riwaya);

  const [page, setPage] = useState(() => {
    const tp = getTotalPages("hafs");
    const parsed = pageParam ? Number(pageParam) : 1;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= tp ? Math.floor(parsed) : 1;
  });

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_MUSHAF_ZOOM_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

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

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-2">
      <div className="w-full shrink-0 border-b border-gray-100 pb-2">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <MushafNavigation page={page} totalPages={totalPages} riwaya={riwaya} onPageChange={goPage} />
        </div>
      </div>

      <div
        className="mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-1 flex-col px-4 sm:px-6"
        aria-label="Mushaf content"
      />

      <MushafPageTurnButtons page={page} totalPages={totalPages} isRtl={isRtl} onPageChange={goPage} />
    </div>
  );
}
