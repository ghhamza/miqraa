// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { Enrollment } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface RemoveStudentModalProps {
  open: boolean;
  roomId: string;
  enrollment: Enrollment | null;
  onClose: () => void;
  onRemoved: () => void;
}

export function RemoveStudentModal({
  open,
  roomId,
  enrollment,
  onClose,
  onRemoved,
}: RemoveStudentModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function confirm() {
    if (!enrollment || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.delete(`rooms/${roomId}/enrollments/${enrollment.id}`);
      onRemoved();
      onClose();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("enrollment.removeTitle")}>
      <p className="mb-6 text-[var(--color-text-muted)]">
        {t("enrollment.removeConfirm", { name: enrollment?.student_name ?? "—" })}
      </p>
      {error ? (
        <p className="mb-4 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" fullWidth onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="danger" fullWidth loading={loading} onClick={confirm}>
          {t("enrollment.removeStudent")}
        </Button>
      </div>
    </Modal>
  );
}
