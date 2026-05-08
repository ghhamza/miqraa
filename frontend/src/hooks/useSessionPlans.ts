// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "../lib/useApiMutation";
import { recitationKeys } from "../lib/queryKeys";
import { api } from "../lib/api";
import type { RecitationPublic } from "../types";

type PlanAction = "start" | "pause" | "skip" | "reopen";

interface TransitionInput {
  planId: string;
  action: PlanAction;
  body?: object;
}

interface TransitionContext {
  previous: RecitationPublic[] | undefined;
}

export interface UseSessionPlansArgs {
  sessionId: string;
}

export function useSessionPlans({ sessionId }: UseSessionPlansArgs) {
  const qc = useQueryClient();
  const key = recitationKeys.list({ session: sessionId });

  const transitionMutation = useApiMutation<RecitationPublic, TransitionInput, TransitionContext>({
    mutationFn: async ({ planId, action, body }) => {
      const { data } = await api.request<RecitationPublic>({
        method: "post",
        url: `recitations/${planId}/${action}`,
        data: body ?? {},
      });
      return data;
    },
    onMutate: async ({ planId, action }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RecitationPublic[]>(key);
      const optimisticStatus: RecitationPublic["plan_status"] | null =
        action === "start"
          ? "in_progress"
          : action === "pause"
            ? "paused"
            : action === "skip"
              ? "skipped"
              : action === "reopen"
                ? "planned"
                : null;
      if (optimisticStatus) {
        qc.setQueryData<RecitationPublic[]>(key, (prev = []) =>
          prev.map((p) => (p.id === planId ? { ...p, plan_status: optimisticStatus } : p)),
        );
      }
      return { previous };
    },
    onSuccess: (data) => {
      qc.setQueryData<RecitationPublic[]>(key, (prev = []) =>
        prev.map((p) => (p.id === data.id ? data : p)),
      );
    },
    onError: (_message, _err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(key, context.previous);
      }
    },
  });

  const transition = useCallback(
    async (planId: string, action: PlanAction, body?: object) => {
      await transitionMutation.mutateAsync({ planId, action, body });
    },
    [transitionMutation],
  );

  const start = useCallback((planId: string) => transition(planId, "start"), [transition]);
  const pause = useCallback((planId: string) => transition(planId, "pause"), [transition]);
  const skip = useCallback((planId: string) => transition(planId, "skip"), [transition]);
  const reopen = useCallback(
    (planId: string, clearGrade: boolean = true) =>
      transition(planId, "reopen", { clear_grade: clearGrade }),
    [transition],
  );

  return { start, pause, skip, reopen, transition };
}
