# Cursor Prompt — Phase 7: Live page (`/live`)

## Context

The `/live` page shows public live sessions across the platform plus an "Upcoming" list. Users get confused because three places show "live" info:

1. The `LiveSessionBanner` at the top of every page.
2. The `LiveNowDashboardCard` on Home.
3. The `/live` page itself.

This phase clarifies the `/live` page's specific role (public/cross-platform discovery) and adds a teacher affordance to start a session quickly when one is imminent.

What already exists:
- `frontend/src/pages/sessions/LiveSessionsPage.tsx` — current page.
- `GET /api/sessions/live-public` — returns public live sessions across the platform.
- `GET /api/sessions/upcoming` — returns the user's upcoming sessions.
- `frontend/src/lib/sessionNav.ts` — `liveSessionPath` and `sessionNavigatePath` helpers.
- `useAuthStore` — current user.

Do **not** touch the live session shell, LiveKit, the home dashboard card, or the top banner. Only `LiveSessionsPage.tsx` and one i18n update.

---

## Goal

A `/live` page that clearly says "this is the public lobby" so users stop confusing it with their personal live session, plus a quick "start a session" affordance for teachers when one of their sessions is about to begin.

---

## 1. Clarify page purpose (P7.1)

Currently the page subtitle reads:

> "Browse live classes in public rooms. If you are not enrolled yet, join the room first — then you can enter the live session."

This is functional but undersells the page. Replace with two short paragraphs:

### Updated subtitle structure

The `<PageShell>` `description` slot currently takes a single string. Keep it that way and use a single tightened sentence:

`livePage.subtitle` (replace existing):
- EN: "Public live sessions happening across Miqraa right now. Find a halaqah to listen in or join."
- AR: "حصص مباشرة عامة على المقرأ الآن. ابحث عن حلقة للاستماع أو الانضمام."
- FR: "Séances publiques en direct sur Miqraa en ce moment. Trouvez une halaqah pour écouter ou rejoindre."

### Section header above the live list

Add a small explanatory line above the existing `<PageCard>` for `Live now`:

```tsx
<div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
  <p className="font-medium">{t("livePage.publicHeaderTitle")}</p>
  <p className="mt-1 text-xs text-blue-900/80">{t("livePage.publicHeaderDescription")}</p>
</div>
```

Place this strip directly under the `<PageShell>` header and above the `Live now` `<PageCard>`. Keep the visual quiet — it's context, not a CTA.

---

## 2. Teacher "Start a session now" affordance (P7.2)

When the current user is a teacher (or admin) and one of **their** scheduled sessions is starting within the next 15 minutes (or already started but not yet `in_progress`), surface a prominent "Start now" card at the top of `/live`.

### 2a. Compute the candidate session

Add this filter on the `upcoming` data already fetched:

```ts
const myImminentSession = useMemo(() => {
  if (!user || (user.role !== "teacher" && user.role !== "admin")) return null;
  const now = Date.now();
  const fifteenMin = 15 * 60 * 1000;
  return upcoming.find((s) => {
    if (s.status !== "scheduled") return false;
    const at = new Date(s.scheduled_at).getTime();
    // Within ±15 minutes of "now"
    return at - now <= fifteenMin && at - now >= -fifteenMin;
  }) ?? null;
}, [upcoming, user]);
```

If `null`, render nothing.

### 2b. The card

Render at the very top of the page content (above the public header strip):

```tsx
{myImminentSession ? (
  <div className="rounded-2xl border-2 border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          {t("livePage.imminentBadge")}
        </p>
        <p className="mt-1 text-base font-semibold text-[var(--color-text)]">
          {titleOf(myImminentSession)}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
          {myImminentSession.room_name} · {mediumTime(myImminentSession.scheduled_at)}
        </p>
      </div>
      <Button
        type="button"
        variant="primary"
        className="h-10 shrink-0"
        onClick={() => navigate(sessionNavigatePath(myImminentSession))}
      >
        {t("livePage.startNow")}
      </Button>
    </div>
  </div>
) : null}
```

