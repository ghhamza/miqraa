// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { AnnotationKind, ErrorAnnotation } from "../../types";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface StudentAnnotationPopoverProps {
  annotations: ErrorAnnotation[];
  rect: DOMRect | null;
  onClose: () => void;
  /** Keep the hover panel open while the pointer moves from the word into the surface. */
  onPopoverCardEnter: () => void;
  /** Start delayed close when leaving the surface (hover mode only; parent checks pin). */
  onPopoverCardLeave: () => void;
}

const ANCHOR_STYLE: CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
};

/** Notes and any teacher comment need room — use Popover; compact errors/repeat/good use Tooltip. */
export function needsRichStudentFeedbackPopover(annotations: ErrorAnnotation[]): boolean {
  if (annotations.length === 0) return false;
  return annotations.some(
    (a) =>
      a.annotation_kind === "note" ||
      (a.teacher_comment != null && a.teacher_comment.trim().length > 0),
  );
}

function annotationHeadline(a: ErrorAnnotation, t: (k: string) => string): string {
  const kind = t(`annotation.kind.${a.annotation_kind}`);
  if (a.annotation_kind === "error") {
    return `${kind} · ${t(`annotation.severity.${a.error_severity}`)} · ${t(`error.${a.error_category}`)}`;
  }
  return kind;
}

const STUDENT_FEEDBACK_SURFACE = "border border-white/15 bg-black text-zinc-100 shadow-lg";

function kindAccentOnDark(kind: AnnotationKind): string {
  switch (kind) {
    case "error":
      return "text-red-300";
    case "repeat":
      return "text-sky-300";
    case "note":
      return "text-zinc-50";
    case "good":
      return "text-emerald-300";
    default:
      return "text-zinc-50";
  }
}

function StudentFeedbackTooltip({
  annotations,
  rect,
  onClose,
  onPopoverCardEnter,
  onPopoverCardLeave,
}: StudentAnnotationPopoverProps) {
  const { t, i18n } = useTranslation();

  if (!rect || annotations.length === 0) return null;

  const lines = annotations.map((a) => annotationHeadline(a, t));

  return (
    <Tooltip open onOpenChange={(open) => !open && onClose()}>
      <TooltipTrigger asChild>
        <div
          style={{
            ...ANCHOR_STYLE,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          aria-hidden
        />
      </TooltipTrigger>
      <TooltipContent
        dir={i18n.dir()}
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={12}
        onPointerEnter={onPopoverCardEnter}
        onPointerLeave={onPopoverCardLeave}
        className={cn(
          "z-[320] flex max-w-xs flex-col gap-1.5 px-3 py-2 text-xs",
          STUDENT_FEEDBACK_SURFACE,
          "[&>svg:last-child]:hidden",
        )}
      >
        {annotations.length === 1 ? (
          <p className="text-start font-medium leading-snug text-white">{lines[0]}</p>
        ) : (
          <div className="space-y-1.5">
            <p className="font-semibold leading-snug text-white">{t("annotation.studentPopover.title")}</p>
            <div className="space-y-0.5 text-start leading-snug text-zinc-300">
              {lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function StudentFeedbackPopover({
  annotations,
  rect,
  onClose,
  onPopoverCardEnter,
  onPopoverCardLeave,
}: StudentAnnotationPopoverProps) {
  const { t, i18n } = useTranslation();

  if (!rect || annotations.length === 0) return null;

  return (
    <Popover
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverAnchor
        style={{
          ...ANCHOR_STYLE,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
      <PopoverContent
        dir={i18n.dir()}
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          "z-[320] w-[min(280px,calc(100vw-24px))] gap-0 p-0",
          STUDENT_FEEDBACK_SURFACE,
        )}
        onMouseEnter={onPopoverCardEnter}
        onMouseLeave={onPopoverCardLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
        aria-label={t("annotation.studentPopover.title")}
      >
        <div className="px-3 pb-3 pt-2">
          <div className="mb-2 flex items-start justify-between gap-2">
            {annotations.length > 1 ? (
              <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white">
                {t("annotation.studentPopover.title")}
              </p>
            ) : (
              <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white">
                {annotationHeadline(annotations[0], t)}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="-me-1 -mt-0.5 shrink-0 rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {annotations.length === 1 ? (
            annotations[0].teacher_comment?.trim() ? (
              <p className="max-h-[min(50vh,20rem)] overflow-y-auto text-sm leading-relaxed text-zinc-200">
                {annotations[0].teacher_comment}
              </p>
            ) : null
          ) : (
            <div className="max-h-[min(50vh,20rem)] space-y-3 overflow-y-auto">
              {annotations.map((a) => (
                <div key={a.id} className="space-y-1 border-b border-white/10 pb-3 last:border-0 last:pb-0">
                  <p className={cn("text-sm font-medium leading-snug", kindAccentOnDark(a.annotation_kind))}>
                    {annotationHeadline(a, t)}
                  </p>
                  {a.teacher_comment?.trim() ? (
                    <p className="text-sm leading-relaxed text-zinc-300">{a.teacher_comment}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function StudentAnnotationPopover(props: StudentAnnotationPopoverProps) {
  if (!props.rect || props.annotations.length === 0) return null;
  if (needsRichStudentFeedbackPopover(props.annotations)) {
    return <StudentFeedbackPopover {...props} />;
  }
  return <StudentFeedbackTooltip {...props} />;
}
