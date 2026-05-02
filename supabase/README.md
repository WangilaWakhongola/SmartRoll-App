# SmartRoll — Supabase Database

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | Full current schema — run this for a fresh setup |
| `migrations/001_initial_schema.sql` | uuid extension + profiles table |
| `migrations/002_classes_extended.sql` | classes table with GPS, geofence, enrollment |
| `migrations/003_sessions_extended.sql` | sessions table with status + instructor alias |
| `migrations/004_attendance_extended.sql` | attendance table with GPS, face score, flags |
| `migrations/005_rls_policies.sql` | Row Level Security for all tables |
| `migrations/006_realtime_storage.sql` | Realtime subscriptions + face-photos bucket |
| `migrations/007_add_missing_columns.sql` | Adds missing columns to existing databases |

## Fresh Setup (Recommended)

1. Open your Supabase project → **SQL Editor**
2. Paste and run `schema.sql` — this creates everything in one shot

## Incremental Migrations

If you already have a database and need to apply changes:

1. Open **SQL Editor**
2. Run each migration file in order: `001` → `002` → ... → `006`
3. Each file is idempotent (`IF NOT EXISTS`) — safe to re-run

## Environment Variables

Copy `.env.example` to `.env` and fill in your project credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in: Supabase Dashboard → **Project Settings** → **API**

## Tables

### `profiles`
Extends `auth.users`. Stores role (`student` | `lecturer`), student/staff IDs, enrolled class, and face photo URL.

### `classes`
A unit/course created by a lecturer. Stores GPS coordinates and geofence radius for the classroom location.

### `sessions`
A live attendance session started by a lecturer for a class. Has `is_active` (geofence toggle) and `status` (`open` | `closed`).

### `attendance`
One record per student per session. Stores GPS coordinates at sign-in time, distance from classroom, and face match score.

## Realtime

`attendance` and `sessions` tables are published to Supabase Realtime. The app subscribes to these channels for live dashboard updates.

## Storage

`face-photos` bucket stores student profile selfies. Path format: `{user_id}/profile.jpg`. Access is restricted by RLS — users can only access their own folder.
