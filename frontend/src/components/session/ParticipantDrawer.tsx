// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { type ReactNode } from "react";
import { Crown, Mic, MicOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui/Button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { cn } from "@/lib/utils";
import type { SessionParticipant } from "../../hooks/useSessionState";

interface ParticipantDrawerProps {
  open: boolean;
  onClose: () => void;
  participants: SessionParticipant[];
  teacherId: string;
  activeReciterId: string | null;
  isTeacher: boolean;
  onSetReciter: (userId: string) => void;
  /** Teacher-only grading UI below the list */
  gradingPanel?: ReactNode;
  /** Same pattern as mushaf navigator: LTR → right edge, RTL → left edge. */
  side?: "left" | "right";
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
  gradingPanel,
  side: sideProp,
}: ParticipantDrawerProps) {
  const { t, i18n } = useTranslation();

  const sheetSide =
    sideProp ?? (i18n.language?.startsWith("ar") ? "left" : "right");

  const sorted = [...participants].sort((a, b) => {
    if (a.userId === teacherId) return -1;
    if (b.userId === teacherId) return 1;
    return a.name.localeCompare(b.name, "ar");
  });

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={sheetSide}
        showCloseButton={false}
        className="flex h-full max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
      >
        <SheetHeader className="flex shrink-0 flex-row items-center gap-3 space-y-0 border-b border-border px-4 py-3">
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={t("common.close")}
            >
              <X className="size-4" strokeWidth={2.25} />
            </Button>
          </SheetClose>
          <div className="min-w-0 flex-1 space-y-0.5">
            <SheetTitle className="text-start font-heading text-base font-semibold leading-tight text-foreground">
              {t("liveSession.participants")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("liveSession.participantsSheetDescription")}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          <ul className="flex flex-col gap-0.5" role="list">
            {sorted.map((p) => {
              const isT = p.userId === teacherId;
              const isReciter = activeReciterId === p.userId;
              return (
                <li key={p.userId}>
                  <div
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-1 py-2.5 text-start text-sm transition-colors sm:px-0",
                      "hover:bg-muted/80",
                      isReciter && "bg-muted font-medium text-foreground",
                    )}
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
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5",
                            isT ? "bg-[#1B5E20]/10 text-[#1B5E20]" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {p.role === "teacher" ? t("liveSession.teacherBadge") : t("liveSession.studentBadge")}
                        </span>
                        {p.isMuted ? (
                          <MicOff className="size-4 shrink-0 text-[#EF5350]" aria-label={t("liveSession.mute")} />
                        ) : (
                          <Mic className="size-4 shrink-0 text-[#4CAF50]" aria-label={t("liveSession.unmute")} />
                        )}
                      </div>
                    </div>
                    {isTeacher && !isT && p.role === "student" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="shrink-0"
                        onClick={() => onSetReciter(p.userId)}
                      >
                        {t("liveSession.setReciter")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {gradingPanel ? (
            <div className="mt-5 border-t border-border pt-4">{gradingPanel}</div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
