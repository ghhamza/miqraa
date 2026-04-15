// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import {
  getAvailableRiwayat,
  getSurahAyahCount,
  isValidAyahRange,
} from "../../lib/quranService";
import type {
  Paginated,
  QuranRiwaya,
  RecitationGrade,
  RecitationPublic,
  Room,
  SessionPublic,
  StudentOption,
} from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { FormSelect } from "../ui/select";
import { SurahPicker } from "./SurahPicker";
import { AyahRangeAudioButton } from "./AyahRangeAudioButton";
import { intlLocaleForAppLanguage } from "../../lib/intlLocale";

interface RecitationFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  recitation: RecitationPublic | null;
  defaultStudentId?: string;
  defaultRoomId?: string;
  /** Shown immediately for readonly room row (lists load async). */
  defaultRoomName?: string;
  defaultSessionId?: string;
  /** Shown for readonly session row when list may omit this session (e.g. cancelled). */
  defaultSessionSummary?: string;
  onClose: () => void;
  onSaved: () => void;
}

const GRADES: RecitationGrade[] = ["excellent", "good", "needs_work", "weak"];

function gradeLabelKey(g: RecitationGrade): string {
  return g === "needs_work" ? "needsWork" : g;
}

export function RecitationFormModal({
  open,
  mode,
  recitation,
  defaultStudentId,
  defaultRoomId,
  defaultRoomName,
  defaultSessionId,
  defaultSessionSummary,
  onClose,
  onSaved,
}: RecitationFormModalProps) {
  const { t, i18n } = useTranslation();
  const intlLocale = intlLocaleForAppLanguage(i18n.language);
  const user = useAuthStore((s) => s.user);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sessions, setSessions] = useState<SessionPublic[]>([]);
  const [studentId, setStudentId] = useState("");
  const [roomId, setRoomId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [surah, setSurah] = useState(1);
  const [ayahStart, setAyahStart] = useState(1);
  const [ayahEnd, setAyahEnd] = useState(1);
  const [grade, setGrade] = useState<RecitationGrade | "">("");
  const [notes, setNotes] = useState("");
  const [riwaya, setRiwaya] = useState<QuranRiwaya>("hafs");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxAyah = getSurahAyahCount(surah, riwaya);

  const ayahStartOptions = useMemo(
    () => Array.from({ length: maxAyah }, (_, i) => i + 1),
    [maxAyah],
  );

  const ayahEndOptions = useMemo(
    () => Array.from({ length: Math.max(0, maxAyah - ayahStart + 1) }, (_, i) => ayahStart + i),
    [maxAyah, ayahStart],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && recitation) {
      setStudentId(recitation.student_id ?? "");
      setRoomId(recitation.room_id ?? "");
      setSessionId(recitation.session_id ?? "");
      setSurah(recitation.surah);
      setAyahStart(recitation.ayah_start);
      setAyahEnd(recitation.ayah_end);
      setGrade(recitation.grade ?? "");
      setNotes(recitation.teacher_notes ?? "");
      setRiwaya(recitation.riwaya);
    } else {
      setStudentId(defaultStudentId ?? "");
      setRoomId(defaultRoomId ?? "");
      setSessionId(defaultSessionId ?? "");
      setSurah(1);
      setAyahStart(1);
      setAyahEnd(1);
      setGrade("");
      setNotes("");
      setRiwaya("hafs");
    }
  }, [open, mode, recitation, defaultStudentId, defaultRoomId, defaultSessionId]);

  useEffect(() => {
    if (!roomId) return;
    const r = rooms.find((x) => x.id === roomId);
    if (r) setRiwaya(r.riwaya);
  }, [roomId, rooms]);

  useEffect(() => {
    setAyahStart((a) => Math.min(Math.max(1, a), maxAyah));
    setAyahEnd((e) => Math.min(Math.max(1, e), maxAyah));
  }, [surah, maxAyah]);

  useEffect(() => {
    setAyahEnd((e) => Math.max(ayahStart, Math.min(e, maxAyah)));
  }, [ayahStart, maxAyah]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data: roomsPage } = await api.get<Paginated<Room>>("rooms");
        const roomList = roomsPage.items;
        if (!cancelled) {
          const mine =
            user.role === "admin"
              ? roomList
              : roomList.filter((r) => r.teacher_id === user.id);
          setRooms(mine);
        }
        if (user.role === "admin") {
          const { data: studs } = await api.get<StudentOption[]>("students");
          if (!cancelled) setStudents(studs);
        } else if (user.role === "teacher") {
          const mine = roomList.filter((r) => r.teacher_id === user.id);
          const map = new Map<string, StudentOption>();
          for (const r of mine) {
            try {
              const { data: ens } = await api.get<{ student_id: string; student_name: string; student_email: string }[]>(
                `rooms/${r.id}/enrollments`,
              );
              for (const e of ens) {
                if (!map.has(e.student_id)) {
                  map.set(e.student_id, {
                    id: e.student_id,
                    name: e.student_name,
                    email: e.student_email,
                  });
                }
              }
            } catch {
              /* skip */
            }
          }
          if (!cancelled) setStudents([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch {
        if (!cancelled) {
          setRooms([]);
          setStudents([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  useEffect(() => {
    if (!open || !roomId) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<SessionPublic[]>(`rooms/${roomId}/sessions`);
        const ok = data.filter(
          (s) =>
            s.status === "scheduled" ||
            s.status === "in_progress" ||
            s.status === "completed" ||
            (defaultSessionId && s.id === defaultSessionId),
        );
        if (!cancelled) setSessions(ok);
      } catch {
        if (!cancelled) setSessions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, roomId, defaultSessionId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!isValidAyahRange(surah, ayahStart, ayahEnd, riwaya)) {
      setError(t("errors.badRequest"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "create") {
        await api.post("recitations", {
          student_id: studentId,
          room_id: roomId || null,
          session_id: sessionId || null,
          surah,
          ayah_start: ayahStart,
          ayah_end: ayahEnd,
          grade: null,
          teacher_notes: null,
          riwaya,
        });
      } else if (recitation) {
        await api.put(`recitations/${recitation.id}`, {
          surah,
          ayah_start: ayahStart,
          ayah_end: ayahEnd,
          grade: grade || null,
          teacher_notes: notes.trim() || null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(userFacingApiError(err));
    } finally {
      setLoading(false);
    }
  }

  const studentLocked = mode === "edit" || !!defaultStudentId;

  const roomReadOnly = mode === "create" && !!defaultRoomId;
  const sessionReadOnly = mode === "create" && !!defaultSessionId;

  const selectedRoomName = rooms.find((r) => r.id === roomId)?.name ?? defaultRoomName ?? "—";
  const selectedSession = sessions.find((s) => s.id === sessionId);
  const selectedSessionLabel = selectedSession
    ? `${selectedSession.title?.trim() || selectedSession.room_name} · ${new Date(selectedSession.scheduled_at).toLocaleString(intlLocale)}`
    : sessionReadOnly && defaultSessionSummary
      ? defaultSessionSummary
      : sessionId
        ? t("common.loading")
        : "—";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? t("recitations.addRecitation") : t("recitations.editRecitation")}
    >
      <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]" htmlFor="rec-student">
            {t("recitations.student")}
          </label>
          {mode === "edit" && recitation && recitation.student_id === null ? (
            <p id="rec-student" className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[var(--color-text-muted)]">
              {t("recitations.deletedStudent")}
            </p>
          ) : (
            <FormSelect
              id="rec-student"
              required={mode === "create"}
              disabled={studentLocked}
              triggerClassName="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm"
              value={studentId}
              onValueChange={setStudentId}
              options={[
                {
                  value: "",
                  label: students.length === 0 ? t("common.loading") : t("recitations.selectStudent"),
                },
                ...students.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="rec-surah-picker">
            {t("recitations.selectSurah")}
          </label>
          <div id="rec-surah-picker">
            <SurahPicker value={surah} onChange={(n) => n != null && setSurah(n)} riwaya={riwaya} />
          </div>
        </div>

        {mode === "create" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              {t("recitations.riwaya")}
            </label>
            <FormSelect
              triggerClassName="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm"
              value={riwaya}
              onValueChange={(v) => setRiwaya(v as QuranRiwaya)}
              options={getAvailableRiwayat().map((r) => ({
                value: r.id,
                label: `${t(`mushaf.${r.id}`)} — ${r.nameAr}`,
              }))}
            />
          </div>
        ) : recitation ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("recitations.riwaya")}: {t(`mushaf.${recitation.riwaya}`)}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="w-full">
            <label htmlFor="rec-ayah-start" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              {t("recitations.ayahStart")}
            </label>
            <FormSelect
              id="rec-ayah-start"
              required
              dir="rtl"
              triggerClassName="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] py-2.5 text-sm text-[var(--color-text)] shadow-sm focus-visible:ring-[var(--color-primary)]"
              triggerStyle={{ color: "var(--color-text)" }}
              value={String(ayahStart)}
              onValueChange={(v) => setAyahStart(Number(v))}
              options={ayahStartOptions.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
          <div className="w-full">
            <label htmlFor="rec-ayah-end" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
              {t("recitations.ayahEnd")}
            </label>
            <FormSelect
              id="rec-ayah-end"
              required
              dir="rtl"
              triggerClassName="w-full rounded-xl border border-gray-200 bg-[var(--color-surface)] py-2.5 text-sm text-[var(--color-text)] shadow-sm focus-visible:ring-[var(--color-primary)]"
              triggerStyle={{ color: "var(--color-text)" }}
              value={String(ayahEnd)}
              onValueChange={(v) => setAyahEnd(Number(v))}
              options={ayahEndOptions.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
        </div>
        {surah && ayahStart && ayahEnd && isValidAyahRange(surah, ayahStart, ayahEnd, riwaya) ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>{t("recitations.audio.previewLabel")}</span>
            <AyahRangeAudioButton
              surah={surah}
              ayahStart={ayahStart}
              ayahEnd={ayahEnd}
              variant="labeled"
            />
          </div>
        ) : null}

        {mode === "create" ? (
          <>
            <div>
              <span className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("recitations.room")}</span>
              {roomReadOnly ? (
                <div className="rounded-xl border border-gray-200 bg-muted/50 px-3 py-2 text-sm text-[var(--color-text)]">
                  {selectedRoomName}
                </div>
              ) : (
                <FormSelect
                  triggerClassName="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm"
                  value={roomId}
                  onValueChange={(v) => {
                    setRoomId(v);
                    setSessionId("");
                  }}
                  options={[
                    { value: "", label: "—" },
                    ...rooms.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
              )}
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("recitations.session")}</span>
              {sessionReadOnly ? (
                <div className="rounded-xl border border-gray-200 bg-muted/50 px-3 py-2 text-sm text-[var(--color-text)]">
                  {selectedSessionLabel}
                </div>
              ) : (
                <FormSelect
                  triggerClassName="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm"
                  value={sessionId}
                  onValueChange={setSessionId}
                  disabled={!roomId}
                  options={[
                    { value: "", label: "—" },
                    ...sessions.map((s) => ({
                      value: s.id,
                      label: `${s.title?.trim() || s.room_name} · ${new Date(s.scheduled_at).toLocaleString(intlLocale)}`,
                    })),
                  ]}
                />
              )}
            </div>
          </>
        ) : null}

        {mode === "edit" ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("recitations.grade")}</label>
              <FormSelect
                triggerClassName="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm"
                value={grade}
                onValueChange={(v) => setGrade((v || "") as RecitationGrade | "")}
                options={[
                  { value: "", label: t("recitations.allGrades") },
                  ...GRADES.map((g) => ({
                    value: g,
                    label: t(`recitations.${gradeLabelKey(g)}`),
                  })),
                ]}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="rec-notes">
                {t("recitations.teacherNotes")}
              </label>
              <textarea
                id="rec-notes"
                className="min-h-[88px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder={t("recitations.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={loading || !studentId}>
            {loading ? t("common.loading") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
