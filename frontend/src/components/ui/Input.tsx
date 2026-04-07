// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import * as React from "react";

import { cn } from "@/lib/utils";

function InputControl({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-xl border border-input bg-[var(--color-surface)] px-3 py-2 text-start text-base text-foreground shadow-sm transition-colors outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

interface InputProps extends React.ComponentProps<"input"> {
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
      <InputControl id={inputId} className={className} aria-invalid={Boolean(error)} {...rest} />
      {error ? (
        <p className="mt-1 text-start text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { InputControl };
