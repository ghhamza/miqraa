// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api, userFacingApiError } from "../../lib/api";
import { useApiMutation } from "../../lib/useApiMutation";
import { roomKeys } from "../../lib/queryKeys";
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
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: roomKeys.pending(roomId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<EnrollmentWithStatus[]>(
        `rooms/${roomId}/enrollments/pending`,
        { signal },
      );
      return data;
    },
  });

  const items = pendingQuery.data ?? [];
  const loading = pendingQuery.isPending;

  useEffect(() => {
    if (pendingQuery.error) {
      setError((prev) => prev ?? userFacingApiError(pendingQuery.error));
    }
  }, [pendingQuery.error]);

  const approveMutation = useApiMutation<unknown, string>({
    mutationFn: (enrollmentId) =>
      api.put(`rooms/${roomId}/enrollments/${enrollmentId}/approve`),
    invalidates: [
      roomKeys.pending(roomId),
      roomKeys.enrollments(roomId),
      roomKeys.detail(roomId),
    ],
    onSuccess: () => onChanged(),
    onError: (message) => setError(message),
  });

  const rejectMutation = useApiMutation<unknown, string>({
    mutationFn: (enrollmentId) =>
      api.put(`rooms/${roomId}/enrollments/${enrollmentId}/reject`),
    invalidates: [
      roomKeys.pending(roomId),
      roomKeys.enrollments(roomId),
      roomKeys.detail(roomId),
    ],
    onSuccess: () => onChanged(),
    onError: (message) => setError(message),
  });

  function approve(id: string) {
    setActionId(id);
    setError(null);
    approveMutation.mutate(id, { onSettled: () => setActionId(null) });
  }

  function reject(id: string) {
    setActionId(id);
    setError(null);
    rejectMutation.mutate(id, { onSettled: () => setActionId(null) });
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
