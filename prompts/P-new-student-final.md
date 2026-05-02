# Cursor Prompt — P-NEW-STUDENT-FINAL: Three small changes to the new-student home

## Context

The new-student branch in `StudentDashboard` (file `frontend/src/pages/HomePage.tsx`, the `if (rooms.length > 0 && hasNoRecitations) { ... }` block, around line 480) is mostly fine. We need three small changes:

1. Greeting copy: "Welcome back" → "Welcome" (they're new, not returning).
2. Replace the "My rooms" section with "Discover more halaqat" — the student's own halaqah is already represented by the next-session card above.
3. Add the 114-surah grid at the bottom as an aspirational map.

**Do NOT touch:**
- The `rooms.length === 0` branch (`StudentEmptyHero`) — leave it.
- The full-dashboard branch (student with recitations) — leave it.
- The `nextSession` card already inside the new-student branch — leave it.
- The `EmptyState` "You're all set up" hero — leave it.
- The `<WhatsNewStrip>`, `<LiveNowDashboardCard>` — leave them.
- Teacher and admin dashboards.
- Mushaf, live session, terminology, any other page.

This is a focused 3-change pass. Nothing else.

---

## 1. Greeting

In the `if (rooms.length > 0 && hasNoRecitations)` branch, change the title key from `home.studentGreeting` to `home.welcome`:

```tsx
title={t("home.welcome", { name: user.name })}
```

The `home.welcome` key already exists ("Welcome {{name}}" / "مرحبًا {{name}}" / "Bienvenue {{name}}"). The full-dashboard branch keeps `home.studentGreeting` ("Welcome back, {{name}}") — don't change that.

---

## 2. Replace "My rooms" with "Discover more halaqat"

The student's enrolled halaqah already appears in the green next-session card above. Listing it again under "My rooms" is redundant. Swap that section for one that helps them discover other public halaqat.

### 2a. Add new state

Near the existing `useState` calls in `StudentDashboard`:

```ts
const [publicRooms, setPublicRooms] = useState<Room[]>([]);
```

### 2b. Extend the existing data fetch

In the existing `useCancellableEffect`'s `Promise.all`, add one more call:

```ts
api.get<Paginated<Room>>("rooms", {
  params: { is_public: true, my_status: "none", limit: 4 },
  signal,
}),
```

Destructure into a new variable (e.g. `publicRoomsRes`) and:

```ts
setPublicRooms(publicRoomsRes.data.items);
```

In the catch block, reset:

```ts
setPublicRooms([]);
```

If the backend `GET /api/rooms` does NOT accept `is_public` and `my_status` query params, stop and report back — those should already exist from earlier phases. Do not attempt to add them in this prompt.

### 2c. Swap the section

Find the existing `<section>` inside the new-student branch that renders `t("home.studentRooms")` (header "My rooms") with the `rooms.map(...)` list. Replace the entire `<section>` block with:

```tsx
<section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
    <div>
      <h2 className="text-lg font-semibold text-[var(--color-text)]">
        {t("home.discoverHalaqatTitle")}
      </h2>
      <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
        {t("home.discoverHalaqatDescription")}
      </p>
    </div>
    {publicRooms.length > 0 ? (
      <Link to="/rooms" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
        {t("home.discoverHalaqatSeeAll")}
      </Link>
    ) : null}
  </div>
  {publicRooms.length === 0 ? (
    <p className="text-sm text-[var(--color-text-muted)]">
      {t("home.discoverHalaqatEmpty")}
    </p>
  ) : (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {publicRooms.map((r) => (
        <li key={r.id}>
          <Link
            to={`/rooms/${r.id}`}
            className="block rounded-xl border border-gray-100 bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-primary)]/30"
          >
            <p className="font-medium text-[var(--color-text)]">{r.name}</p>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{r.teacher_name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold ${riwayaBadgeClass(r.riwaya)}`}>
                {t(`mushaf.${r.riwaya}`)}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                · {t("rooms.enrolledFraction", { enrolled: r.enrolled_count, max: r.max_students })}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )}
</section>
```

Verify `Link` (from `react-router-dom`) and `riwayaBadgeClass` (from `../lib/riwayaUi`) are imported. They likely already are — don't duplicate.

---

## 3. Add the 114-surah aspirational grid

At the very bottom of the new-student branch's `<PageShell>` children — after the new "Discover more halaqat" section — add:

```tsx
<section className="rounded-2xl border border-gray-100 bg-[var(--color-surface)] p-6 shadow-sm">
  <div className="mb-4">
    <h2 className="text-lg font-semibold text-[var(--color-text)]">
      {t("home.quranMapTitle")}
    </h2>
    <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
      {t("home.quranMapDescription")}
    </p>
  </div>
  <SurahProgressGrid surahBestGrades={progress?.surah_best_grades ?? []} />
</section>
```

`SurahProgressGrid` is already imported in this file. The grid will render all 114 squares as empty/grey because `surah_best_grades` is an empty array for a new student — that's the desired aspirational effect.

---

## 4. i18n keys

File: `frontend/src/i18n/locales/{ar,en,fr}.json` under `home`:

| Key | EN | AR | FR |
|---|---|---|---|
| `discoverHalaqatTitle` | Discover more halaqat | اكتشف المزيد من الحلقات | Découvrir d'autres halaqat |
| `discoverHalaqatDescription` | Public halaqat you could also join. | حلقات عامة يمكنك الانضمام إليها. | Halaqat publiques que vous pouvez rejoindre. |
| `discoverHalaqatSeeAll` | See all | عرض الكل | Voir tout |
| `discoverHalaqatEmpty` | No public halaqat available right now. | لا توجد حلقات عامة متاحة حاليًا. | Aucune halaqah publique disponible actuellement. |
| `quranMapTitle` | Your map of the Quran | خريطتك للقرآن | Votre carte du Coran |
| `quranMapDescription` | 114 surahs. Each square fills in as you cover the surah with your teacher. | ١١٤ سورة. يمتلئ كل مربّع عند إتمام السورة مع معلّمك. | 114 sourates. Chaque case se remplit lorsque vous achevez la sourate avec votre enseignant. |

`home.welcome` already exists — don't add it.

---

## Files touched

- `frontend/src/pages/HomePage.tsx` — three changes inside the new-student branch only.
- `frontend/src/i18n/locales/{ar,en,fr}.json` — six new keys under `home`.

No new components. No backend changes. No migrations.

---

## Test instructions

Log in as the test student "Student" (1 enrolled room "تحفيظ", 0 recitations).

1. Greeting reads **"Welcome, Student"** (no "back").
2. "Since…" what's-new strip if applicable.
3. Live now card if applicable.
4. "You're all set up" hero unchanged.
5. Green "Next session" card showing their halaqah's next session (when one exists).
6. **"Discover more halaqat"** section — replaces the old "My rooms" — showing up to 4 public halaqat the student is not in. Empty state if none.
7. **"Your map of the Quran"** section at the bottom — full 114-surah grid, all squares empty/grey. Caption: "114 surahs. Each square fills in as you cover the surah with your teacher."

Then log in as the test student with recitations:

8. Greeting reads "Welcome back, X".
9. Full dashboard renders unchanged — progress overview, grade distribution, real 114-grid with colored cells, next session, recitation progress list. Nothing in this branch should have shifted.

Then log in as a brand-new student with zero enrollments:

10. `StudentEmptyHero` ("Find your first halaqah") renders unchanged.

`npm run build` clean. Network tab shows one extra request: `GET /api/rooms?is_public=true&my_status=none&limit=4`.
