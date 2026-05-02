// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { BookMarked } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RecitationPublic, Room, User } from "../../../types";
import { Button } from "../../../components/ui/Button";
import { PageCard } from "../../../components/layout/PageCard";
import { RecentRecitationsList } from "../../../components/recitations/RecentRecitationsList";
import { EmptyState } from "../../../components/ui/EmptyState";

function canManage(user: User | null, room: Room): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && user.id === room.teacher_id;
}

export interface RoomRecitationsSectionProps {
  room: Room;
  user: User | null;
  roomRecitations: RecitationPublic[];
  recitationsLoading: boolean;
  isArchived: boolean;
  onRecitationFormOpen: () => void;
}

export function RoomRecitationsSection({
  room,
  user,
  roomRecitations,
  recitationsLoading,
  isArchived,
  onRecitationFormOpen,
}: RoomRecitationsSectionProps) {
  const { t } = useTranslation();
  const manage = canManage(user, room);

  return (
    <PageCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("recitations.roomRecitations")}</h2>
        {manage ? (
          <Button type="button" variant="primary" disabled={isArchived} onClick={() => onRecitationFormOpen()}>
            {t("recitations.addRecitation")}
          </Button>
        ) : null}
      </div>
      {recitationsLoading ? (
        <div className="flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : roomRecitations.length === 0 ? (
        <EmptyState
          icon={<BookMarked className="h-12 w-12" />}
          title={t("roomDetail.recitationsEmptyTitle")}
          description={
            manage ? t("roomDetail.recitationsEmptyDescriptionTeacher") : t("roomDetail.recitationsEmptyDescriptionStudent")
          }
          primaryAction={
            manage && !isArchived
              ? { label: t("recitations.addRecitation"), onClick: () => onRecitationFormOpen() }
              : undefined
          }
        />
      ) : (
        <RecentRecitationsList items={roomRecitations} showStudent />
      )}
    </PageCard>
  );
}
