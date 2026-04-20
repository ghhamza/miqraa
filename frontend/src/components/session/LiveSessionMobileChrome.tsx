// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { SessionWsStatus } from "@/hooks/useSessionWebSocket";

import type { ReactNode } from "react";
import {
  Circle,
  Hand,
  Info,
  Menu,
  MessageSquare,
  MoreHorizontal,
  MousePointer2,
  Users,
  Video,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/lib/utils";
import { MEET_ICON_BTN_BASE, MENU_ICON_BUTTON_CLASS } from "./sessionMeetButtonStyles";

export interface LiveSessionMobileTopBarProps {
  surahLabel: string;
  page: number;
  juzN: number;
  hizbN: number;
  onOpenMenu: () => void;
}

export function LiveSessionMobileTopBar({
  surahLabel,
  page,
  juzN,
  hizbN,
  onOpenMenu,
}: LiveSessionMobileTopBarProps) {
  const { t } = useTranslation();
  const pageBits: string[] = [t("mushaf.pageOf", { n: page })];
  if (juzN > 0) pageBits.push(t("mushaf.juzN", { n: juzN }));
  if (hizbN > 0) pageBits.push(`${t("mushaf.hizb")} ${hizbN}`);
  const locationLine = `${surahLabel} · ${pageBits.join(" · ")}`;

  return (
    <header className="flex h-[52px] min-h-[52px] shrink-0 items-center gap-2 border-b border-gray-200 bg-white/95 px-2 backdrop-blur-sm md:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        title={t("liveSession.tooltip.openMenu")}
        aria-label={t("common.openMenu")}
        className={MENU_ICON_BUTTON_CLASS}
      >
        <Menu className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <p
        className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2c5f7c]"
        style={{ fontFamily: "var(--font-ui)" }}
        title={locationLine}
      >
        {locationLine}
      </p>
    </header>
  );
}

export interface LiveSessionMobileBottomBarProps {
  isTeacher: boolean;
  annotationMode: boolean;
  onToggleAnnotation?: () => void;
  onOpenParticipants: () => void;
  onOpenMore: () => void;
  onLeave: () => void;
  onEndSession: () => void;
}

export function LiveSessionMobileBottomBar({
  isTeacher,
  annotationMode,
  onToggleAnnotation,
  onOpenParticipants,
  onOpenMore,
  onLeave,
  onEndSession,
}: LiveSessionMobileBottomBarProps) {
  const { t } = useTranslation();

  const showComingSoon = () => {
    window.alert(t("common.comingSoon"));
  };

  return (
    <nav
      className="flex h-16 min-h-[64px] shrink-0 items-center justify-between gap-1 border-t border-gray-200 bg-white/95 px-1.5 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-sm md:hidden"
      aria-label={t("liveSession.mobileBottomBar")}
    >
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
          title={t("liveSession.tooltip.raiseHand")}
          aria-label={t("liveSession.raiseHand")}
          className={cn(
            MEET_ICON_BTN_BASE,
            "h-10 w-10 bg-gradient-to-b from-amber-50 to-amber-100/90 text-amber-800 hover:from-amber-100 hover:to-amber-200/90",
          )}
        >
          <Hand className="h-5 w-5" strokeWidth={2.25} />
        </button>
      )}

      <button
        type="button"
        onClick={onOpenParticipants}
        title={t("liveSession.tooltip.participants")}
        aria-label={t("liveSession.participants")}
        className={cn(
          MEET_ICON_BTN_BASE,
          "h-10 w-10 bg-gradient-to-b from-emerald-50 to-emerald-100/90 text-emerald-800 hover:from-emerald-100 hover:to-emerald-200/90",
        )}
      >
        <Users className="h-5 w-5" strokeWidth={2.25} />
      </button>

      {isTeacher ? (
        <button
          type="button"
          onClick={onEndSession}
          title={t("liveSession.tooltip.endSessionShort")}
          aria-label={t("liveSession.endSession")}
          className="shrink-0 rounded-full bg-[#EF5350] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#E53935]"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          {t("liveSession.endSessionShort")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onLeave}
          title={t("liveSession.tooltip.leave")}
          aria-label={t("liveSession.leave")}
          className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-[#555] shadow-sm transition hover:bg-gray-50"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          {t("liveSession.leave")}
        </button>
      )}

      <button
        type="button"
        onClick={onOpenMore}
        title={t("liveSession.tooltip.overflowMore")}
        aria-label={t("liveSession.overflowMore")}
        className={cn(
          MEET_ICON_BTN_BASE,
          "h-10 w-10 bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-700 hover:from-slate-200 hover:to-slate-300/90",
        )}
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={2.25} />
      </button>
    </nav>
  );
}

