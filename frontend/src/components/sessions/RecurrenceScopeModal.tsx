// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export interface RecurrenceScopeModalProps {
  open: boolean;
  mode: "edit" | "delete";
  sessionTitle: string;
  onClose: () => void;
  onChoose: (scope: "this" | "this_and_future" | "all", mode: "edit" | "delete") => void;
}

export function RecurrenceScopeModal({
  open,
  mode,
  sessionTitle,
  onClose,
  onChoose,
}: RecurrenceScopeModalProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const [scope, setScope] = useState<"this" | "this_and_future" | "all">("this");

  return (
    <Modal open={open} onClose={onClose} title={t("sessions.recurrenceScopeTitle")}>
      <div className="space-y-4">
        <p className="text-sm font-medium text-[var(--color-text)]">{sessionTitle}</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {mode === "edit" ? t("sessions.recurrenceScopeQuestionEdit") : t("sessions.recurrenceScopeQuestionDelete")}
        </p>
        <fieldset className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="radio"
              name={`${baseId}-scope`}
              checked={scope === "this"}
              onChange={() => setScope("this")}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <span>{t("sessions.recurrenceScopeThis")}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="radio"
              name={`${baseId}-scope`}
              checked={scope === "this_and_future"}
              onChange={() => setScope("this_and_future")}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <span>{t("sessions.recurrenceScopeFuture")}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="radio"
              name={`${baseId}-scope`}
              checked={scope === "all"}
              onChange={() => setScope("all")}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <span>{t("sessions.recurrenceScopeAll")}</span>
          </label>
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={() => onChoose(scope, mode)}>
            {t("common.continue")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
