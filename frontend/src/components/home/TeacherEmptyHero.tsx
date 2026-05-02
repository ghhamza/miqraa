// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../ui/EmptyState";

interface TeacherEmptyHeroProps {
  onCreateClick: () => void;
}

export function TeacherEmptyHero({ onCreateClick }: TeacherEmptyHeroProps) {
  const { t } = useTranslation();
  return (
    <EmptyState
      size="large"
      icon={<BookOpen className="opacity-40" />}
      title={t("home.teacherEmptyTitle")}
      description={t("home.teacherEmptyDescription")}
      primaryAction={{
        label: t("home.teacherEmptyCta"),
        onClick: onCreateClick,
      }}
    />
  );
}
