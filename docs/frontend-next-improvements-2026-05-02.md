# Frontend — Status & Next Improvements

**Date:** 2026-05-02
**Scope:** `frontend/` (React 19 + TS strict + Vite 8 + Tailwind v4 + shadcn/Radix + Zustand + react-router v7 + react-i18next + axios + livekit-client + TanStack Query)

---

## 1. Current Status

A round of 8 targeted prompts (+ a follow-up sweep) has been applied. All main deliverables landed.

### Prompts applied

| # | Prompt | Status | Where to verify |
|---|---|---|---|
| 1 | Add error boundaries (app + live-session) | ✅ | `frontend/src/components/ui/ErrorBoundary.tsx`; wrapped in `App.tsx` and `pages/sessions/LiveSessionPage.tsx` |
| 2 | Split LiveSessionPage | ✅ | 4 components in `frontend/src/pages/sessions/components/` (~387 LOC extracted) |
| 3 | Form-state hooks | ✅ | `frontend/src/hooks/useCancellableEffect.ts`, `useFormSubmit.ts`; pilot in `RecitationFormModal.tsx` |
| 4 | Axios timeout + abort signals | ✅ | 30s timeout in `frontend/src/lib/api.ts`; `ECONNABORTED → errors.timeout` translated in en/fr/ar |
| 4b | Migration sweep (15 files) | ✅ | `let cancelled = false` count in `frontend/src` is now **0** |
| 5 | Document realtime patterns | ✅ | JSDoc on `useLivekitConnection.ts`, `useSessionWebSocket.ts`, `useSessionState.ts` |
| 6 | TanStack Query pilot | ✅ | `frontend/src/lib/queryClient.ts`; `QueryClientProvider` in App; `LiveSessionsContext` + `RoomsPage` migrated |
| 7 | Mushaf a11y + font fallback | ✅ | Word spans now have `aria-label`/`role`/`tabIndex`/`lang="ar"`; `setFontLoadFailureHandler` wired in App |
| 8 | Live-sessions error toast | ✅ | `frontend/src/components/layout/LiveSessionsErrorToast.tsx` rendered inside `AppLayout` |

### Code-quality snapshot

| Metric | Before | Now |
|---|---|---|
| `any` usages | 0 | **0** |
| `TODO` / `FIXME` / `XXX` | 0 | **0** |
| `console.*` calls | ~10 | 15 (all in error/abort paths) |
| `let cancelled = false` | ~17 | **0** |
| Largest file (LOC) | 1,468 (LiveSessionPage) | 1,273 (LiveSessionPage) |
| Files > 800 LOC | 2 | 2 (LiveSessionPage 1,273; RoomDetailPage 894) |
| Files > 500 LOC | ~5 | 6 |

### Architecture state

- **Provider tree** (correct nesting, App.tsx): `RadixDirectionProvider → QueryClientProvider → TooltipProvider → ErrorBoundary → LiveSessionsProvider → Router`. Query client lives above the boundary so error fallbacks can use query hooks.
- **Data-fetching lanes** (no overlap): TanStack Query for cached lists; `useCancellableEffect` for ephemeral / form lookups; dedicated hooks for realtime (LiveKit + WS).
- **Page-local subcomponents** convention now used by `pages/sessions/components/`.

### Known limitations introduced or carried over

- Font-load failure surfaces via raw `window.alert()` (App.tsx). Works once-per-session, but it's not a real toast.
- `useCancellableEffect` swallows non-abort errors via `console.error`. Callers that need to react to fetch failures must check error state explicitly — the hook does not surface one.
- Only 2 surfaces use TanStack Query so far (LiveSessionsContext, RoomsPage). Caching / dedup benefit is muted until more list pages migrate.
- Query keys are inlined (`["rooms", search, filter]`, `["live-sessions", userId]`) — no central constants file yet.
- `LiveSessionDesktopActionBar` takes 22 props. Justified for a multi-button cluster; not currently a problem.

### Bottom line

Code health is materially improved. Every targeted weakness from the previous review (silent failure paths, missing a11y, undocumented load-bearing patterns, hand-rolled fetch ceremony, no error boundary) is gone. Type safety is still pristine.

The single biggest remaining gap is **test coverage: 0 / 143 source files**. The next refactoring round will be much riskier without it.

---

## 2. What We Should Do Next

Prioritized 1 → 7. Items 1–3 are highest-leverage; the rest are incremental.

