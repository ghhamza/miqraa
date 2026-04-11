// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

/** Monday-first week: 0 = Monday … 6 = Sunday */
export function mondayIndex(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** First Monday (or same) on/before the 1st of the month — grid start */
export function calendarGridStart(monthAnchor: Date): Date {
  const first = startOfMonth(monthAnchor);
  const pad = mondayIndex(first);
  const s = new Date(first);
  s.setDate(first.getDate() - pad);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Last Sunday (or same) covering the month — grid end */
export function calendarGridEnd(monthAnchor: Date): Date {
  const last = endOfMonth(monthAnchor);
  const endPad = 6 - mondayIndex(last);
  const e = new Date(last);
  e.setDate(last.getDate() + endPad);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const pad = mondayIndex(x);
  x.setDate(x.getDate() - pad);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeekSunday(d: Date): Date {
  const s = startOfWeekMonday(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
