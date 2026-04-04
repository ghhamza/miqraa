// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-medium text-[var(--color-text)]"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-xl border bg-[var(--color-surface)] px-3 py-2.5 text-right text-[var(--color-text)] shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 ${
          error ? "border-red-500" : "border-gray-200"
        } ${className}`}
        dir="rtl"
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-right text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
