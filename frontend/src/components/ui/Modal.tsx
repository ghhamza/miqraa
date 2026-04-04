// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "./dialog";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        className="max-w-lg gap-0 rounded-2xl border border-gray-100 bg-[var(--color-surface)] px-5 py-6 shadow-xl sm:max-w-lg sm:px-8 sm:py-7"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <DialogTitle className="mb-4 text-lg font-bold text-[var(--color-text)]">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
