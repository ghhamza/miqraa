# مقرأ — Miqraa Project Context

You are assisting Hamza in building Miqraa (المقرأ), an open-source Quran education platform focused on Tajweed recitation learning. The project is licensed under AGPL-3.0-or-later and hosted at **miqraa.org**. When Hamza asks for prompts, code, architecture decisions, or debugging help, use this context to give accurate, consistent answers.

## What Miqraa Does

Teachers (معلّمون) run virtual Quran recitation classrooms. Students recite one at a time while the teacher and other students listen. The teacher corrects Tajweed in real-time via live audio/video sessions. Sessions are scheduled, attendance is auto-tracked, and each student's recitation history (which surahs, which ayahs, what grade) builds a progress profile. Teachers grade recitations live during sessions with instant student notifications.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, TypeScript, Vite | Student/Teacher UI |
| **Styling** | Tailwind CSS v4, Amiri + IBM Plex Sans Arabic + Scheherazade New | Arabic-first RTL design |
| **Mushaf Rendering** | QCF V2 (Quran Complex Fonts) — per-page WOFF2 from Quran Foundation CDN | Pixel-perfect Uthman Taha calligraphy, word-level `<span>` interaction |
| **State** | Zustand (auth), React hooks (session state) | Client-side state management |
| **HTTP** | Axios with JWT interceptor | REST API communication |
| **Routing** | react-router-dom v7 | SPA routing |
| **i18n** | react-i18next (ar/en/fr) | Trilingual support |
| **Backend API** | Rust — Axum 0.8, Tokio | REST API + WebSocket signaling |
| **SFU** | webrtc-rs (behind `MediaService` trait) | Audio + teacher-video selective forwarding |
| **Database** | PostgreSQL 16, sqlx (compile-time queries) | Users, rooms, sessions, recitations |
| **Auth** | JWT + Argon2 | Secure authentication |
| **Storage** | Local filesystem (`./data/recordings`) | Recitation recordings (future) |

**Development environment**: macOS native, no Docker. `createdb miqraa` for the database.

## Run

```bash
# 1. Database
createdb miqraa

# 2. Backend
cd backend
cp .env.example .env    # edit DATABASE_URL, JWT_SECRET, etc.
cargo run               # http://localhost:3000

# 3. Frontend
cd frontend
npm install
npm run dev             # http://localhost:5173

# Verify
curl http://localhost:3000/health
```

## Design System

- **Direction**: Arabic = RTL (default), English/French = LTR. Layout flips dynamically.
- **Colors**: background `#FAFAF5`, surface `#FFFFFF`, primary `#1B5E20`, primary-light `#4CAF50`, gold `#D4A843`, text `#1A1A1A`, muted `#6B7280`
- **Mushaf colors**: page cream `#FDF6E3`, frame border `#2c5f7c` (dark teal), surah title frame with arabesque SVG ornament
- **Grade colors**: excellent `#1B5E20`, good `#4CAF50`, needs_work `#F57F17`, weak `#EF5350`
- **Fonts**: Amiri (Quran headings), IBM Plex Sans Arabic (UI), Scheherazade New (surah titles via `--font-mushaf-title`), QCF V2 page fonts (Quran body text, loaded dynamically)
- **Style**: Clean, minimal, warm. White cards with subtle shadow. Rounded corners 8–12px. Generous padding. No flashy gradients.
- **Logo**: "المقرأ" in Amiri font

## Project Structure

