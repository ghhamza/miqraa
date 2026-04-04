// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Crown, Mic, MicOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { SessionParticipant } from "../../hooks/useSessionState";

interface ParticipantDrawerProps {
  open: boolean;
  onClose: () => void;
  participants: SessionParticipant[];
  teacherId: string;
  activeReciterId: string | null;
  isTeacher: boolean;
  onSetReciter: (userId: string) => void;
  teacherVideoRef: RefObject<HTMLVideoElement | null>;
  /** Teacher-only grading UI below the list */
  gradingPanel?: ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function ParticipantDrawer({
  open,
  onClose,
  participants,
  teacherId,
  activeReciterId,
  isTeacher,
  onSetReciter,
  teacherVideoRef,
  gradingPanel,
}: ParticipantDrawerProps) {
  const { t } = useTranslation();

  const asideRef = useRef<HTMLElement>(null);

  const sorted = [...participants].sort((a, b) => {
    if (a.userId === teacherId) return -1;
    if (b.userId === teacherId) return 1;
    return a.name.localeCompare(b.name, "ar");
  });

  useEffect(() => {
    if (!open) return;
    const el = asideRef.current?.querySelector<HTMLButtonElement>("button[aria-label]");
    el?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30 md:bg-black/20"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <aside
        ref={asideRef}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] w-full flex-col rounded-t-2xl border border-gray-100 bg-[#FFFFFF] shadow-xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-80 md:rounded-none md:rounded-l-2xl"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("liveSession.participants")}</h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("common.close")}>
            <X className="size-4" />
          </Button>
        </div>

        <ul className="max-h-[40vh] shrink-0 overflow-y-auto px-3 py-2 md:max-h-none md:flex-1">
          {sorted.map((p) => {
            const isT = p.userId === teacherId;
            const isReciter = activeReciterId === p.userId;
            return (
              <li
                key={p.userId}
                className={`mb-2 flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  isReciter ? "border-[#D4A843] shadow-[0_0_0_1px_rgba(212,168,67,0.35)]" : "border-transparent bg-muted/30"
                }`}
              >
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  aria-hidden
                >
                  {initials(p.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isT ? <Crown className="size-4 shrink-0 text-[#1B5E20]" aria-hidden /> : null}
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        isT ? "bg-[#1B5E20]/10 text-[#1B5E20]" : "bg-gray-100 text-[#6B7280]"
                      }`}
                    >
                      {p.role === "teacher" ? t("liveSession.teacherBadge") : t("liveSession.studentBadge")}
                    </span>
                    {p.isMuted ? (
                      <MicOff className="size-4 text-[#EF5350]" aria-label={t("liveSession.mute")} />
                    ) : (
                      <Mic className="size-4 text-[#4CAF50]" aria-label={t("liveSession.unmute")} />
                    )}
                  </div>
                </div>
                {isTeacher && !isT && p.role === "student" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="shrink-0"
                    onClick={() => onSetReciter(p.userId)}
                  >
                    {t("liveSession.setReciter")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {gradingPanel}

        <div className="border-t border-gray-100 p-4">
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">{t("liveSession.teacherCamera")}</p>
          <div
            className="relative overflow-hidden rounded-lg bg-muted"
            style={{ width: 200, height: 150 }}
          >
            <video
              ref={teacherVideoRef}
              className="absolute inset-0 size-full object-cover"
              autoPlay
              playsInline
              muted={false}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
