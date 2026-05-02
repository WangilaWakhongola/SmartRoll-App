# SmartRoll — GPS-Based Smart Attendance App

A React Native (Expo) mobile app that lets students sign attendance only when physically inside the classroom, verified by GPS geofencing, selfie capture, and biometric authentication.

---

## Project Structure

```
smartroll/
├── app/                        # Expo Router screens
│   ├── (auth)/                 # Login, signup, forgot/reset password
│   ├── (instructor)/           # Lecturer dashboard, units, sessions, reports
│   │   ├── session/[id].tsx    # Live session management
│   │   └── report/[id].tsx     # Per-session attendance report
│   ├── (student)/              # Student dashboard, enroll, analytics, history
│   ├── _layout.tsx             # Root navigator + auth guard
│   └── index.tsx               # Animated splash/preloader
│
├── src/
│   ├── components/
│   │   ├── ui/                 # Reusable UI primitives (Button, Card, Input…)
│   │   └── SelfieCapture.tsx   # Camera modal for identity selfie
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Session, user profile, sign in/out
│   │   └── AttendanceContext.tsx # Active session subscription
│   ├── hooks/
│   │   ├── useAttendance.ts    # Submit attendance record
│   │   ├── useLocation.ts      # Live GPS coordinates
│   │   ├── useLecturerAttendance.ts  # Real-time sign-in feed
│   │   ├── useLecturerReports.ts     # Per-student report builder
│   │   ├── useLecturerSession.ts     # Start / end sessions
│   │   ├── useStudentAttendance.ts   # Student attendance history
│   │   └── useStudentSession.ts      # Watch active session
│   ├── services/
│   │   ├── supabase.ts         # Supabase client (single source of truth)
│   │   ├── biometric.service.ts
│   │   ├── geofence.service.ts
│   │   └── notification.service.ts
│   ├── types/
│   │   └── index.ts            # Shared TypeScript interfaces
│   └── utils/
│       ├── helpers.ts          # Date, GPS, math utilities
│       └── passwordRules.ts    # Password validation + strength
│
├── supabase/
│   ├── schema.sql              # Full schema — run for fresh setup
│   ├── README.md               # Database setup guide
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_classes_extended.sql
│       ├── 003_sessions_extended.sql
│       ├── 004_attendance_extended.sql
│       ├── 005_rls_policies.sql
│       └── 006_realtime_storage.sql
│
├── constants/
│   └── theme.ts                # Colors, Spacing, Typography
│
├── lib/                        # Backward-compat shims (re-export only)
│   ├── supabase.ts             → src/services/supabase.ts
│   └── utils.ts                → src/utils/helpers.ts
│
├── .env                        # Local env vars (not committed)
├── .env.example                # Template for env vars
├── app.json                    # Expo config
└── tsconfig.json               # Path aliases (@hooks, @services, etc.)
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Fill in your Supabase URL and anon key
```

### 3. Set up the database
Open your Supabase project → SQL Editor → paste and run `supabase/schema.sql`.

See `supabase/README.md` for incremental migration instructions.

### 4. Run the app
```bash
npm start          # Expo dev server
npm run android    # Android
npm run ios        # iOS
```

---

## Path Aliases

Configured in `tsconfig.json` and `babel.config.js`:

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@contexts/*` | `src/contexts/*` |
| `@hooks/*` | `src/hooks/*` |
| `@services/*` | `src/services/*` |
| `@utils/*` | `src/utils/*` |
| `@types/*` | `src/types/*` |
| `@constants/*` | `constants/*` |
| `@supabase/*` | `supabase/*` |

---

## Roles

| Role | Access |
|------|--------|
| `student` | Dashboard, enroll in units, sign attendance (GPS + selfie + biometric), analytics |
| `lecturer` | Manage units, start/end sessions, live sign-in feed, reports, export CSV |

---

## Key Features

- **GPS Geofencing** — attendance only accepted within configurable radius of classroom
- **Selfie Verification** — front camera capture at sign-in time
- **Biometric Auth** — fingerprint / Face ID confirmation
- **Real-time Dashboard** — lecturer sees sign-ins appear live via Supabase Realtime
- **At-risk Detection** — flags students below 75% attendance
- **CSV Export** — full attendance report per session
- **Push Notifications** — session start alerts (optional)
