// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MushafBookLayout } from "../../components/mushaf/MushafBookLayout";
import { MushafCanvas } from "../../components/mushaf/MushafCanvas";
import { MushafNavigation } from "../../components/mushaf/MushafNavigation";
import { MushafPageTurnButtons } from "../../components/mushaf/MushafPageTurnButtons";
import { useMushafInteraction } from "../../hooks/useMushafInteraction";
import { getTotalPages } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";

export function MushafPage() {
  const navigate = useNavigate();
  const { page: pageParam } = useParams<{ page?: string }>();
  const riwaya: Riwaya = "hafs";
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

  const interaction = useMushafInteraction({
    initialPage: page,
    riwaya,
    onPageChange: goPage,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* Match RTL Mushaf: left = forward in book (next page), right = back (previous page). */
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPage(page + 1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goPage(page - 1);
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
      >
        <MushafBookLayout page={page} riwaya={riwaya}>
          <MushafCanvas
            page={page}
            riwaya={riwaya}
            highlightRange={interaction.highlightRange}
            activeWord={interaction.activeWord}
            onWordClick={interaction.handleWordClick}
          />
        </MushafBookLayout>
      </div>

      <MushafPageTurnButtons page={page} totalPages={totalPages} onPageChange={goPage} />

      {import.meta.env.DEV && (
        <div
          className="fixed bottom-4 left-4 z-50 space-y-2 rounded-lg border bg-white p-3 text-xs shadow-lg"
          dir="ltr"
        >
          <p className="font-bold">Dev: Mushaf Interaction</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-gray-300 bg-gray-50 px-2 py-1 hover:bg-gray-100"
              onClick={() => interaction.setHighlightRange({ surah: 2, ayahStart: 255, ayahEnd: 255 })}
            >
              Highlight 2:255
            </button>
            <button
              type="button"
              className="rounded border border-gray-300 bg-gray-50 px-2 py-1 hover:bg-gray-100"
              onClick={() => {
                interaction.setHighlightRange(null);
                interaction.setActiveWord(null);
              }}
            >
              Clear
            </button>
          </div>
          {interaction.activeWord && (
            <p>
              Active: {interaction.activeWord.surah}:{interaction.activeWord.ayah}:
              {interaction.activeWord.wordIndex}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
