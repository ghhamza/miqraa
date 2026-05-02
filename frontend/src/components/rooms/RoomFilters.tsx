// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useTranslation } from "react-i18next";
import type { HalaqahType } from "../../types";
import { FormSelect } from "../ui/select";

export type FilterRiwaya = "hafs" | "warsh" | "qalun";
export type ActiveFilter = "all" | "active" | "inactive";

const triggerClass =
  "h-10 border-gray-200 bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] shadow-sm";

export interface RoomFiltersProps {
  halaqahType: HalaqahType | "";
  riwaya: FilterRiwaya | "";
  activeFilter: ActiveFilter;
  onHalaqahTypeChange: (v: HalaqahType | "") => void;
  onRiwayaChange: (v: FilterRiwaya | "") => void;
  onActiveFilterChange: (v: ActiveFilter) => void;
}

export function RoomFilters({
  halaqahType,
  riwaya,
  activeFilter,
  onHalaqahTypeChange,
  onRiwayaChange,
  onActiveFilterChange,
}: RoomFiltersProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  const halaqahOptions: { value: HalaqahType | ""; labelKey: string }[] = [
    { value: "", labelKey: "common.all" },
    { value: "hifz", labelKey: "rooms.halaqahHifz" },
    { value: "tilawa", labelKey: "rooms.halaqahTilawa" },
    { value: "muraja", labelKey: "rooms.halaqahMuraja" },
    { value: "tajweed", labelKey: "rooms.halaqahTajweed" },
  ];

  const riwayaOptions: { value: FilterRiwaya | ""; labelKey: string }[] = [
    { value: "", labelKey: "common.all" },
    { value: "hafs", labelKey: "mushaf.hafs" },
    { value: "warsh", labelKey: "mushaf.warsh" },
    { value: "qalun", labelKey: "mushaf.qalun" },
  ];

  const statusOptions: { value: ActiveFilter; labelKey: string }[] = [
    { value: "all", labelKey: "common.all" },
    { value: "active", labelKey: "common.active" },
    { value: "inactive", labelKey: "common.inactive" },
  ];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3" dir={dir}>
      <div className="min-w-0">
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]" htmlFor="room-filter-status">
          {t("rooms.filterByStatus")}
        </label>
        <FormSelect
          id="room-filter-status"
          value={activeFilter}
          onValueChange={(v) => onActiveFilterChange(v as ActiveFilter)}
          dir={dir}
          aria-label={t("rooms.filterByStatus")}
          triggerClassName={triggerClass}
          options={statusOptions.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey),
          }))}
        />
      </div>

      <div className="min-w-0">
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]" htmlFor="room-filter-halaqah">
          {t("rooms.filterByHalaqahType")}
        </label>
        <FormSelect
          id="room-filter-halaqah"
          value={halaqahType}
          onValueChange={(v) => onHalaqahTypeChange(v as HalaqahType | "")}
          dir={dir}
          aria-label={t("rooms.filterByHalaqahType")}
          triggerClassName={triggerClass}
          options={halaqahOptions.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey),
          }))}
        />
      </div>

      <div className="min-w-0">
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]" htmlFor="room-filter-riwaya">
          {t("rooms.filterByRiwaya")}
        </label>
        <FormSelect
          id="room-filter-riwaya"
          value={riwaya}
          onValueChange={(v) => onRiwayaChange(v as FilterRiwaya | "")}
          dir={dir}
          aria-label={t("rooms.filterByRiwaya")}
          triggerClassName={triggerClass}
          options={riwayaOptions.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey),
          }))}
        />
      </div>
    </div>
  );
}