export interface LiveSessionOverflowSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionStatus: SessionWsStatus;
  participantCount: number;
  elapsedLabel: string;
  isTeacher: boolean;
  autoFollow: boolean;
  onAutoFollowToggle: () => void;
}

export function LiveSessionOverflowSheet({
  open,
  onOpenChange,
  connectionStatus,
  participantCount,
  elapsedLabel,
  isTeacher,
  autoFollow,
  onAutoFollowToggle,
}: LiveSessionOverflowSheetProps) {
  const { t } = useTranslation();

  const showComingSoon = () => {
    window.alert(t("common.comingSoon"));
  };

  const statusLabelKey =
    connectionStatus === "error" || connectionStatus === "disconnected"
      ? "disconnected"
      : connectionStatus === "connected"
        ? "connected"
        : connectionStatus === "connecting"
          ? "connecting"
          : connectionStatus === "reconnecting"
            ? "reconnecting"
            : "disconnected";
  const statusLine = t(`liveSession.${statusLabelKey}`);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("liveSession.overflowMore")}>
      <div className="flex flex-col gap-4 pb-4">
        <section className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-muted/20 p-3 text-sm">
          <p className="text-[var(--color-text)]">{statusLine}</p>
          <p className="text-muted-foreground">{t("liveSession.sessionTimeLine", { time: elapsedLabel })}</p>
          <p className="text-muted-foreground">{t("liveSession.participantCountLine", { count: participantCount })}</p>
        </section>

        <section className="flex flex-col gap-0 divide-y divide-gray-100 rounded-xl border border-gray-100">
          <OverflowActionRow
            icon={<Video className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />}
            label={t("liveSession.teacherCamera")}
            tooltip={t("liveSession.tooltip.camera")}
            onClick={showComingSoon}
          />
          <OverflowActionRow
            icon={<Circle className="h-5 w-5 shrink-0 fill-rose-500 text-rose-600" aria-hidden />}
            label={t("liveSession.record")}
            tooltip={t("liveSession.tooltip.record")}
            end={<span className="text-xs text-muted-foreground">{t("common.comingSoon")}</span>}
            disabled
          />
          <OverflowActionRow
            icon={<MessageSquare className="h-5 w-5 shrink-0 text-violet-600" aria-hidden />}
            label={t("liveSession.chat")}
            tooltip={t("liveSession.tooltip.chat")}
            onClick={showComingSoon}
          />
          <OverflowActionRow
            icon={<Info className="h-5 w-5 shrink-0 text-sky-600" aria-hidden />}
            label={t("liveSession.sessionInfo")}
            tooltip={t("liveSession.tooltip.sessionInfo")}
            onClick={showComingSoon}
          />
          {!isTeacher ? (
            <button
              type="button"
              role="switch"
              aria-checked={autoFollow}
              onClick={onAutoFollowToggle}
              title={t("liveSession.tooltip.autoFollowSwitch")}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-start text-sm font-medium text-[var(--color-text)] transition hover:bg-muted/40"
            >
              <span className="min-w-0 flex-1">{t("liveSession.autoFollowOverflow")}</span>
              <span
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
                  autoFollow ? "border-[#1B5E20] bg-[#1B5E20]/15" : "border-gray-200 bg-gray-100",
                )}
              >
                <span
                  className={cn(
                    "absolute size-5 rounded-full bg-white shadow transition-transform",
                    autoFollow ? "start-6" : "start-1",
                  )}
                />
              </span>
            </button>
          ) : null}
        </section>
      </div>
    </BottomSheet>
  );
}

function OverflowActionRow({
  icon,
  label,
  tooltip,
  onClick,
  end,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  /** Long description for native tooltip (`title`). */
  tooltip?: string;
  onClick?: () => void;
  end?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      title={tooltip ?? label}
      aria-label={label}
      className="flex w-full items-center gap-3 px-3 py-3 text-start text-sm font-medium text-[var(--color-text)] transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
      <span className="min-w-0 flex-1">{label}</span>
      {end ? <span className="shrink-0">{end}</span> : null}
    </button>
  );
}