```
miqraa/
├── backend/
│   ├── src/
│   │   ├── api/          # Router, handlers (auth, users, rooms, enrollments, sessions, recitations)
│   │   │   └── ws/       # WebSocket signaling (signaling.rs, messages.rs) — JWT auth, room state, classroom rules
│   │   ├── auth/         # JWT + Argon2
│   │   ├── config/       # AppConfig from .env
│   │   ├── db/           # PgPool
│   │   ├── models/       # User, Room, Recitation
│   │   ├── rooms/        # RoomManager — in-memory session state, participants, broadcast, classroom rules
│   │   ├── services/     # StorageService (local filesystem)
│   │   ├── sfu/          # MediaService trait + WebRtcSfu implementation (webrtc-rs)
│   │   └── main.rs       # Single binary: API + signaling + SFU
│   └── migrations/       # 001–010
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/       # Button, Input, Badge, Modal, Table, GradeBadge, AppLayout
│   │   │   ├── mushaf/   # QCFPageRenderer, MushafBookLayout, MushafCanvas, MushafNavigation, MushafMiniViewer
│   │   │   ├── session/  # ParticipantDrawer, SessionTopBar, SessionBottomBar, GradingPanel, AyahControls, AutoFollowBadge, GradeToast, ConnectionStatus, ReconnectingOverlay
│   │   │   ├── rooms/    # RoomCard, RoomFormModal, ArchiveRoomModal
│   │   │   ├── enrollment/ # EnrollStudentModal, EnrolledStudentsList, PendingRequestsList
│   │   │   ├── sessions/ # SessionFormModal, SessionBlock, AttendanceList, ScheduleManager, UpcomingSessionsWidget
│   │   │   └── recitations/ # RecitationFormModal, SurahPicker, SurahProgressGrid, GradeDistributionBar
│   │   ├── pages/
│   │   │   ├── auth/     # LoginPage, RegisterPage
│   │   │   ├── home/     # HomePage (role-based dashboard)
│   │   │   ├── users/    # UsersPage, UserDetailPage
│   │   │   ├── rooms/    # RoomsPage, RoomDetailPage, ArchivedRoomsPage
│   │   │   ├── sessions/ # CalendarPage, SessionDetailPage, LiveSessionPage
│   │   │   ├── recitations/ # RecitationsPage, StudentProgressPage
│   │   │   ├── mushaf/   # MushafPage
│   │   │   └── profile/  # ProfilePage
│   │   ├── hooks/        # useMushafInteraction, useQuranPage, useSessionWebSocket, useSessionState, useWebRTCConnection
│   │   ├── stores/       # authStore (Zustand)
│   │   ├── lib/          # api.ts, quranService.ts, mushafFontLoader.ts, calendarUtils.ts, wsUrl.ts
│   │   ├── data/quran/   # surahs.json, juz.json, hizb.json
│   │   ├── i18n/         # locales/ar.json, en.json, fr.json
│   │   └── types/
│   └── vite.config.ts
```

## Database Schema

**users**: id (UUID), name, email, password_hash, role (student/teacher/admin), created_at

**rooms**: id, name, teacher_id → users, max_students, is_active, riwaya (hafs/warsh/qalun), created_at

**enrollments**: id, room_id → rooms, student_id → users, status (pending/approved/rejected), enrolled_at. UNIQUE(room_id, student_id)

**sessions**: id, room_id → rooms, title, scheduled_at, duration_minutes, status (scheduled/in_progress/completed/cancelled), recurrence_group_id, notes, created_at

**session_attendance**: id, session_id → sessions, student_id → users, attended, joined_at, left_at

**recitations**: id, student_id → users, room_id → rooms (nullable), session_id → sessions (nullable), teacher_id → users, surah, ayah_start, ayah_end, grade (excellent/good/needs_work/weak), riwaya (hafs/warsh/qalun), recording_path, teacher_notes, created_at

## API Endpoints

**Auth**: POST register, POST login, GET /me

**Users** (admin only): GET list (?role, ?search), GET by id, POST create, PUT update, DELETE, GET stats

**Rooms**: GET list (role-scoped, ?search, ?active), GET by id (with teacher_name, enrolled_count), POST create (teacher/admin), PUT update (owner/admin), DELETE (owner/admin), GET stats, GET /teachers (admin), GET /students (?exclude_room_id)

**Enrollments**: GET /rooms/{id}/enrollments, POST enroll, DELETE remove, GET count

**Sessions**: GET list (role-scoped, ?room_id, ?status, ?from, ?to), GET by id (with attendance), POST create (overlap validation, auto-creates attendance), PUT update (status transitions), DELETE (not completed), PUT attendance (bulk), GET upcoming, GET /rooms/{id}/sessions

**Recitations**: GET list (role-scoped, many filters), GET by id, POST create (validates surah/ayah), PUT update grade/notes, DELETE, GET stats, GET /students/{id}/recitations, GET /students/{id}/progress (surahs covered, streak, grade distribution)

