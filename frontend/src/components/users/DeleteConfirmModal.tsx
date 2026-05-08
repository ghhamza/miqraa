// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { useApiMutation } from "../../lib/useApiMutation";
import { userKeys } from "../../lib/queryKeys";
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
  const [error, setError] = useState<string | null>(null);

  const deleteMutation = useApiMutation<unknown, string>({
    mutationFn: (id) => api.delete(`users/${id}`),
    invalidates: [userKeys.lists(), userKeys.stats()],
    onSuccess: () => {
      onDeleted();
      onClose();
    },
    onError: (message) => setError(message),
  });

  const loading = deleteMutation.isPending;

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function confirmDelete() {
    if (!userId || loading) return;
    setError(null);
    deleteMutation.mutate(userId);
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
