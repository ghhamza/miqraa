// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import { FormSelect } from "../ui/select";
import { Button } from "../ui/Button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../ui/sheet";
import { SurahPicker } from "./SurahPicker";
import { getAvailableRiwayat } from "../../lib/quranService";
import type { QuranRiwaya, StudentOption } from "../../types";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "h-11 w-full box-border rounded-xl border border-gray-200 bg-white px-3 py-0 text-sm sm:text-sm text-[var(--color-text)] shadow-sm";

export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  surahFilter: number | "";
  fromDate: string;
  toDate: string;
  studentFilter: string;
  riwayaFilter: QuranRiwaya | "";
  students: StudentOption[];
  showStudentFilter: boolean;
  showRiwayaFilter: boolean;
  onSurahChange: (v: number | "") => void;
  onFromDateChange: (v: string) => void;
  onToDateChange: (v: string) => void;
  onStudentChange: (v: string) => void;
  onRiwayaChange: (v: QuranRiwaya | "") => void;
  onClear: () => void;
  onApply: () => void;
}

export function FilterSheet({
  open,
  onClose,
  surahFilter,
  fromDate,
  toDate,
  studentFilter,
  riwayaFilter,
  students,
  showStudentFilter,
  showRiwayaFilter,
  onSurahChange,
  onFromDateChange,
  onToDateChange,
  onStudentChange,
  onRiwayaChange,
  onClear,
  onApply,
}: FilterSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton
        className="flex max-h-[90vh] flex-col gap-0 p-0"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
          <SheetTitle>{t("recitations.filters")}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {showRiwayaFilter ? (
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.riwaya")}</label>
              <FormSelect
                triggerClassName={FIELD_CLASS}
                value={riwayaFilter || ""}
                onValueChange={(v) => onRiwayaChange((v || "") as QuranRiwaya | "")}
                options={[
                  { value: "", label: t("common.all") },
                  ...getAvailableRiwayat().map((r) => ({
                    value: r.id,
                    label: t(`mushaf.${r.id}`),
                  })),
                ]}
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.selectSurah")}</label>
            <SurahPicker
              value={surahFilter === "" ? null : surahFilter}
              onChange={(n) => onSurahChange(n === null ? "" : n)}
              riwaya={riwayaFilter || "hafs"}
              allowClear
            />
          </div>
          {showStudentFilter ? (
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                {t("recitations.filterStudent")}
              </label>
              <FormSelect
                triggerClassName={FIELD_CLASS}
                value={studentFilter}
                onValueChange={onStudentChange}
                options={[
                  { value: "", label: t("recitations.allStudents") },
                  ...students.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.dateFrom")}</label>
            <input
              type="date"
              className={cn(FIELD_CLASS, "min-h-11")}
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">{t("recitations.dateTo")}</label>
            <input
              type="date"
              className={cn(FIELD_CLASS, "min-h-11")}
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
            />
          </div>
        </div>
        <SheetFooter className="shrink-0 border-t border-border bg-popover px-4 py-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              onClear();
            }}
          >
            {t("recitations.clearAllFilters")}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-auto"
            onClick={() => {
              onApply();
            }}
          >
            {t("recitations.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
