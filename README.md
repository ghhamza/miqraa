# المقرأ — Miqraa

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Website](https://img.shields.io/badge/Website-miqraa.org-1B5E20)](https://miqraa.org)

Open-source Quran education platform for Tajweed recitation learning.

Teachers run virtual recitation classrooms — students recite one at a time, the teacher corrects Tajweed in real-time via live audio/video, grades are given instantly, and progress is tracked over time.

## Features

- **Mushaf Viewer** — Pixel-perfect Madina Mushaf (QCF V2, same as Quran.com) with word-level interaction
- **Live Sessions** — Real-time audio + teacher video via WebRTC SFU
- **Ayah Tracking** — Teacher clicks an ayah → all students' Mushafs follow in real-time
- **Live Grading** — Grade recitations during the session with instant student notifications
- **Classroom Management** — Rooms, enrollments, schedules, attendance, recitation history
- **Trilingual** — Arabic (RTL), English, French
- **Open Source** — AGPL-3.0, self-hostable

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind v4 + Amiri font |
| Mushaf | QCF V2 fonts (Quran Foundation CDN) |
| Backend | Rust — Axum 0.8 + Tokio |
| SFU | webrtc-rs (single binary) |
| Database | PostgreSQL + sqlx |
| Auth | JWT + Argon2 |

## Run

```bash
# Database
createdb miqraa

# Backend
cd backend
cp .env.example .env
cargo run

# Frontend
cd frontend
npm install
npm run dev
```

Verify: `curl http://localhost:3000/health` • Open `http://localhost:5173`

## License

[AGPL-3.0-or-later](LICENSE)
