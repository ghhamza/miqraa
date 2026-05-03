// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import type { RecitationPublic } from "../../types";
import { GradeBadge } from "../recitations/GradeBadge";
import { AyahRangeAudioButton } from "../recitations/AyahRangeAudioButton";
import { getSurahNameWithArabic } from "../../lib/quranService";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { cn } from "@/lib/utils";

interface SessionRecitationsSortableListProps {
  items: RecitationPublic[];
  sessionId: string;
  showStudent?: boolean;
  onItemsChange: (next: RecitationPublic[]) => void;
  onPersistFailed: () => void;
  /** Opens recitation form in edit mode (main column only; not the drag handle). */
  onEditItem?: (r: RecitationPublic) => void;
}

function planDragEnabled(r: RecitationPublic): boolean {
  return r.plan_status === "planned";
}

function SortablePlanRow({
  plan,
  showStudent,
  loc,
  onEditItem,
}: {
  plan: RecitationPublic;
  showStudent?: boolean;
  loc: string;
  onEditItem?: (r: RecitationPublic) => void;
}) {
  const { t } = useTranslation();
  const { medium } = useLocaleDate();
  const draggable = planDragEnabled(plan);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plan.id,
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const status = plan.plan_status;
  const isDone = status === "completed";
  const isLive = status === "in_progress";

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm",
        isDone && "bg-[var(--color-bg)]/80 opacity-90",
        isLive && "bg-emerald-50/60 dark:bg-emerald-950/20",
        !isDone && !isLive && "bg-[var(--color-bg)]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {draggable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("plan.dragHandle")}
            className="mt-0.5 shrink-0 cursor-grab touch-none text-[var(--color-text-muted)] hover:text-[var(--color-text)] active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <div className="mt-0.5 w-4 shrink-0" aria-hidden />
        )}
        {onEditItem ? (
          <button
            type="button"
            className="min-w-0 flex-1 rounded-lg text-start outline-none ring-[var(--color-primary)] transition-colors hover:bg-black/[0.04] focus-visible:ring-2 dark:hover:bg-white/[0.06]"
            onClick={() => onEditItem(plan)}
          >
            {showStudent ? (
              <p className="font-medium text-[var(--color-text)]">
                {plan.student_name ?? t("recitations.deletedStudent")}
              </p>
            ) : null}
            <p
              style={{ fontFamily: "var(--font-quran)" }}
              className={cn("text-[var(--color-text)]", isDone && "line-through decoration-[var(--color-text-muted)]")}
            >
              {getSurahNameWithArabic(plan.surah, loc)} · {plan.ayah_start}–{plan.ayah_end}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{medium(plan.created_at)}</p>
            {plan.teacher_notes ? (
              <p dir="auto" className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">
                {plan.teacher_notes}
              </p>
            ) : null}
            {status && status !== "planned" ? (
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {isDone ? t("sessions.completed") : t("sessions.inProgress")}
              </p>
            ) : null}
          </button>
        ) : (
          <div className="min-w-0 flex-1 text-start">
            {showStudent ? (
              <p className="font-medium text-[var(--color-text)]">
                {plan.student_name ?? t("recitations.deletedStudent")}
              </p>
            ) : null}
            <p
              style={{ fontFamily: "var(--font-quran)" }}
              className={cn("text-[var(--color-text)]", isDone && "line-through decoration-[var(--color-text-muted)]")}
            >
              {getSurahNameWithArabic(plan.surah, loc)} · {plan.ayah_start}–{plan.ayah_end}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{medium(plan.created_at)}</p>
            {plan.teacher_notes ? (
              <p dir="auto" className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">
                {plan.teacher_notes}
              </p>
            ) : null}
            {status && status !== "planned" ? (
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {isDone ? t("sessions.completed") : t("sessions.inProgress")}
              </p>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        {plan.qf_synced_at ? (
          <span
            title={t("recitations.qfSynced")}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
          >
            <Check size={10} />
            Quran.com
          </span>
        ) : null}
        <AyahRangeAudioButton surah={plan.surah} ayahStart={plan.ayah_start} ayahEnd={plan.ayah_end} variant="icon" />
        <GradeBadge grade={plan.grade} />
      </div>
    </li>
  );
}

export function SessionRecitationsSortableList({
  items,
  sessionId,
  showStudent,
  onItemsChange,
  onPersistFailed,
  onEditItem,
}: SessionRecitationsSortableListProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = items;
    const reordered = arrayMove(items, oldIndex, newIndex);
    onItemsChange(reordered);

    const persist = async () => {
      try {
        await api.put(`sessions/${sessionId}/plans/reorder`, {
          plan_ids: reordered.map((p) => p.id),
        });
      } catch {
        onItemsChange(previous);
        onPersistFailed();
      }
    };
    void persist();
  };

  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{t("recitations.noRecitations")}</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {items.map((plan) => (
            <SortablePlanRow
              key={plan.id}
              plan={plan}
              showStudent={showStudent}
              loc={loc}
              onEditItem={onEditItem}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
