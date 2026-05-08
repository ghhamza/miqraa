// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Enrollment } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useRemoveEnrolledStudent } from "../../data/rooms";

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
  const [error, setError] = useState<string | null>(null);

  const removeMutation = useRemoveEnrolledStudent(
    roomId,
    () => {
      onRemoved();
      onClose();
    },
    (message) => setError(message),
  );

  const loading = removeMutation.isPending;

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function confirm() {
    if (!enrollment || loading) return;
    setError(null);
    removeMutation.mutate(enrollment.id);
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
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" className="min-w-0 flex-1" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="danger" className="min-w-0 flex-1" loading={loading} onClick={confirm}>
          {t("enrollment.removeStudent")}
        </Button>
      </div>
    </Modal>
  );
}
