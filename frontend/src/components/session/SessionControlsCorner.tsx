// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Circle, Hand, MousePointer2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MEET_ICON_BTN_BASE } from "./sessionMeetButtonStyles";

interface SessionControlsCornerProps {
  isTeacher: boolean;
  annotationMode?: boolean;
  onToggleAnnotation?: () => void;
}

export function SessionControlsCorner({
  isTeacher,
  annotationMode,
  onToggleAnnotation,
}: SessionControlsCornerProps) {
  const { t } = useTranslation();

  const showComingSoon = () => {
    window.alert(t("common.comingSoon"));
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={showComingSoon}
        title={t("liveSession.tooltip.record")}
        aria-label={t("liveSession.record")}
        className={cn(
          MEET_ICON_BTN_BASE,
          "bg-gradient-to-b from-rose-50 to-rose-100/90 text-rose-600 hover:from-rose-100 hover:to-rose-200/90",
        )}
      >
        <Circle className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={showComingSoon}
        title={t("liveSession.tooltip.raiseHand")}
        aria-label={t("liveSession.raiseHand")}
        className={cn(
          MEET_ICON_BTN_BASE,
          "bg-gradient-to-b from-amber-50 to-amber-100/90 text-amber-800 hover:from-amber-100 hover:to-amber-200/90",
        )}
      >
        <Hand className="h-5 w-5" strokeWidth={2.25} />
      </button>
      {isTeacher ? (
        <button
          type="button"
          onClick={onToggleAnnotation}
          title={t("liveSession.tooltip.annotationMode")}
          aria-label={t("annotation.toggleMode")}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md ring-1 ring-black/10 transition hover:brightness-105 active:scale-[0.97]",
            annotationMode
              ? "bg-gradient-to-b from-[#E8C456] to-[#D4A843] ring-2 ring-[#D4A843]/50 ring-offset-2 ring-offset-[#FDF6E3]"
              : "bg-gradient-to-b from-[#E0C66A] to-[#D4A843]/90",
          )}
        >
          <MousePointer2 className="h-5 w-5" strokeWidth={2.25} />
        </button>
      ) : (
        <button
          type="button"
          onClick={showComingSoon}
          title={t("liveSession.tooltip.pointerTool")}
          aria-label={t("liveSession.pointerTool")}
          className={cn(
            MEET_ICON_BTN_BASE,
            "bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-600 hover:from-slate-200 hover:to-slate-300/90",
          )}
        >
          <MousePointer2 className="h-5 w-5" strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
