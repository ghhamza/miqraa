// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { EnrollmentWithStatus } from "../../types";
import { Button } from "../ui/Button";
import { useLocaleDate } from "../../hooks/useLocaleDate";

interface PendingRequestsListProps {
  roomId: string;
  onChanged: () => void;
}

export function PendingRequestsList({ roomId, onChanged }: PendingRequestsListProps) {
  const { t } = useTranslation();
  const { full } = useLocaleDate();
  const [items, setItems] = useState<EnrollmentWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<EnrollmentWithStatus[]>(`rooms/${roomId}/enrollments/pending`);
      setItems(data);
    } catch (err) {
      setItems([]);
      setError(userFacingApiError(err));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string) {
    setActionId(id);
    setError(null);
    try {
      await api.put(`rooms/${roomId}/enrollments/${id}/approve`);
      await load();
      onChanged();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string) {
    setActionId(id);
    setError(null);
    try {
      await api.put(`rooms/${roomId}/enrollments/${id}/reject`);
      await load();
      onChanged();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{t("enrollment.noPendingRequests")}</p>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-3">
        {items.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-[var(--color-text)]">{e.student_name}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{e.student_email}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {t("enrollment.requestDate")}: {full(e.enrolled_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                loading={actionId === e.id}
                disabled={actionId !== null && actionId !== e.id}
                onClick={() => void approve(e.id)}
              >
                {t("enrollment.approveStudent")}
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={actionId === e.id}
                disabled={actionId !== null && actionId !== e.id}
                onClick={() => void reject(e.id)}
              >
                {t("enrollment.rejectStudent")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
