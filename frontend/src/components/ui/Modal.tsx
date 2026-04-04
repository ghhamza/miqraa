// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--color-surface)] px-5 py-6 shadow-xl transition-all duration-200 sm:px-8 sm:py-7"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <h2 className="mb-4 text-lg font-bold text-[var(--color-text)]">{title}</h2>
        {children}
      </div>
    </div>
  );
}
