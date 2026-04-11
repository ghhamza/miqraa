// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import * as React from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-background text-start text-sm font-medium text-foreground shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground [&>span]:line-clamp-1",
        size === "default" && "h-11 px-2.5 py-2 sm:px-3 sm:text-base",
        size === "sm" && "h-8 px-2 text-xs",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  position?: "item-aligned" | "popper";
  align?: "start" | "center" | "end";
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        align={align}
        position={position}
        className={cn(
          "relative z-50 max-h-[min(22rem,70vh)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
          <ChevronUp className="size-4" aria-hidden />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
          <ChevronDown className="size-4" aria-hidden />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-md py-2 ps-2 pe-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute end-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export interface FormSelectOption {
  value: string;
  label: React.ReactNode;
}

/**
 * Radix Select forbids `SelectItem value=""` — empty string is reserved to clear the control.
 * We still allow app code to use `value: ""` for “all / none” rows; map those to this sentinel.
 */
const FORM_SELECT_EMPTY_ITEM = "__miqraa_form_select_empty__";

function radixItemValue(appValue: string): string {
  return appValue === "" ? FORM_SELECT_EMPTY_ITEM : appValue;
}

function appValueFromRadix(radixValue: string): string {
  return radixValue === FORM_SELECT_EMPTY_ITEM ? "" : radixValue;
}

/** Controlled Radix Select with trigger + scrollable list; use for form filters instead of native `<select>`. */
export function FormSelect({
  value,
  onValueChange,
  options,
  disabled,
  required,
  triggerClassName,
  triggerStyle,
  dir,
  id,
  "aria-label": ariaLabel,
  placeholder,
  contentClassName,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: FormSelectOption[];
  disabled?: boolean;
  required?: boolean;
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  contentClassName?: string;
}) {
  return (
    <Select
      value={radixItemValue(value)}
      onValueChange={(v) => onValueChange(appValueFromRadix(v))}
      disabled={disabled}
      dir={dir}
      required={required}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={triggerClassName} style={triggerStyle}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className={cn("max-h-[min(22rem,70vh)]", contentClassName)}>
        {options.map((o) => (
          <SelectItem
            key={o.value === "" ? "__empty" : o.value}
            value={radixItemValue(o.value)}
            style={triggerStyle}
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
