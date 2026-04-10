// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ReactNode } from "react";
import { Mic, MicOff, Video, Users, PenTool } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FloatingBottomBarProps {
  isMuted: boolean;
  canToggleMute: boolean;
  onToggleMute: () => void;
  onOpenParticipants: () => void;
  isTeacher: boolean;
  annotationMode?: boolean;
  onToggleAnnotation?: () => void;
}

export function FloatingBottomBar({
  isMuted,
  canToggleMute,
  onToggleMute,
  onOpenParticipants,
  isTeacher,
  annotationMode,
  onToggleAnnotation,
}: FloatingBottomBarProps) {
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-black/70 px-3 py-2 backdrop-blur-sm"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <RoundBtn
        active={!isMuted}
        activeColor="bg-[#1B5E20]"
        inactiveColor="bg-[#EF5350]"
        disabled={!canToggleMute}
        onClick={onToggleMute}
        title={isMuted ? t("liveSession.unmute") : t("liveSession.mute")}
      >
        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </RoundBtn>
      <RoundBtn onClick={() => {}} title={t("liveSession.teacherCamera")}>
        <Video className="h-4 w-4" />
      </RoundBtn>
      {isTeacher ? (
        <RoundBtn
          active={annotationMode}
          activeColor="bg-[#D4A843]"
          onClick={onToggleAnnotation}
          title={t("annotation.toggleMode")}
        >
          <PenTool className="h-4 w-4" />
        </RoundBtn>
      ) : null}
      <RoundBtn onClick={onOpenParticipants} title={t("liveSession.participants")}>
        <Users className="h-4 w-4" />
      </RoundBtn>
    </div>
  );
}

function RoundBtn({
  children,
  active,
  activeColor = "bg-white/15",
  inactiveColor = "bg-white/15",
  disabled,
  onClick,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:brightness-125 disabled:opacity-40 ${active ? activeColor : inactiveColor}`}
    >
      {children}
    </button>
  );
}
