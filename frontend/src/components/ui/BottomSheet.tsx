// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible title (visually hidden; shown to screen readers). */
  title: string;
  children: ReactNode;
  className?: string;
  /** Optional footer pinned below scroll area. */
  footer?: ReactNode;
}

/**
 * Mobile-oriented bottom sheet: portal + backdrop, slides up from bottom, max height ~75vh.
 * Use for overflow menus and action panels that must escape `overflow-hidden` ancestors.
 */
export function BottomSheet({ open, onOpenChange, title, children, className, footer }: BottomSheetProps) {
  const { t } = useTranslation();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[70] bg-black/40",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          aria-modal="true"
          className={cn(
            "fixed inset-x-0 bottom-0 z-[70] flex max-h-[75vh] flex-col rounded-t-2xl border border-gray-200 bg-[var(--color-surface)] shadow-xl outline-none",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 duration-300",
            className,
          )}
          style={{ fontFamily: "var(--font-ui)" }}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div className="relative flex shrink-0 justify-center px-4 pb-2 pt-1">
            <div className="h-1 w-10 shrink-0 rounded-full bg-gray-300" aria-hidden />
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute end-2 top-0"
                aria-label={t("common.close")}
                title={t("common.closePanel")}
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">{children}</div>
          {footer ? <div className="shrink-0 border-t border-gray-100 px-4 pt-3">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
