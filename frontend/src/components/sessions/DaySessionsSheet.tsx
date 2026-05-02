// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionPublic, User } from "../../types";
import { Button } from "../ui/Button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { EmptyState } from "../ui/EmptyState";
import { SessionBlock } from "./SessionBlock";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";

interface DaySessionsSheetProps {
  open: boolean;
  date: Date | null;
  sessions: SessionPublic[];
  user: User | null;
  onClose: () => void;
  onSessionClick: (s: SessionPublic) => void;
  onCreateSession: () => void;
}

function canScheduleCalendar(user: User | null): boolean {
  return user?.role === "teacher" || user?.role === "admin";
}

export function DaySessionsSheet({
  open,
  date,
  sessions,
  user,
  onClose,
  onSessionClick,
  onCreateSession,
}: DaySessionsSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = intlLocaleForAppLanguage(i18n.language);
  const manage = canScheduleCalendar(user);

  const titleDate = useMemo(() => {
    if (!date) return "";
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }, [date, locale]);

  const scheduleLabelDate = useMemo(() => {
    if (!date) return "";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
  }, [date, locale]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{date ? t("sessions.daySheetTitle", { date: titleDate }) : ""}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4">
          {sessions.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-12 w-12" />}
              title={t("sessions.daySheetEmpty")}
              description={undefined}
              primaryAction={
                manage
                  ? {
                      label: t("sessions.addSession"),
                      onClick: () => {
                        onCreateSession();
                        onClose();
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <SessionBlock session={s} onClick={() => onSessionClick(s)} />
                </li>
              ))}
            </ul>
          )}
          {manage && sessions.length > 0 ? (
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={() => {
                onCreateSession();
                onClose();
              }}
            >
              {t("sessions.scheduleOnDay", { date: scheduleLabelDate })}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
