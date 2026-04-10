// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

/** Shared “video call” toolbar look: soft fills, no black border, subtle depth. */
export const MEET_ICON_BTN_BASE =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 shadow-sm transition hover:shadow-md active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#2c5f7c]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDF6E3]";

/** Icon-only menu (hamburger): no circle, no shadow — subtle hover + focus ring. */
export const MENU_ICON_BUTTON_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-slate-700 transition-colors hover:bg-slate-100/90 active:bg-slate-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c5f7c]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
