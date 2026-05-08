# Data fetching

## Three lanes

The frontend talks to the backend through three lanes. Pick one per concern;
don't mix.

### 1. `useQuery` - server data the user reads

Anything that's a GET request: list pages, detail pages, dropdowns, stats.
Use `useQuery` with a key from `frontend/src/lib/queryKeys.ts`.

```ts
const { data, isPending, error } = useQuery({
  queryKey: roomKeys.detail(id),
  queryFn: async ({ signal }) => {
    const { data } = await api.get<Room>(`rooms/${id}`, { signal });
    return data;
  },
  enabled: !!id,
});
```

Default behavior is fine. Don't reach for `staleTime` / `gcTime` / `retry`
unless you know why; reasonable defaults are baked in.

### 2. `useApiMutation` - user-initiated writes

Anything that's POST / PUT / DELETE driven by user interaction (form submit,
button click). Wraps `useMutation` with `userFacingApiError` translation and
an `invalidates` shorthand.

```ts
const updateRoom = useApiMutation<Room, UpdateInput>({
  mutationFn: ({ id, ...rest }) => api.put(`rooms/${id}`, rest),
  invalidates: [roomKeys.lists(), roomKeys.stats()],
  onSuccess: (_data, vars) => {
    qc.invalidateQueries({ queryKey: roomKeys.detail(vars.id) });
  },
  onError: (message) => setError(message),
});
```

### 3. `useCancellableEffect` - non-HTTP side effects

Reserved for things that aren't GETs: LiveKit lifecycle, scroll observers,
local subscriptions. If you're tempted to use it for a fetch, you want
`useQuery` instead.

## The query-keys factory

`frontend/src/lib/queryKeys.ts` holds every key the app uses. The shape is
hierarchical: `domain` -> `entity` -> optional discriminator.

```ts
roomKeys.all                  // ["rooms"]                          - invalidate everything room-related
roomKeys.lists()              // ["rooms", "list"]                  - invalidate every list, all filter shapes
roomKeys.list({ search, ... })// ["rooms", "list", filters]         - one specific list
roomKeys.detail(id)           // ["rooms", "detail", id]            - one room
roomKeys.enrollments(id)      // ["rooms", id, "enrollments"]       - that room's enrollments
```

Rules:

- Every cache key MUST come from this factory. No inline array literals.
- If a query needs a filter shape the factory doesn't have, append it inline:
  `[...roomKeys.lists(), { customFilter }] as const`. Don't extend the
  factory for one-off filters.
- Detail keys take an id directly; list keys take a filter object so cache
  entries differ per filter.

## WebSocket reconciliation

In live sessions, WS events update the cache directly via `setQueryData` -
never through `refetch()` or `invalidateQueries()`. Refetching during a live
session causes a flash of stale data; cache patches don't.

```ts
const handlePlanStatusChanged = (evt: PlanStatusChangedMessage) => {
  const key = recitationKeys.list({ session: id });
  qc.setQueryData<RecitationPublic[]>(key, (prev = []) =>
    prev.map((p) =>
      p.id === evt.recitation_id ? { ...p, plan_status: evt.plan_status } : p,
    ),
  );
};
```

For optimistic mutations, the pattern is `onMutate` snapshot -> `onError`
rollback -> WS event reconciles the temp-id row with the server row. See
`useAnnotations.ts` for the canonical implementation.

## Adding a new query

1. Add a key to `queryKeys.ts` if you don't have one.
2. Use `useQuery` in the component.
3. If the data is mutated elsewhere, make sure the relevant mutation has
   that key in its `invalidates` array.

## Adding a new mutation

1. Wrap with `useApiMutation`.
2. List every key the mutation invalidates in `invalidates`. Be generous -
   an extra invalidation costs one network round-trip; a missing one causes
   stale UI.
3. Use `onSuccess` for cache patches when you have the response data and
   want to skip the round-trip (e.g., update a detail key with the response
   row).
4. Use `onMutate` + `onError` rollback only when the operation is fast and
   the optimistic update is high-value (annotations, drag-reorder).
