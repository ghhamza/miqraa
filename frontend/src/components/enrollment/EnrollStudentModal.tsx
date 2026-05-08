// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StudentOption } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { useAvailableStudentsForRoom, useEnrollStudent } from "../../data/rooms";

interface EnrollStudentModalProps {
  open: boolean;
  roomId: string;
  maxStudents: number;
  currentCount: number;
  onClose: () => void;
  onEnrolled: () => void;
}

export function EnrollStudentModal({
  open,
  roomId,
  maxStudents,
  currentCount,
  onClose,
  onEnrolled,
}: EnrollStudentModalProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const full = currentCount >= maxStudents;

  useEffect(() => {
    if (open) {
      setSearch("");
      setError(null);
    }
  }, [open]);

  const studentsQuery = useAvailableStudentsForRoom(roomId, open);

  const students = studentsQuery.data ?? [];
  const loading = studentsQuery.isPending && open;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [students, search]);

  const enrollMutation = useEnrollStudent(
    roomId,
    () => {
      onEnrolled();
      onClose();
    },
    (message) => setError(message),
  );

  const submitting = enrollMutation.isPending;

  function enroll(s: StudentOption) {
    if (full || submitting) return;
    setError(null);
    enrollMutation.mutate(s);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("enrollment.enrollModalTitle")}>
      {full ? (
        <p className="mb-4 text-center text-red-600" role="alert">
          {t("enrollment.roomFull")}
        </p>
      ) : null}

      <Input
        label={t("enrollment.availableStudents")}
        name="search"
        placeholder={t("enrollment.searchStudents")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error ? (
        <p className="mt-3 text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-gray-100">
        {loading ? (
          <p className="p-4 text-center text-sm text-[var(--color-text-muted)]">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-[var(--color-text-muted)]">
            {t("enrollment.noAvailableStudents")}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={full || submitting}
                  className="w-full px-4 py-3 text-right transition hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => void enroll(s)}
                >
                  <span className="font-medium text-[var(--color-text)]">{s.name}</span>
                  <span className="mt-0.5 block text-sm text-[var(--color-text-muted)]">{s.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </Modal>
  );
}