### 2c. Don't double up

If `myImminentSession` is also present in the `live` list (i.e. it's already in_progress and showing in the public live section), the imminent card might overlap with the "Live now" entry. Filter the imminent card out when:

```ts
const imminentAlreadyLive = myImminentSession
  ? live.some((l) => l.id === myImminentSession.id)
  : false;
```

Show the imminent card only if `myImminentSession && !imminentAlreadyLive`. When already live, the existing red "Live now" entry handles the join CTA already.

### 2d. Don't refetch

We already have `upcoming` from `reload()`. Don't add a separate fetch. Don't add polling. The user can refresh manually if needed — or the existing `LiveSessionsContext` poll will trigger updates.

---

## i18n keys to add

`frontend/src/i18n/locales/{ar,en,fr}.json` under `livePage`:

| Key | EN | AR | FR |
|---|---|---|---|
| `publicHeaderTitle` | Public sessions across Miqraa | حصص عامة على منصة المقرأ | Séances publiques sur Miqraa |
| `publicHeaderDescription` | These are sessions in public halaqat. To join, you may need to enroll first — or just listen. | هذه حصص في حلقات عامة. للانضمام قد تحتاج إلى التسجيل أولًا، أو يمكنك الاستماع فقط. | Ce sont des séances de halaqat publiques. Pour rejoindre, vous devrez peut-être vous inscrire — ou simplement écouter. |
| `imminentBadge` | Your session is starting soon | حصتك على وشك أن تبدأ | Votre séance commence bientôt |
| `startNow` | Start now | ابدأ الآن | Démarrer |

Update existing key:

| Key | EN | AR | FR |
|---|---|---|---|
| `subtitle` | Public live sessions happening across Miqraa right now. Find a halaqah to listen in or join. | حصص مباشرة عامة على المقرأ الآن. ابحث عن حلقة للاستماع أو الانضمام. | Séances publiques en direct sur Miqraa en ce moment. Trouvez une halaqah pour écouter ou rejoindre. |

---

## Design system reminder

- Imminent card uses primary green border + soft tint background — matches "Today's session" cards on home.
- Public header strip uses muted blue (informational, not a CTA). Don't make it loud.
- The `LIVE` chip in the top nav already pulses red. Don't try to add another red beacon on this page.
- Mobile: imminent card stacks (text above, button below).

---

## Files touched

- `frontend/src/pages/sessions/LiveSessionsPage.tsx` — main edits.
- `frontend/src/i18n/locales/{ar,en,fr}.json` — keys above.

---

## Do not touch

- `LiveSessionBanner.tsx` (top of every page) — out of scope.
- `LiveNowDashboardCard.tsx` (Home page) — out of scope.
- `LiveSessionPage.tsx` (the actual live session shell) — explicitly excluded.
- LiveKit hooks, WebSocket signaling — explicitly excluded.
- Backend — Phase 7 is frontend-only.
- Terminology, Mushaf.

---

## Test instructions

1. **Teacher with a session starting in 8 minutes:** imminent card appears at the top with "Start now" button. Click → navigates to that session via `sessionNavigatePath` (which routes correctly based on session status).
2. **Teacher with same session already live:** imminent card hidden; the existing red "Live now" list entry shows the join CTA instead.
3. **Teacher with no session in the next 15 minutes:** imminent card not rendered.
4. **Student logged in:** imminent card never renders (only teacher/admin).
5. **Page subtitle:** new tightened copy.
6. **Public header strip:** rendered above "Live now" card.
7. **Existing "Live now" + "Upcoming" lists:** behaviour unchanged. Public sessions render, enrollment-gated join flows still work.
8. RTL: imminent card text aligns correctly, button sits on the leading edge.
9. `npm run build` clean.
