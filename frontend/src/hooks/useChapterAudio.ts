// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useQuery } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { quranKeys } from "../lib/queryKeys";
import { api } from "../lib/api";

export interface ChapterAudio {
  /** verse_key ("1:1") -> full audio URL */
  audioFiles: Record<string, string>;
  recitationId: number;
}

async function fetchChapterAudio(
  chapter: number,
  recitationId: number,
  signal?: AbortSignal,
): Promise<ChapterAudio> {
  const candidateReciters = recitationId === 1 ? [1, 6, 7] : [recitationId];
  let lastError: unknown = null;
  for (const rid of candidateReciters) {
    try {
      const res = await api.get<{ audio_files: Record<string, string> }>(
        `quran/recitations/${rid}/by_chapter/${chapter}`,
        signal ? { signal } : {},
      );
      return { audioFiles: res.data.audio_files, recitationId: rid };
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  throw new Error("Failed to fetch chapter audio");
}

export function useChapterAudio(chapter: number | null, recitationId = 1) {
  const query = useQuery({
    queryKey: quranKeys.chapterAudio(chapter ?? 0, recitationId),
    queryFn: ({ signal }) => fetchChapterAudio(chapter as number, recitationId, signal),
    enabled: chapter != null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });

  return {
    data: (query.data ?? null) as ChapterAudio | null,
    loading: query.isPending && chapter != null,
    error: query.error,
  };
}

export function prefetchChapterAudio(chapter: number, recitationId = 1) {
  void queryClient
    .prefetchQuery({
      queryKey: quranKeys.chapterAudio(chapter, recitationId),
      queryFn: ({ signal }) => fetchChapterAudio(chapter, recitationId, signal),
      staleTime: Infinity,
    })
    .catch(() => {});
}
