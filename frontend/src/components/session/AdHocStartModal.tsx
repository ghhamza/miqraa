// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { QuranRiwaya, RecitationPublic, TurnType } from "../../types";
import { getSurahAyahCount } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { SurahPicker } from "../recitations/SurahPicker";
import { FormSelect } from "../ui/select";
import { useCreateAndStartRecitation } from "../../data/recitations";

export interface AdHocStartModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string | null;
  sessionId: string;
  roomId: string;
  riwaya: QuranRiwaya;
  onSuccess: (rec: RecitationPublic) => void;
  onErrorMessage: (message: string) => void;
}

export function AdHocStartModal({
  open,
  onClose,
  studentId,
  sessionId,
  roomId,
  riwaya,
  onSuccess,
  onErrorMessage,
}: AdHocStartModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const riw = riwaya as Riwaya;
  const [surah, setSurah] = useState<number | null>(1);
  const [ayahStart, setAyahStart] = useState(1);
  const [ayahEnd, setAyahEnd] = useState(1);
  const [turnType, setTurnType] = useState<TurnType>("dars");
  const [error, setError] = useState<string | null>(null);

  const surahNum = surah ?? 1;
  const maxAyah = getSurahAyahCount(surahNum, riw);

  const adHocMutation = useCreateAndStartRecitation(
    (started) => {
      onSuccess(started);
      onClose();
    },
    (message) => {
      setError(message);
      onErrorMessage(message);
    },
  );

  const submitting = adHocMutation.isPending;

  const handleSubmit = () => {
    if (!studentId || surah == null) return;
    setError(null);
    adHocMutation.mutate({
      studentId,
      surahNum,
      ayahStart,
      ayahEnd,
      turnType,
      maxAyah,
      roomId,
      sessionId,
      riwaya,
    });
  };

  return (
    <Modal open={open} title={t("liveSession.adHocTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("recitations.surah")}</label>
          <SurahPicker value={surah} onChange={setSurah} riwaya={riwaya} className="w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t("recitations.ayahStart")}</span>
            <input
              type="number"
              min={1}
              max={maxAyah}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              value={ayahStart}
              onChange={(e) => setAyahStart(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t("recitations.ayahEnd")}</span>
            <input
              type="number"
              min={1}
              max={maxAyah}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              value={ayahEnd}
              onChange={(e) => setAyahEnd(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{t("liveSession.turnTypeLabel")}</span>
          <FormSelect
            value={String(turnType)}
            onValueChange={(v) => setTurnType(v as TurnType)}
            dir={isRtl ? "rtl" : "ltr"}
            options={[
              { value: "dars", label: t("sessions.tab_dars") },
              { value: "tathbit", label: t("sessions.tab_tathbit") },
              { value: "muraja", label: t("sessions.tab_muraja") },
            ]}
            triggerClassName="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || !studentId || surah == null}>
            {t("liveSession.actionGiveMic")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