### 1. Add a test suite (highest leverage)

- **Why now:** zero coverage; the recent refactor wave is the moment to lock in behavior before the next one.
- **Tooling:** Vitest + React Testing Library + jsdom. They drop straight into the existing Vite setup.
- **Targets, in order:**
  1. `useCancellableEffect` — abort behavior, swallow `CanceledError`, surface other errors.
  2. `useFormSubmit` — loading flag, `userFacingApiError` mapping, re-entry guard.
  3. `ErrorBoundary` — catches a thrown render, shows fallback, `reset()` re-renders children.
  4. TanStack query hooks (LiveSessionsContext, RoomsPage) — key correctness + cache invalidation.
  5. `LiveSessionDesktopActionBar` — prop → button-state matrix.
- **Target:** ~30% coverage on hooks + critical UI primitives within the first sprint.

### 2. Build a real toast system

- **Why now:** `LiveSessionsErrorToast` is one-off; font fallback uses `window.alert()`. A unified mechanism unblocks future error-surface work and removes both ad-hoc paths.
- **Options:** adopt `sonner` (~5 KB, accessible by default), or write a small in-house `useToast()` + `<ToastViewport>` (lower dependency cost, same API surface).
- **Migration order once it lands:** font-fallback alert → live-sessions error toast → unhandled API errors that currently die silently.

### 3. Split `RoomDetailPage.tsx` (894 LOC)

- **Why now:** largest non-`LiveSessionPage` file; clear seams.
- **Suggested extractions:**
  - `<RoomStudentsManager>` — enrollment list + add/remove controls
  - `<RoomSessionsScheduler>` — schedule grid + edit form
  - `<RoomStatsPanel>` — statistics
- **Acceptance:** parent page < 400 LOC; no behavior change; same prop pattern as the LiveSessionPage extractions.

### 4. Expand TanStack Query to remaining list pages

- **Targets in priority order:** `RecitationsPage` → `SessionDetailPage` → `CalendarPage`. All are heavy-traffic and currently re-fetch on every navigation.
- **Acceptance:** each page uses `useQuery` for its main list; mutations call `queryClient.invalidateQueries(...)`.

### 5. Centralize TanStack Query keys

- **Why:** before the surface area grows past 5 queries.
- **Where:** `frontend/src/lib/queryKeys.ts` — small constants/factories file (e.g. `roomsList(search, filter)`, `roomDetail(id)`, `liveSessions(userId)`).
- **Cost:** ~30 minutes; saves a hard-to-debug cache-mismatch bug later.

### 6. Lazy-load route components

- **Why:** initial bundle is loading every page eagerly (MushafPage, RoomDetailPage, CalendarPage are heavy).
- **How:** `React.lazy()` + `<Suspense>` in `App.tsx` route definitions; show a skeleton fallback.
- **Estimated win:** 15–25% smaller initial chunk.

### 7. Watch `LiveSessionPageInner` (still 1,273 LOC)

- **State of play:** orchestrates mushaf interaction, annotations, session state, grading, and auto-follow. The recent extractions removed presentation; what remains is genuinely complex state.
- **Trigger for action:** if the next two PRs touch this file's state, consider a state machine (`xstate` or `zustand` slice). Don't introduce one preemptively — current complexity is bearable.

---

## Prompt files for reference

All prompt files used in the previous round live in `prompts/` at the repo root:
- `prompts/01-add-error-boundaries.md`
- `prompts/02-split-live-session-page.md`
- `prompts/03-extract-form-hooks.md`
- `prompts/04-axios-timeout-and-abort.md`
- `prompts/04b-finish-cancelled-flag-sweep.md`
- `prompts/05-document-realtime-patterns.md`
- `prompts/06-tanstack-query-pilot.md`
- `prompts/07-mushaf-a11y-and-font-fallback.md`
- `prompts/08-live-sessions-fetch-error-toast.md`

When the next round of items above is ready, follow the same workflow: prompt-per-task in `prompts/`, applied via Cursor.

## Update — 2026-05-08

TanStack Query migration complete. All HTTP reads converted to `useQuery`,
all writes converted to `useApiMutation`, and live-session WS handlers
reconcile via `qc.setQueryData`. See `frontend/docs/data-fetching.md` for
patterns.

Outstanding from this doc:

- Test coverage (still 0/143 unless Section 3 of Prompt 12 was applied).
- Other items from the original list — re-evaluate against current state.
