// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MushafCanvas } from "../../components/mushaf/MushafCanvas";
import { MushafReader } from "../../components/mushaf/MushafReader";
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

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col gap-2">
      <MushafReader page={page} onPageChange={goPage} riwaya={riwaya} canChangePage>
        <MushafCanvas
          page={page}
          riwaya={riwaya}
          highlightRange={interaction.highlightRange}
          activeWord={interaction.activeWord}
          onWordClick={interaction.handleWordClick}
        />
      </MushafReader>
    </div>
  );
}
