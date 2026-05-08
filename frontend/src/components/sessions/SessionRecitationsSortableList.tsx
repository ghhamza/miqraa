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
import { useApiMutation } from "../../lib/useApiMutation";
import type { RecitationPublic } from "../../types";
import { GradeBadge } from "../recitations/GradeBadge";
import { AyahRangeAudioButton } from "../recitations/AyahRangeAudioButton";
import { getSurahNameWithArabic } from "../../lib/quranService";
import { useLocaleDate } from "../../hooks/useLocaleDate";
import { cn } from "@/lib/utils";
import { Button } from "../ui/Button";

interface SessionRecitationsSortableListProps {
  items: RecitationPublic[];
  sessionId: string;
  showStudent?: boolean;
  onItemsChange: (next: RecitationPublic[]) => void;
  onPersistFailed: () => void;
  /** Opens recitation form in edit mode (main column only; not the drag handle). */
  onEditItem?: (r: RecitationPublic) => void;
  /**
   * When `items` is only a subset (e.g. planned rows in the live drawer), pass the full session plan list
   * so the reorder PUT sends every row: non-planned rows keep order, then the reordered planned slice.
   */
  fullPlansForReorderMerge?: RecitationPublic[];
  /** Live drawer: Start / Skip on each planned row (below the drag row). */
  plannedToolbar?: {
    isTeacher: boolean;
    onStartPlan: (planId: string) => void | Promise<void>;
    onSkipPlan: (planId: string) => void | Promise<void>;
  };
  /**
   * Live session drawer: student `user_id`s currently in the room. Planned rows for other students
   * render as compact, non-draggable cards (cannot Start until they join).
   */
  liveConnectedStudentIds?: Set<string>;
}

function planDragEnabled(r: RecitationPublic): boolean {
  return r.plan_status === "planned";
}

function studentLiveInRoom(
  plan: RecitationPublic,
  liveConnectedStudentIds: Set<string> | undefined,
): boolean {
  if (liveConnectedStudentIds === undefined) return true;
  if (!plan.student_id) return false;
  return liveConnectedStudentIds.has(plan.student_id);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function SortablePlanRow({
  plan,
  showStudent,
  loc,
  onEditItem,
  plannedToolbar,
  liveConnectedStudentIds,
}: {
  plan: RecitationPublic;
  showStudent?: boolean;
  loc: string;
  onEditItem?: (r: RecitationPublic) => void;
  plannedToolbar?: SessionRecitationsSortableListProps["plannedToolbar"];
  liveConnectedStudentIds?: Set<string>;
}) {
  const { t } = useTranslation();
  const { medium } = useLocaleDate();
  const isLiveConnected = studentLiveInRoom(plan, liveConnectedStudentIds);
  const draggable = planDragEnabled(plan) && isLiveConnected;
  const compactOfflinePlanned =
    plan.plan_status === "planned" && liveConnectedStudentIds !== undefined && !isLiveConnected;

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
  const isDone = status === "completed" || status === "skipped";
  const isLive = status === "in_progress";
  const isPaused = status === "paused";

  const displayName = plan.student_name ?? t("recitations.deletedStudent");

  if (compactOfflinePlanned) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2 text-xs",
          isDragging ? "opacity-50" : null,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
              aria-hidden
            >
              {initialsFromName(displayName)}
            </div>
            <div className="min-w-0">
              {showStudent ? (
                <p className="truncate text-sm font-medium text-[var(--color-text)]">{displayName}</p>
              ) : null}
              <p
                className="truncate text-[11px] text-[var(--color-text-muted)]"
                style={{ fontFamily: "var(--font-quran)" }}
              >
                {getSurahNameWithArabic(plan.surah, loc)} · {plan.ayah_start}–{plan.ayah_end}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("liveSession.notConnectedBadge")}
          </span>
        </div>
        {plannedToolbar?.isTeacher ? (
          <div className="flex justify-end border-t border-border/50 pt-1.5 dark:border-white/10">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() => void plannedToolbar.onSkipPlan(plan.id)}
            >
              {t("liveSession.actionSkip")}
            </Button>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm",
        isDone && "bg-[var(--color-bg)]/80 opacity-90",
        isLive && "bg-emerald-50/60 dark:bg-emerald-950/20",
        isPaused && "bg-amber-50/50 dark:bg-amber-950/15",
        !isDone && !isLive && !isPaused && "bg-[var(--color-bg)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
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
                {status === "completed"
                  ? t("sessions.completed")
                  : status === "skipped"
                    ? t("liveSession.statusSkipped")
                    : status === "paused"
                      ? t("liveSession.zonePaused")
                      : t("sessions.inProgress")}
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
                {status === "completed"
                  ? t("sessions.completed")
                  : status === "skipped"
                    ? t("liveSession.statusSkipped")
                    : status === "paused"
                      ? t("liveSession.zonePaused")
                      : t("sessions.inProgress")}
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
      </div>
      {plannedToolbar && draggable && plannedToolbar.isTeacher ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-2 dark:border-white/10">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 px-2 text-xs"
            onClick={() => void plannedToolbar.onStartPlan(plan.id)}
          >
            {t("liveSession.actionStart")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            onClick={() => void plannedToolbar.onSkipPlan(plan.id)}
          >
            {t("liveSession.actionSkip")}
          </Button>
        </div>
      ) : null}
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
  fullPlansForReorderMerge,
  plannedToolbar,
  liveConnectedStudentIds,
}: SessionRecitationsSortableListProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  type ReorderInput = {
    plan_ids: string[];
    previousItems: RecitationPublic[];
    fullSnapshot: RecitationPublic[] | null;
  };

  const reorderMutation = useApiMutation<unknown, ReorderInput>({
    mutationFn: ({ plan_ids }) =>
      api.put(`sessions/${sessionId}/plans/reorder`, { plan_ids }),
    onError: (_message, _err, vars) => {
      if (vars.fullSnapshot && vars.fullSnapshot.length > 0) {
        onItemsChange(vars.fullSnapshot);
      } else {
        onItemsChange(vars.previousItems);
      }
      onPersistFailed();
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousItems = items;
    const reorderedSubset = arrayMove(items, oldIndex, newIndex);

    const mergeFull = (): { merged: RecitationPublic[]; plan_ids: string[] } => {
      if (!fullPlansForReorderMerge?.length) {
        const merged = reorderedSubset.map((p, i) => ({ ...p, order_index: i }));
        return { merged, plan_ids: merged.map((p) => p.id) };
      }
      const others = fullPlansForReorderMerge
        .filter((p) => p.plan_status !== "planned")
        .sort((a, b) => a.order_index - b.order_index);
      const merged = [...others, ...reorderedSubset].map((p, i) => ({ ...p, order_index: i }));
      return { merged, plan_ids: merged.map((p) => p.id) };
    };

    const { merged, plan_ids } = mergeFull();
    onItemsChange(merged);

    reorderMutation.mutate({
      plan_ids,
      previousItems,
      fullSnapshot: fullPlansForReorderMerge ?? null,
    });
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
              plannedToolbar={plannedToolbar}
              liveConnectedStudentIds={liveConnectedStudentIds}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
