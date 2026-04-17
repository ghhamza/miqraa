# المقرأ · Miqraa

**Open-source Quran education platform for Tajweed recitation learning**

License: AGPL-3.0-or-later · Live: https://app.miqraa.org

Jump to: [Demo video](#demo-video) · [Architecture](#architecture) · [Quran Foundation API usage](#quran-foundation-api-usage) · [Running locally](#running-locally)

---

## What Miqraa does

Miqraa (المقرأ) digitizes the traditional halaqah (حَلَقَة): a Quran teacher (معلّم) gathers students, one recites while others listen, the teacher corrects tajweed errors in real time on a shared Mushaf, and each student's progress — which ayahs, which grade, how many pages — is tracked over time.

The live session is the heart of the app. Teachers run scheduled virtual halaqahs with:

- **Live WebRTC audio** — classroom model: teacher always unmuted, students muted except the active reciter. Video for the teacher, audio-only for students. Opus 48 kHz passthrough for recitation quality.
- **Synchronized Madina Mushaf** — all participants see the same page, same ayah highlighted. Rendered in pure HTML/CSS with QCF V2 fonts from Quran Foundation CDN.
- **Word-level error annotations** — teacher taps any word, marks jali/khafi severity and classical category (makharij, sifat, madd, ghunnah, waqf, shadda, …). Annotations sync live to all participants.
- **Grading & pages count** — teacher grades each turn (excellent/good/needs_work/weak) plus 1–5 stars and pages covered (الأوجه).
- **3-turn recitation model** — دَرْس (new lesson) / تَثْبِيت (consolidation) / مُرَاجَعَة (review) per session per student.
- **Attendance sheet** — teacher marks present/absent/excused/late with notes per student per session.
- **Progress tracking** — 114-surah grid, grade distribution, recitation streak, history per student.
- **Quran Foundation streak sync** — every recitation pushes an activity-day to the student's Quran Foundation account, driving the streak counter across the whole QF ecosystem.

## Demo video

Watch the demo: [TODO: paste YouTube/Vimeo link here before submission]

Or try the live platform at **https://app.miqraa.org** — [TODO: add test teacher/student credentials, or replace with "Register a new account to try it out"].

## Quran Foundation API usage

Miqraa integrates two Content APIs and three User APIs from Quran Foundation:

| API | Endpoint | Purpose |
|---|---|---|
| Content — Token | `POST /oauth2/token` (client_credentials) | Service token for content access, cached with refresh buffer |
| Content — Audio | `GET /content/api/v4/recitations/{id}/by_chapter/{n}` | Chapter-level audio files for in-Mushaf recitation playback, 24h chapter cache |
| User — OAuth2 / OIDC | `/oauth2/authorize` + `/oauth2/token` | PKCE + nonce + state flow for user login / account linking |
| User — Activity Day | `POST /auth/v1/activity-days` | Every teacher-graded recitation pushes a Quran activity with verse range → drives the user's QF streak |
| User — Reading Session | `POST /auth/v1/reading-sessions` | Updates the student's "continue reading" position to their last recited ayah |
| User — Streaks | `GET /auth/v1/streaks` | Displayed on student dashboard; cached 60s per user |

Design choices worth highlighting:

- Recitation→QF sync is **fire-and-forget via `tokio::spawn`** — never blocks the API response. Failures land in `recitations.qf_sync_error` for observability.
- **Refresh tokens rotated automatically** 60 s before expiry; new refresh token persisted when QF returns one.
- **QF-first login** creates a local user, and on subsequent email-matching registrations, existing local accounts are linked instead of duplicated.
- **Mushaf ID = 1 (QCF V2)** is sent with every activity day, matching the font the student actually sees.

## Tech stack

- **Backend** — Rust (Axum 0.8, Tokio, sqlx, PostgreSQL 16), JWT + Argon2 auth, webrtc-rs + mediasoup behind a `MediaService` trait for SFU swappability. Single binary.
- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, react-router-dom v7, react-i18next (Arabic / English / French), QCF V2 Mushaf rendering.
- **Quran data** — `quran-meta` (riwaya-aware structural data), Quran Foundation Content API (audio), QCF V2 fonts from `verses.quran.foundation` CDN.
- **Deployment** — AWS EC2 t4g.small (ARM Graviton, Ubuntu 24.04), Cloudflare DNS, Let's Encrypt, Nginx reverse proxy, systemd.

## Architecture

The system is a single Rust binary exposing three surfaces — REST API, WebSocket signaling, and a WebRTC SFU — all sharing a single `AppState` (Arc) that holds the DB pool, room manager, media service, and Quran Foundation clients.

```
Browser (React + QCF V2 Mushaf)
    ├─ REST (Axios)  ─────┐
    ├─ WS signaling  ─────┤
    └─ WebRTC        ─────┤
                          ▼
                  Rust backend (single binary)
                  ├─ Axum handlers
                  ├─ WS signaling (per-session state)
                  └─ SFU (webrtc-rs or mediasoup)
                           │
                           ├─→ PostgreSQL 16
                           └─→ Quran Foundation API (Content + User)
```

The `MediaService` trait lets the SFU backend be swapped (webrtc-rs in dev, mediasoup in prod) without touching the signaling layer.

## Database

15 migrations, all idempotent, applied at startup via `sqlx::migrate!`:

- `001_init` — users, rooms, recitations
- `002_enrollments` — student↔room with pending/approved/rejected
- `003_sessions` — scheduled sessions + attendance
- `004_recitations_update` — grade enum
- `005_riwaya` — hafs/warsh/qalun
- `006_expand_riwaya` — more qira'at modes
- `007_fix_cascades` — proper ON DELETE
- `008_schedules` — recurring session templates
- `009_recurrence` — recurrence groups
- `010_enrollment_settings` — open/closed, requires approval
- `011_halaqah_session_system` — halaqah_type, turn_type, star_rating, pages_count, error_annotations (14 categories)
- `012_annotation_lifecycle` — open/resolved/auto_resolved
- `013_qf_accounts` — QF OAuth2 state, linked accounts
- `014_user_role_pending` — role selection on QF signup
- `015_qf_sync_tracking` — qf_synced_at, qf_sync_error on recitations

## Running locally

### Prerequisites

- Rust 1.75+ (`rustup install stable`)
- Node.js 20+ and `pnpm`
- PostgreSQL 16 running locally
- A Quran Foundation API client (register at https://quran.foundation → Developers)

### 1. Database

```bash
createdb miqraa
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, QF_CLIENT_ID, QF_CLIENT_SECRET
cargo run
```

Migrations run automatically on boot. To create an admin user:

```bash
cargo run -- create-admin --name "Hamza" --email "you@example.com" --password "strongpw"
```

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:5173.

## Project structure

```
miqraa/
├── backend/
│   ├── migrations/          # 001..015 SQL migrations
│   ├── src/
│   │   ├── api/             # Router, handlers, WS signaling, types, extractors
│   │   ├── auth/            # JWT + Argon2
│   │   ├── config/          # AppConfig from .env
│   │   ├── db/              # PgPool
│   │   ├── models/          # User, Room, Recitation, Session, Enrollment
│   │   ├── qf/              # Quran Foundation: OAuth, Content API, User API, PKCE
│   │   ├── rooms/           # In-memory room manager (live session state)
│   │   ├── services/        # Storage
│   │   ├── sfu/             # MediaService trait + webrtc-rs + mediasoup impls
│   │   └── main.rs
│   └── Cargo.toml
│
└── frontend/
    ├── src/
    │   ├── components/      # ui/, rooms/, enrollment/, sessions/, recitations/, mushaf/, session/, layout/, auth/
    │   ├── pages/           # auth/, rooms/, sessions/, recitations/, users/, profile/, settings/, mushaf/
    │   ├── hooks/           # useSessionState, useWebRTCConnection, useMediasoupConnection, useAnnotations, useMushafInteraction, useQfStreak, …
    │   ├── lib/             # api, quranService, qfSync, calendarUtils, riwayaUi, halaqahUi
    │   ├── i18n/locales/    # ar.json, en.json, fr.json — 677 keys each, 100% parity
    │   ├── stores/          # Zustand auth store
    │   └── types/
    └── package.json
```

## License

AGPL-3.0-or-later — see [LICENSE](./LICENSE).

The AGPL choice is deliberate: Miqraa is a web-based platform, and the AGPL closes the SaaS loophole that the regular GPL leaves open. Anyone running a modified copy over a network must publish their modifications. Fonts (QCF V2, OFL-1.1) are compatible.

## Acknowledgments

- **Quran Foundation** — for the Content & User APIs, QCF V2 fonts, and the Provision Launch program.
- **Dr. Amin Anane** — for DigitalKhatt, which informed early Mushaf rendering research.
- **Tanzil.net** — Uthmani Quran text.
- **Tarteel QUL** — Mushaf layout reference data.
- **Dr. Al-Qasim / KSU** — for the inspiration behind the Wiqaya method, the origin of this work.

---

Built by Hamza Ghandouri · https://miqraa.org

بسم الله الرحمن الرحيم
