// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface DeleteConfirmModalProps {
  open: boolean;
  userId: string | null;
  userName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteConfirmModal({
  open,
  userId,
  userName,
  onClose,
  onDeleted,
}: DeleteConfirmModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function confirmDelete() {
    if (!userId || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.delete(`users/${userId}`);
      onDeleted();
      onClose();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("users.deleteTitle")}>
      <p className="mb-6 text-[var(--color-text-muted)]">
        {t("users.deleteConfirm", { name: userName || "—" })}
      </p>
      {error ? (
        <p className="mb-4 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" className="min-w-0 flex-1" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="danger" className="min-w-0 flex-1" loading={loading} onClick={confirmDelete}>
          {t("common.delete")}
        </Button>
      </div>
    </Modal>
  );
}
