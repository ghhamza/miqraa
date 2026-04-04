# المقرأ — Miqraa

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Open-source Quran education platform for Tajweed recitation learning.

## Layout

| Layer         | Technology                  | Purpose                          |
|---------------|----------------------------|----------------------------------|
| Frontend      | React 19 + Vite + TS       | Student/Teacher UI               |
| Styling       | Tailwind v4 + Amiri font   | Arabic-first RTL design          |
| Backend API   | Axum 0.8 + Tokio           | REST API + WebSocket signaling   |
| SFU           | webrtc-rs                  | Audio-only selective forwarding  |
| Database      | PostgreSQL + sqlx          | Users, rooms, recitations        |
| Storage       | Local filesystem           | Recitation recordings (`./data/recordings`) |
| Auth          | JWT + Argon2               | Secure authentication            |

## Run

1. **Database:** `createdb miqraa` (or create DB and user matching `DATABASE_URL` in `backend/.env`)
2. **Backend:** `cd backend && cargo run` (see `backend/.env.example`; copy to `backend/.env`)
3. **Frontend:** `cd frontend && npm run dev`

Verify: `curl http://localhost:3000/health`, open `http://localhost:5173`.
