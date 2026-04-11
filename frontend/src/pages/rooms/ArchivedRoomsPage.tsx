// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DoorOpen, RotateCcw } from "lucide-react";
import { BackLink } from "../../components/navigation/BackLink";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { Paginated, Room } from "../../types";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { riwayaBadgeClass } from "../../lib/riwayaUi";

export function ArchivedRoomsPage() {
  const { t } = useTranslation();
  const { medium } = useLocaleDate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Paginated<Room>>("rooms", { params: { active: false } });
      setRooms(data.items);
    } catch (err) {
      setError(userFacingApiError(err));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(id: string) {
    setRestoringId(id);
    setError(null);
    try {
      await api.put(`rooms/${id}`, { is_active: true });
      await load();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="space-y-6">
      <BackLink to="/rooms">{t("rooms.backToRooms")}</BackLink>

      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("rooms.archivedRoomsPageTitle")}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("rooms.archivedRoomsSubtitle")}</p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-[var(--color-surface)] py-16 text-center text-[var(--color-text-muted)]">
          <DoorOpen className="mb-4 h-14 w-14 opacity-40" />
          <p>{t("rooms.archivedRoomsEmpty")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rooms.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/rooms/${r.id}`}
                    className="text-lg font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]"
                  >
                    {r.name}
                  </Link>
                  <span
                    className={`inline-flex rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold ${riwayaBadgeClass(r.riwaya)}`}
                  >
                    {t(`mushaf.${r.riwaya}`)}
                  </span>
                  <Badge variant="gray">{t("common.inactive")}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {t("rooms.teacherLabel")} {r.teacher_name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{medium(r.created_at)}</p>
              </div>
              <Button
                type="button"
                variant="primary"
                loading={restoringId === r.id}
                disabled={restoringId !== null && restoringId !== r.id}
                onClick={() => void restore(r.id)}
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {t("common.restore")}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
