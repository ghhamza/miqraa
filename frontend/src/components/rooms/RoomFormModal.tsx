// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { QuranRiwaya, Room, TeacherOption } from "../../types";
import { getAvailableRiwayat } from "../../lib/quranService";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

interface RoomFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  room: Room | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function RoomFormModal({
  open,
  mode,
  room,
  isAdmin,
  onClose,
  onSaved,
}: RoomFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [maxStudents, setMaxStudents] = useState(20);
  const [isActive, setIsActive] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riwaya, setRiwaya] = useState<QuranRiwaya>("hafs");
  const [isPublic, setIsPublic] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && room) {
      setName(room.name);
      setMaxStudents(room.max_students);
      setIsActive(room.is_active);
      setTeacherId("");
      setRiwaya(room.riwaya);
      setIsPublic(room.is_public);
      setEnrollmentOpen(room.enrollment_open);
      setRequiresApproval(room.requires_approval);
    } else {
      setName("");
      setMaxStudents(20);
      setIsActive(true);
      setTeacherId("");
      setRiwaya("hafs");
      setIsPublic(false);
      setEnrollmentOpen(true);
      setRequiresApproval(true);
    }
  }, [open, mode, room]);

  useEffect(() => {
    if (!open || !isAdmin || mode !== "create") return;
    let cancelled = false;
    setLoadingTeachers(true);
    void (async () => {
      try {
        const { data } = await api.get<TeacherOption[]>("teachers");
        if (!cancelled) {
          setTeachers(data);
          setTeacherId((prev) => prev || data[0]?.id || "");
        }
      } catch {
        if (!cancelled) setTeachers([]);
      } finally {
        if (!cancelled) setLoadingTeachers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "create") {
        if (isAdmin && !teacherId) {
          setError(t("rooms.selectTeacher"));
          setLoading(false);
          return;
        }
        await api.post("rooms", {
          name: name.trim(),
          max_students: maxStudents,
          riwaya,
          is_public: isPublic,
          enrollment_open: enrollmentOpen,
          requires_approval: requiresApproval,
          ...(isAdmin ? { teacher_id: teacherId } : {}),
        });
      } else if (room) {
        await api.put(`rooms/${room.id}`, {
          name: name.trim(),
          max_students: maxStudents,
          is_active: isActive,
          riwaya,
          is_public: isPublic,
          enrollment_open: enrollmentOpen,
          requires_approval: requiresApproval,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(userFacingApiError(err, "errors.saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? t("rooms.addRoomModal") : t("rooms.editRoomModal")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t("rooms.roomName")}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {isAdmin && mode === "create" ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              {t("rooms.teacher")}
            </label>
            {loadingTeachers ? (
              <p className="text-sm text-[var(--color-text-muted)]">{t("rooms.loadingTeachers")}</p>
            ) : (
              <select
                className="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] px-3 py-2.5 text-start focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                required
              >
                {teachers.length === 0 ? (
                  <option value="">{t("rooms.noTeachersOption")}</option>
                ) : (
                  teachers.map((teach) => (
                    <option key={teach.id} value={teach.id}>
                      {teach.name} ({teach.email})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
        ) : null}

        <Input
          label={t("rooms.maxStudents")}
          name="max_students"
          type="number"
          min={1}
          value={String(maxStudents)}
          onChange={(e) => setMaxStudents(Number(e.target.value) || 1)}
          required
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
            {t("rooms.riwayaField")}
          </label>
          <select
            className="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] px-3 py-2.5 text-start focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            value={riwaya}
            onChange={(e) => setRiwaya(e.target.value as QuranRiwaya)}
          >
            {getAvailableRiwayat().map((r) => (
              <option key={r.id} value={r.id}>
                {t(`mushaf.${r.id}`)} — {r.nameAr}
              </option>
            ))}
          </select>
        </div>

        {mode === "edit" ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-[var(--color-surface)] px-3 py-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="text-sm font-medium text-[var(--color-text)]">{t("rooms.roomActive")}</span>
          </label>
        ) : null}

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-[var(--color-surface)] px-3 py-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <div>
            <span className="text-sm font-medium text-[var(--color-text)]">{t("rooms.publicRoom")}</span>
            <p className="text-xs text-[var(--color-text-muted)]">{t("rooms.publicRoomHint")}</p>
          </div>
        </label>

        {isPublic ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-[var(--color-surface)] px-3 py-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              checked={enrollmentOpen}
              onChange={(e) => setEnrollmentOpen(e.target.checked)}
            />
            <div>
              <span className="text-sm font-medium text-[var(--color-text)]">{t("rooms.enrollmentOpen")}</span>
              <p className="text-xs text-[var(--color-text-muted)]">{t("rooms.enrollmentOpenHint")}</p>
            </div>
          </label>
        ) : null}

        {isPublic && enrollmentOpen ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-[var(--color-surface)] px-3 py-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
            />
            <div>
              <span className="text-sm font-medium text-[var(--color-text)]">{t("rooms.requiresApproval")}</span>
              <p className="text-xs text-[var(--color-text-muted)]">{t("rooms.requiresApprovalHint")}</p>
            </div>
          </label>
        ) : null}

        {error ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" variant="secondary" className="min-w-0 flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" className="min-w-0 flex-1" loading={loading}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
