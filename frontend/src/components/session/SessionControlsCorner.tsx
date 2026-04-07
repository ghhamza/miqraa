// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { Mic, MicOff, PenTool, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SessionControlsCornerProps {
  isMuted: boolean;
  canToggleMute: boolean;
  onToggleMute: () => void;
  isTeacher: boolean;
  annotationMode?: boolean;
  onToggleAnnotation?: () => void;
  onOpenParticipants: () => void;
}

export function SessionControlsCorner({
  isMuted,
  canToggleMute,
  onToggleMute,
  isTeacher,
  annotationMode,
  onToggleAnnotation,
  onOpenParticipants,
}: SessionControlsCornerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!canToggleMute}
        onClick={onToggleMute}
        title={isMuted ? t("liveSession.unmute") : t("liveSession.mute")}
        className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition disabled:opacity-40 ${
          isMuted ? "bg-[#EF5350]" : "bg-[#1B5E20]"
        }`}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
      {isTeacher ? (
        <button
          type="button"
          onClick={onToggleAnnotation}
          title={t("annotation.toggleMode")}
          className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition ${
            annotationMode ? "bg-[#D4A843] ring-2 ring-[#D4A843]/40 ring-offset-2 ring-offset-[#FDF6E3]" : "bg-[#D4A843]/70"
          }`}
        >
          <PenTool className="h-5 w-5" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onOpenParticipants}
        title={t("liveSession.participants")}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1A1A1A] bg-white text-[#1A1A1A] shadow-md transition hover:bg-gray-50"
      >
        <Users className="h-5 w-5" />
      </button>
    </div>
  );
}
