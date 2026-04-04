// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const { t } = useTranslation();
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none";
  const variants: Record<Variant, string> = {
    primary:
      "bg-[var(--color-primary)] text-white hover:opacity-95 focus-visible:ring-[var(--color-primary)]",
    secondary:
      "border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-primary)]/5 focus-visible:ring-[var(--color-primary)]",
    danger:
      "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
  };
  const width = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${width} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          <span>{t("common.loading")}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
