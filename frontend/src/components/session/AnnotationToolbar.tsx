// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, MessageSquare, RefreshCw, ThumbsUp, X } from "lucide-react";
import type { ErrorCategory, ErrorSeverity } from "../../types";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AnnotationTarget {
  surah: number;
  ayah: number;
  wordIndex: number;
  /** Position on screen for popover placement */
  rect: DOMRect;
}

export interface AnnotationToolbarProps {
  target: AnnotationTarget | null;
  onMarkError: (severity: ErrorSeverity, category: ErrorCategory, comment?: string) => void;
  onRepeat: () => void;
  onComment: (comment: string) => void;
  onGood: () => void;
  onClose: () => void;
}

const JALI_CATEGORIES: { key: ErrorCategory; labelKey: string }[] = [
  { key: "harf", labelKey: "error.harf" },
  { key: "haraka", labelKey: "error.haraka" },
  { key: "kalima", labelKey: "error.kalima" },
  { key: "waqf_qabih", labelKey: "error.waqf_qabih" },
];

const KHAFI_CATEGORIES: { key: ErrorCategory; labelKey: string }[] = [
  { key: "makharij", labelKey: "error.makharij" },
  { key: "sifat", labelKey: "error.sifat" },
  { key: "tafkhim", labelKey: "error.tafkhim" },
  { key: "madd", labelKey: "error.madd" },
  { key: "ghunnah", labelKey: "error.ghunnah" },
  { key: "noon_sakin", labelKey: "error.noon_sakin" },
  { key: "meem_sakin", labelKey: "error.meem_sakin" },
  { key: "waqf_ibtida", labelKey: "error.waqf_ibtida" },
  { key: "shadda", labelKey: "error.shadda" },
  { key: "other", labelKey: "error.other" },
];

const ANCHOR_STYLE: CSSProperties = {
  position: "fixed",
  pointerEvents: "none",
};

export function AnnotationToolbar({
  target,
  onMarkError,
  onRepeat,
  onComment,
  onGood,
  onClose,
}: AnnotationToolbarProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<"main" | "error" | "comment">("main");
  const [commentText, setCommentText] = useState("");

  const onCloseStable = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!target) return null;

  const r = target.rect;

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
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        }}
      />
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          "z-[320] w-auto max-w-[min(100vw-2rem,28rem)] gap-0 border-gray-200 bg-[var(--color-surface)] p-0 shadow-lg",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative rounded-xl p-2">
          <button
            type="button"
            className="absolute -top-2 -end-2 rounded-full bg-gray-200 p-0.5 text-gray-600 hover:bg-gray-300"
            onClick={onCloseStable}
            aria-label={t("common.close")}
          >
            <X className="h-3 w-3" />
          </button>

          {view === "main" ? (
            <div className="flex gap-1.5">
              <ToolbarBtn
                icon={<AlertTriangle className="h-4 w-4" />}
                label={t("annotation.error")}
                color="text-red-600 bg-red-50 hover:bg-red-100"
                onClick={() => setView("error")}
              />
              <ToolbarBtn
                icon={<RefreshCw className="h-4 w-4" />}
                label={t("annotation.repeat")}
                color="text-amber-600 bg-amber-50 hover:bg-amber-100"
                onClick={() => {
                  onRepeat();
                  onCloseStable();
                }}
              />
              <ToolbarBtn
                icon={<MessageSquare className="h-4 w-4" />}
                label={t("annotation.comment")}
                color="text-blue-600 bg-blue-50 hover:bg-blue-100"
                onClick={() => setView("comment")}
              />
              <ToolbarBtn
                icon={<ThumbsUp className="h-4 w-4" />}
                label={t("annotation.good")}
                color="text-green-700 bg-green-50 hover:bg-green-100"
                onClick={() => {
                  onGood();
                  onCloseStable();
                }}
              />
            </div>
          ) : view === "error" ? (
            <div className="max-h-[50vh] w-64 overflow-y-auto space-y-2">
              <p className="text-xs font-semibold text-red-700">{t("annotation.lahnJali")}</p>
              <div className="flex flex-wrap gap-1">
                {JALI_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800 transition hover:bg-red-100"
                    onClick={() => {
                      onMarkError("jali", c.key);
                      onCloseStable();
                    }}
                  >
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-amber-700">{t("annotation.lahnKhafi")}</p>
              <div className="flex flex-wrap gap-1">
                {KHAFI_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 transition hover:bg-amber-100"
                    onClick={() => {
                      onMarkError("khafi", c.key);
                      onCloseStable();
                    }}
                  >
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-1 text-xs text-[var(--color-text-muted)] hover:underline"
                onClick={() => setView("main")}
              >
                ← {t("common.back")}
              </button>
            </div>
          ) : (
            <div className="w-56 space-y-2">
              <textarea
                className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm"
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t("annotation.commentPlaceholder")}
                autoFocus
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-gray-100"
                  onClick={() => setView("main")}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="rounded-md bg-[var(--color-primary)] px-2 py-1 text-xs text-white"
                  onClick={() => {
                    if (commentText.trim()) {
                      onComment(commentText.trim());
                      onCloseStable();
                    }
                  }}
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ToolbarBtn({
  icon,
  label,
  color,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-xs font-medium transition ${color}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