**WebSocket**: GET /api/ws/session/:session_id?token=<JWT> — live session signaling

## What Is Built (Phases 1–2)

### Phase 1 — CRUD & Core Platform
1. **Auth** — Login, register, logout, JWT persistence, ProtectedRoute, AdminRoute
2. **Users CRUD** — Admin management with stats, search, role filter, badges
3. **Rooms CRUD** — Card grid, teacher assignment, riwaya selection, enrollment modes (open/closed/requires approval), archive
4. **Enrollment** — Teacher-driven + student self-join with pending/approved/rejected states, capacity validation
5. **Sessions & Calendar** — Month + week views (CSS grid), session lifecycle, recurring sessions with `recurrence_group_id`, schedule templates, attendance
6. **Recitation Log** — Surah/ayah/grade logging, 114-surah progress grid, streak, grade distribution
7. **Quran Data Layer** — quran-meta (Hafs/Warsh/Qalun), surahs/juz/hizb JSON, quranService with search/validation/navigation
8. **Dashboards** — Role-based home page with upcoming sessions, stats, quick actions
9. **Pagination** — API-level pagination across all list endpoints
10. **Profile** — User profile management, password change
11. **i18n** — Arabic (RTL), English (LTR), French (LTR), LanguageSwitcher everywhere
12. **Reusable UI** — Button, Input, Badge, Modal, Table, GradeBadge, AppLayout with collapsible sidebar

### Phase 2 — Mushaf Rendering + Live Sessions

**Part A — Mushaf Rendering (QCF V2)**:
- Replaced DigitalKhatt (WASM + canvas) with **QCF V2** (same approach as Quran.com)
- 604 per-page WOFF2 fonts loaded on demand from `verses.quran.foundation` CDN (~30–50KB each)
- Font-family pattern: `p{PAGE}-v2` (e.g., `p510-v2`)
- Quran text data fetched from `api.quran.com` (word-level `code_v2` glyphs, line numbers, page numbers)
- `QCFPageRenderer` — pure HTML/CSS, each word is a `<span>`, `text-align: justify` for line justification
- Fully responsive — `ResizeObserver` + proportional `font-size`, no custom zoom
- `MushafBookLayout` — ornamental frame (teal `#2c5f7c` double border), running headers (surah + juz) inside frame, Arabic-Indic page number at bottom inside frame
- Surah titles rendered in arabesque SVG ornament frame with Scheherazade New font
- Basmalah centered with Scheherazade New
- `useMushafInteraction` hook — highlight range (green `rgba(27,94,32,0.12)`), active word (gold `rgba(212,168,67,0.3)`), auto-navigation to page containing highlighted ayah, smooth scroll
- `MushafMiniViewer` — compact viewer with auto-follow toggle (built, hidden for future use)
- Riwaya selector hidden (defaults to Hafs), other riwayat show "Coming soon"

**Part B — Live Audio/Video Sessions**:
- **WebSocket signaling** (`/api/ws/session/:id?token=JWT`) — JWT auth via query param, `RoomManager` with `SessionState`, participant lifecycle (join/leave/broadcast), classroom rules enforced server-side
- **webrtc-rs SFU** — `MediaService` trait (swappable for LiveKit etc.), `WebRtcSfu` implementation, selective forwarding: teacher audio+video → all, active reciter audio → all, others muted at SFU level. Opus 48kHz passthrough, VP8 for teacher video
- **LiveSessionPage** (`/sessions/:id/live`) — full Mushaf layout (same as MushafPage) with session tools overlay: `SessionTopBar` (connection status, timer, end session), `SessionBottomBar` (mute, ayah controls, participants toggle), `ParticipantDrawer` (slide-out panel with participant list + grading)
- **WebRTC peer connection** — `useWebRTCConnection` hook, `getUserMedia` with echo cancellation, SDP offer/answer exchange with SFU, remote audio via `<audio>` elements, teacher video via `<video>` element, audio level meter via `AnalyserNode`, device change handling
- **Session lifecycle** — "Start session" on detail page (scheduled → in_progress + auto-navigate), "End session" (teacher broadcasts `session-ended`, all clients redirect), auto-attendance tracking (join_at/left_at on WebSocket connect/disconnect)
- **Live ayah tracking** — teacher clicks ayah → `current-ayah` via WebSocket → all students' Mushafs auto-navigate and highlight. Next/Prev ayah buttons (N/P keys). Auto-follow toggle for students (Following vs Free browse)
- **Live grading** — `GradingPanel` in participant drawer, 4 colored grade buttons, pre-filled surah/ayah from current position, POST `/api/recitations`, running list of session grades. `grade-notification` via WebSocket → student sees `GradeToast`
- **Polish** — WebSocket auto-reconnect with exponential backoff, WebRTC reconnection on new SFU offer, multiple tabs prevention (latest wins), browser back confirmation (`beforeunload`), session timeout (10 min inactivity → auto-complete), network quality indicator (3-bar signal from WebRTC stats), room full check, mic permission denied handling, keyboard shortcuts (M=mute, N=next ayah, P=prev ayah, Esc=close drawer), screen reader announcements (`aria-live`), mobile layout polish (safe areas, bottom sheet drawer), i18n completeness check

