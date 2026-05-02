// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../ui/EmptyState";

export function StudentEmptyHero() {
  const { t } = useTranslation();
  return (
    <EmptyState
      size="large"
      icon={<Users className="opacity-40" />}
      title={t("home.studentEmptyTitle")}
      description={t("home.studentEmptyDescription")}
      primaryAction={{
        label: t("home.studentEmptyCta"),
        to: "/rooms",
      }}
    />
  );
}
