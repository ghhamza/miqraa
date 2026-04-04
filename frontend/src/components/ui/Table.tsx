// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { Fragment, type ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage: string;
  emptyIcon?: ReactNode;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isRowExpanded?: (row: T) => boolean;
  renderExpandedRow?: (row: T) => ReactNode;
}

export function Table<T>({
  columns,
  data,
  emptyMessage,
  emptyIcon,
  rowKey,
  onRowClick,
  isRowExpanded,
  renderExpandedRow,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-[var(--color-surface)] py-16 text-center text-[var(--color-text-muted)]">
        {emptyIcon ? <div className="mb-3 opacity-60">{emptyIcon}</div> : null}
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-[var(--color-surface)] shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-right text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-semibold text-[var(--color-text)] ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const key = rowKey(row);
            const expanded = Boolean(renderExpandedRow && isRowExpanded?.(row));
            return (
              <Fragment key={key}>
                <tr
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-gray-50 last:border-0 ${
                    onRowClick ? "cursor-pointer hover:bg-gray-50/70" : "hover:bg-gray-50/50"
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-[var(--color-text)] ${col.className ?? ""}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
                {expanded ? (
                  <tr className="border-b border-gray-100 bg-[var(--color-bg)] last:border-0">
                    <td colSpan={columns.length} className="px-4 py-3 text-sm text-[var(--color-text)]">
                      {renderExpandedRow!(row)}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
