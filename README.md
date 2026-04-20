# Miqraa

Miqraa is an open-source Quran education platform licensed under AGPL-3.0. It focuses on live Tajweed recitation classrooms where one reciter reads at a time while the teacher corrects in real time. The platform also includes scheduled sessions, attendance, recitation history, streaks, and a Mushaf whiteboard with error annotations.

## Architecture

Miqraa is built around three services:

- **Rust backend (Axum)**: REST API, auth, rooms/sessions/recitations, WebSocket signaling for non-media events, and LiveKit token minting.
- **LiveKit server (external)**: all WebRTC media transport (audio and optional teacher video), TURN/STUN, and track routing.
- **React frontend (Vite)**: app UI using `livekit-client`, `api.quran.com`, and QCF V2 Mushaf fonts.

```text
Browser (React + livekit-client + QCF V2)
    ├─ REST + WebSocket signaling (non-media)
    │
    ▼
Rust backend (Axum)
    ├─ Auth + API + Room state
    ├─ Ayah sync / annotations / reciter turn / grading
    └─ LiveKit token minting
            │
            ▼
      LiveKit server
      (WebRTC media plane)
            │
            ▼
    Audio/video transport (TURN/STUN)
```

Non-media classroom events (ayah sync, annotations, reciter turn, grading) continue to use the existing Rust WebSocket channel.

## Tech stack

- **Backend**: Rust, Axum 0.8, Tokio, `sqlx`, PostgreSQL 16, JWT + Argon2, `livekit-api`.
- **Frontend**: React 19, TypeScript, Vite, Tailwind v4, Zustand, Axios, `react-router-dom` v7, `react-i18next` (ar/en/fr), `livekit-client`, `lucide-react`, `quran-meta`.
- **Quran data**: QCF V2 fonts from `verses.quran.foundation`, content from `api.quran.com`.
- **Media**: LiveKit (external; `docker-compose` in dev).

## Getting started

### Prerequisites

- Rust (stable, via rustup)
- Node 22+ and pnpm
- PostgreSQL 16
- Docker (for LiveKit)

### 1) Clone and install

```bash
git clone https://github.com/ghhamza/miqraa.git
cd miqraa
```

### 2) Start LiveKit

```bash
cd infra
docker compose up -d livekit
cd ..
```

### 3) Setup PostgreSQL

Create a local `miqraa` database and user, then ensure your backend `DATABASE_URL` points to it.

### 4) Backend

```bash
cd backend
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET, LiveKit vars
cargo run
```

Migrations run automatically at startup.

### 5) Create an admin

```bash
cargo run -- create-admin
```

### 6) Frontend

```bash
cd ../frontend
pnpm install
pnpm dev
```

### 7) Open the app

Open [http://localhost:5173](http://localhost:5173), then log in with the admin account.

## Project structure

```text
miqraa/
├── backend/         # Rust (Axum) — API + WebSocket signaling + LiveKit token minter
├── frontend/        # React + Vite — UI, QCF V2 Mushaf, livekit-client
├── infra/           # Docker Compose for LiveKit (dev media server)
```

## Environment variables (backend)

### Core

- `DATABASE_URL`
- `JWT_SECRET`
- `HOST`
- `PORT`
- `STORAGE_PATH`
- `RUST_LOG`

### Quran Foundation (optional; needed for OAuth login + streak sync)

- `QF_ENV`
- `QF_CLIENT_ID`
- `QF_CLIENT_SECRET`
- `QF_REDIRECT_URI`
- `QF_SCOPES`

### LiveKit (required for live sessions)

- `APP_LIVEKIT_URL` (example: `ws://localhost:7880` in dev)
- `APP_LIVEKIT_HTTP_URL` (example: `http://localhost:7880` in dev)
- `APP_LIVEKIT_API_KEY` (example: `devkey` in dev)
- `APP_LIVEKIT_API_SECRET` (example: `secret` in dev)

## Useful commands

- `cargo run` — run backend
- `cargo run -- create-admin` — create admin user
- `pnpm dev` — run frontend dev server
- `pnpm build` — build frontend for production
- `cd infra && docker compose up -d livekit` — start LiveKit
- `cd infra && docker compose logs -f livekit` — view LiveKit logs

## License

AGPL-3.0.

## Contributing

Issues and pull requests are welcome. The project is in active development, so check open issues before starting large changes.
