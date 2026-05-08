// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { userFacingApiError } from "./api";

/**
 * Wrapper around `useMutation` that:
 *  - Converts thrown errors to localized strings via `userFacingApiError`.
 *  - Invalidates one or more query keys after a successful mutation.
 *
 * Usage:
 *   const create = useApiMutation({
 *     mutationFn: (input: CreateUserInput) => api.post("users", input),
 *     invalidates: [userKeys.lists(), userKeys.stats()],
 *     onSuccess: () => onClose(),
 *     onError: (message) => setError(message),
 *   });
 *   create.mutate(formValues);
 *
 * For optimistic updates, pass `onMutate` directly — this hook does not
 * interfere with it. Pair `onMutate` with `onError` rollback as in the
 * standard TanStack Query optimistic-update pattern. Note that `onError`
 * here receives the localized error message as its first argument, then the
 * raw error, variables, and context — the original `useMutation` signature
 * is preserved from the second argument onward.
 */
export interface UseApiMutationOptions<TData, TVariables, TContext>
  extends Omit<
    UseMutationOptions<TData, unknown, TVariables, TContext>,
    "onError"
  > {
  /** Query keys to invalidate when the mutation succeeds. */
  invalidates?: readonly QueryKey[];
  /**
   * Called with the localized error message from `userFacingApiError`,
   * followed by the raw error, variables, and mutation context.
   */
  onError?: (
    message: string,
    error: unknown,
    variables: TVariables,
    context: TContext | undefined,
    mutationContext: unknown,
  ) => void;
}

export function useApiMutation<TData = unknown, TVariables = void, TContext = unknown>(
  options: UseApiMutationOptions<TData, TVariables, TContext>,
) {
  const qc = useQueryClient();
  const { invalidates, onError, onSuccess, ...rest } = options;

  return useMutation<TData, unknown, TVariables, TContext>({
    ...rest,
    onSuccess: async (data, variables, context, mutationContext) => {
      if (invalidates && invalidates.length > 0) {
        await Promise.all(
          invalidates.map((key) => qc.invalidateQueries({ queryKey: key })),
        );
      }
      if (onSuccess) {
        await onSuccess(data, variables, context, mutationContext);
      }
    },
    onError: (error, variables, context, mutationContext) => {
      const message = userFacingApiError(error);
      if (onError) {
        onError(message, error, variables, context, mutationContext);
      }
    },
  });
}
