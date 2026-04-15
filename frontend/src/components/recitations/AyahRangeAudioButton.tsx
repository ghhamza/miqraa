// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChapterAudio } from "../../hooks/useChapterAudio";

interface Props {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  recitationId?: number;
  variant?: "icon" | "labeled";
  onPlaybackStateChange?: (state: {
    playing: boolean;
    surah: number;
    currentAyah: number | null;
  }) => void;
}

let activeAudio: HTMLAudioElement | null = null;

/**
 * Plays a qari recitation sequentially over an ayah range.
 */
export function AyahRangeAudioButton({
  surah,
  ayahStart,
  ayahEnd,
  recitationId = 1,
  variant = "icon",
  onPlaybackStateChange,
}: Props) {
  const { t } = useTranslation();
  const { data, loading, error } = useChapterAudio(surah, recitationId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentAyah, setCurrentAyah] = useState<number | null>(null);

  useEffect(() => {
    onPlaybackStateChange?.({ playing, surah, currentAyah });
  }, [playing, surah, currentAyah, onPlaybackStateChange]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        if (activeAudio === audioRef.current) activeAudio = null;
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  function urlFor(ayah: number): string | null {
    if (!data) return null;
    return data.audioFiles[`${surah}:${ayah}`] ?? null;
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      if (activeAudio === audioRef.current) activeAudio = null;
    }
    setPlaying(false);
    setCurrentAyah(null);
  }

  function claimExclusive(audio: HTMLAudioElement) {
    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause();
      activeAudio.src = "";
    }
    activeAudio = audio;
  }

  function playFrom(ayah: number) {
    const url = urlFor(ayah);
    if (!url) {
      stop();
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    const audio = audioRef.current;
    claimExclusive(audio);
    audio.src = url;
    audio.onended = () => {
      const next = ayah + 1;
      if (next <= ayahEnd) {
        setCurrentAyah(next);
        playFrom(next);
      } else {
        setPlaying(false);
        setCurrentAyah(null);
        if (activeAudio === audio) activeAudio = null;
      }
    };
    audio.onerror = () => {
      stop();
      if (activeAudio === audio) activeAudio = null;
    };
    setCurrentAyah(ayah);
    setPlaying(true);
    void audio.play().catch(() => stop());
  }

  function toggle() {
    if (playing) {
      stop();
      return;
    }
    playFrom(ayahStart);
  }

  const disabled = loading || !!error || !data;
  const Icon = playing ? Pause : loading ? Loader2 : Play;
  const label = playing ? t("recitations.audio.stop") : t("recitations.audio.listen");
  const title = error
    ? t("recitations.audio.failed")
    : `${label} ${surah}:${ayahStart}${ayahStart !== ayahEnd ? `-${ayahEnd}` : ""}`;

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
          playing
            ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
            : "border-gray-300 bg-white text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <Icon size={14} className={loading ? "animate-spin" : ""} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
        playing
          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
          : "border-gray-300 bg-white text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Icon size={14} className={loading ? "animate-spin" : ""} />
      <span>
        {label}
        {playing && currentAyah ? ` (${currentAyah}/${ayahEnd})` : ""}
      </span>
    </button>
  );
}
