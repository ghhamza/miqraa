// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useArchiveRoom } from "../../data/rooms";

interface ArchiveRoomModalProps {
  open: boolean;
  roomId: string | null;
  roomName: string;
  onClose: () => void;
  onArchived: () => void;
}

/** Archives the room (sets inactive). The API uses DELETE but only deactivates the row. */
export function ArchiveRoomModal({ open, roomId, roomName, onClose, onArchived }: ArchiveRoomModalProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const archiveMutation = useArchiveRoom(
    () => {
      onArchived();
      onClose();
    },
    (message) => setError(message),
  );

  const loading = archiveMutation.isPending;

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function confirmArchive() {
    if (!roomId || loading) return;
    setError(null);
    archiveMutation.mutate(roomId);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("rooms.archiveTitle")}>
      <p className="mb-6 text-[var(--color-text-muted)]">
        {t("rooms.archiveConfirm", { name: roomName || "—" })}
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
        <Button type="button" variant="danger" className="min-w-0 flex-1" loading={loading} onClick={confirmArchive}>
          {t("common.archive")}
        </Button>
      </div>
    </Modal>
  );
}
