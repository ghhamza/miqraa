// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useCancellableEffect } from "../../hooks/useCancellableEffect";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { HalaqahType, QuranRiwaya, Room, TeacherOption } from "../../types";
import { getAvailableRiwayat } from "../../lib/quranService";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { FormSelect } from "../ui/select";

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
  const [halaqahType, setHalaqahType] = useState<HalaqahType>("hifz");
  const [isPublic, setIsPublic] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [description, setDescription] = useState("");
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineLocal, setDeadlineLocal] = useState("");

  const todayLocalISO = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && room) {
      setName(room.name);
      setMaxStudents(room.max_students);
      setIsActive(room.is_active);
      setTeacherId("");
      setRiwaya(room.riwaya);
      setHalaqahType(room.halaqah_type);
      setIsPublic(room.is_public);
      setEnrollmentOpen(room.enrollment_open);
      setRequiresApproval(room.requires_approval);
      setDescription(room.description ?? "");
      const hasD = room.enrollment_deadline_at != null;
      setHasDeadline(hasD);
      if (room.enrollment_deadline_at) {
        const d = new Date(room.enrollment_deadline_at);
        const pad = (n: number) => String(n).padStart(2, "0");
        setDeadlineLocal(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
        );
      } else {
        setDeadlineLocal("");
      }
    } else {
      setName("");
      setMaxStudents(20);
      setIsActive(true);
      setTeacherId("");
      setRiwaya("hafs");
      setHalaqahType("hifz");
      setIsPublic(false);
      setEnrollmentOpen(true);
      setRequiresApproval(true);
      setDescription("");
      setHasDeadline(false);
      setDeadlineLocal("");
    }
  }, [open, mode, room]);

  useCancellableEffect(
    async (signal) => {
      if (!open || !isAdmin || mode !== "create") return;
      setLoadingTeachers(true);
      try {
        const { data } = await api.get<TeacherOption[]>("teachers", { signal });
        setTeachers(data);
        setTeacherId((prev) => prev || data[0]?.id || "");
      } catch (err) {
        if ((err as { name?: string })?.name === "CanceledError") return;
        setTeachers([]);
      } finally {
        if (!signal.aborted) setLoadingTeachers(false);
      }
    },
    [open, isAdmin, mode],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (hasDeadline) {
      if (!deadlineLocal.trim()) {
        setError(t("rooms.deadlineRequired"));
        return;
      }
      const parsed = new Date(deadlineLocal);
      if (parsed.getTime() < Date.now()) {
        setError(t("rooms.deadlinePast"));
        return;
      }
    }

    const enrollment_deadline_at = hasDeadline && deadlineLocal ? new Date(deadlineLocal).toISOString() : null;

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
          halaqah_type: halaqahType,
          is_public: isPublic,
          enrollment_open: enrollmentOpen,
          requires_approval: requiresApproval,
          description: description.trim() || null,
          enrollment_deadline_at,
          ...(isAdmin ? { teacher_id: teacherId } : {}),
        });
      } else if (room) {
        await api.put(`rooms/${room.id}`, {
          name: name.trim(),
          max_students: maxStudents,
          is_active: isActive,
          riwaya,
          halaqah_type: halaqahType,
          is_public: isPublic,
          enrollment_open: enrollmentOpen,
          requires_approval: requiresApproval,
          description: description.trim() || null,
          enrollment_deadline_at,
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

        <div>
          <label htmlFor="room-description" className="block text-sm font-medium text-[var(--color-text)]">
            {t("rooms.descriptionLabel")}
          </label>
          <textarea
            id="room-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t("rooms.descriptionPlaceholder")}
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("rooms.descriptionHint")}</p>
        </div>

        {isAdmin && mode === "create" ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              {t("rooms.teacher")}
            </label>
            {loadingTeachers ? (
              <p className="text-sm text-[var(--color-text-muted)]">{t("rooms.loadingTeachers")}</p>
            ) : (
              <FormSelect
                triggerClassName="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] py-2.5 text-start focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                triggerStyle={{ color: "var(--color-text)" }}
                value={teacherId}
                onValueChange={setTeacherId}
                required
                options={
                  teachers.length === 0
                    ? [{ value: "", label: t("rooms.noTeachersOption") }]
                    : teachers.map((teach) => ({
                        value: teach.id,
                        label: `${teach.name} (${teach.email})`,
                      }))
                }
              />
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
          <FormSelect
            triggerClassName="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] py-2.5 text-start focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            triggerStyle={{ color: "var(--color-text)" }}
            value={riwaya}
            onValueChange={(v) => setRiwaya(v as QuranRiwaya)}
            options={getAvailableRiwayat().map((r) => ({
              value: r.id,
              label: `${t(`mushaf.${r.id}`)} — ${r.nameAr}`,
            }))}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
            {t("rooms.halaqahType")}
          </label>
          <FormSelect
            triggerClassName="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] py-2.5 text-start focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            triggerStyle={{ color: "var(--color-text)" }}
            value={halaqahType}
            onValueChange={(v) => setHalaqahType(v as HalaqahType)}
            options={(
              [
                ["hifz", "rooms.halaqahHifz"],
                ["tilawa", "rooms.halaqahTilawa"],
                ["muraja", "rooms.halaqahMuraja"],
                ["tajweed", "rooms.halaqahTajweed"],
              ] as const
            ).map(([value, key]) => ({
              value,
              label: t(key),
            }))}
          />
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">{t("rooms.halaqahTypeHint")}</p>
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

        {isPublic && enrollmentOpen ? (
          <div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={hasDeadline}
                onChange={(e) => setHasDeadline(e.target.checked)}
                className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <span className="text-sm font-medium text-[var(--color-text)]">{t("rooms.deadlineToggleLabel")}</span>
            </label>
            <p className="ms-6 mt-1 text-xs text-[var(--color-text-muted)]">{t("rooms.deadlineToggleHint")}</p>

            {hasDeadline ? (
              <div className="ms-6 mt-3">
                <label htmlFor="room-deadline" className="block text-sm font-medium text-[var(--color-text)]">
                  {t("rooms.deadlineLabel")}
                </label>
                <input
                  id="room-deadline"
                  type="datetime-local"
                  value={deadlineLocal}
                  onChange={(e) => setDeadlineLocal(e.target.value)}
                  min={todayLocalISO}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[var(--color-text)] shadow-sm"
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("rooms.deadlineHint")}</p>
              </div>
            ) : null}
          </div>
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
