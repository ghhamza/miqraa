// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useTranslation } from "react-i18next";
import type { RecitationPublic } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { getSurahNameWithArabic } from "../../lib/quranService";

interface DeleteRecitationModalProps {
  open: boolean;
  recitation: RecitationPublic | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteRecitationModal({
  open,
  recitation,
  onClose,
  onConfirm,
  loading,
}: DeleteRecitationModalProps) {
  const { t, i18n } = useTranslation();
  if (!recitation) return null;
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  return (
    <Modal open={open} onClose={onClose} title={t("common.delete")}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text)]">{t("recitations.deleteConfirm")}</p>
        <div className="rounded-xl border border-gray-100 bg-[var(--color-bg)] p-3 text-sm">
          <p className="font-semibold text-[var(--color-text)]">{recitation.student_name}</p>
          <p className="mt-1" style={{ fontFamily: "var(--font-quran)" }}>
            {getSurahNameWithArabic(recitation.surah, loc)} · {recitation.ayah_start}–{recitation.ayah_end}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="danger" loading={loading} onClick={() => void onConfirm()}>
            {t("common.delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
