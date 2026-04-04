// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import type { SessionPublic } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useLocaleDate } from "../../hooks/useLocaleDate";

interface DeleteSessionModalProps {
  open: boolean;
  session: SessionPublic | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteSessionModal({
  open,
  session,
  onClose,
  onConfirm,
  loading,
}: DeleteSessionModalProps) {
  const { t } = useTranslation();
  const { mediumTime } = useLocaleDate();
  if (!session) return null;

  const blocked = session.status === "completed" || session.status === "in_progress";
  const title = session.title?.trim() || t("sessions.untitledTitle");

  return (
    <Modal open={open} onClose={onClose} title={t("sessions.deleteSession")}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text)]">{t("sessions.deleteConfirm")}</p>
        <div className="rounded-xl border border-gray-100 bg-[var(--color-bg)] p-3 text-sm">
          <p className="font-semibold text-[var(--color-text)]">{title}</p>
          <p className="text-[var(--color-text-muted)]">{session.room_name}</p>
          <p className="text-[var(--color-text-muted)]">{mediumTime(session.scheduled_at)}</p>
        </div>
        {blocked ? (
          <p className="text-sm text-amber-700">{t("sessions.cannotDeleteState")}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={loading || blocked}
            onClick={() => void onConfirm()}
          >
            {loading ? t("common.loading") : t("common.delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