## What Is NOT Built Yet (Potential Phase 3)

- **Recording & Playback** — Audio capture, upload, storage (S3/MinIO), playback in recitation history
- **Tajweed Annotations** — QCF V4 colored fonts, teacher marks specific letters/words with tajweed rules
- **Ijazah Tracking** — Certification chain, teacher certifies student completion
- **Push Notifications** — Session reminders, grade alerts (email/push)
- **Docker Deployment** — Production Docker Compose, CI/CD
- **Mobile App** — React Native (QCF V2 fonts work cross-platform)

## Key Architecture Decisions

- **Single Rust binary**: API + WebSocket signaling + SFU in one process. No microservices.
- **`MediaService` trait**: Abstracts the SFU implementation. Current: `WebRtcSfu` (webrtc-rs). Future: `LiveKitProvider`, `JanusProvider`, etc.
- **QCF V2 for Mushaf**: Same fonts as Quran.com. Per-page WOFF2 from CDN, pure HTML/CSS, word-level `<span>` elements. Replaced DigitalKhatt (WASM) due to zoom/overflow/performance issues.
- **Audio + teacher video**: Opus 48kHz passthrough for Tajweed quality. Teacher-only video (VP8). Students don't send video.
- **Classroom model**: One reciter at a time + teacher always unmuted + other students listen. Enforced at SFU level.
- **No Docker in dev**: macOS native, PostgreSQL local. Docker for production deployment only (Phase 3).
- **AGPL-3.0-or-later**: Closes the SaaS loophole. Compatible with QCF font license (KFGQPC freeware).

## When Generating Cursor Prompts

Hamza uses **Cursor** as his primary IDE. Prompts are pasted directly into Cursor. When generating them:
- Start with a **Context** section explaining what already exists
- Specify both **backend AND frontend** changes
- Include the **design system** reminder (colors, fonts, RTL)
- List all **i18n translations** needed (Arabic, English, French)
- Reference existing files/components/handlers that should be updated
- End with **test instructions** (what to verify manually)
- Be explicit about validation rules, error messages, and role-based access
- Remind about the `AuthenticatedUser` extractor for backend auth

## Coding Conventions

- **Backend**: `AuthenticatedUser` extractor for auth. Admin routes check role → 403. Errors return JSON. sqlx compile-time queries. `RoomManager` behind `Arc<RwLock<>>`.
- **Frontend**: Zustand for auth state, React hooks for session state. Axios with interceptor. react-router-dom v7. Components in `components/`, pages in `pages/`. All text via `t('namespace.key')`.
- **Roles**: student → طالب, teacher → معلّم, admin → مشرف
- **API**: REST, JSON, UUIDs, snake_case fields, created_at on all entities.
- **WebSocket**: JSON messages with `type` field. Client → server: mute, set-reciter, current-ayah, answer, ice-candidate. Server → client: room-state, user-joined, user-left, reciter-changed, current-ayah, offer, ice-candidate, session-ended, grade-notification.
