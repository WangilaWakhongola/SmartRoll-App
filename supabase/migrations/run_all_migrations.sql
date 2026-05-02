-- ============================================================
-- SmartRoll — Full Migration Script
-- Safe to run on a FRESH or EXISTING Supabase database.
-- Paste this entire file into the Supabase SQL Editor and run it.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 001 — Extensions & profiles table
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('student', 'lecturer')),
  student_id      TEXT,
  staff_id        TEXT,
  class_id        UUID,
  face_photo_url  TEXT,
  push_token      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_id       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_id       UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS face_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_role     ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_class_id ON public.profiles(class_id);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'profiles_updated_at' AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- 002 — Classes table
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.classes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  class_id         TEXT,
  building         TEXT,
  latitude         DOUBLE PRECISION DEFAULT 0,
  longitude        DOUBLE PRECISION DEFAULT 0,
  radius_meters    INTEGER NOT NULL DEFAULT 50,
  enrollment_open  BOOLEAN NOT NULL DEFAULT FALSE,
  lecturer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instructor_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS class_id        TEXT;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS building        TEXT;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS latitude        DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS longitude       DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS radius_meters   INTEGER NOT NULL DEFAULT 50;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS enrollment_open BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS instructor_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

UPDATE public.classes
  SET instructor_id = lecturer_id
  WHERE instructor_id IS NULL AND lecturer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classes_lecturer_id   ON public.classes(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id ON public.classes(instructor_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'classes_updated_at' AND tgrelid = 'public.classes'::regclass
  ) THEN
    CREATE TRIGGER classes_updated_at
      BEFORE UPDATE ON public.classes
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_profiles_class' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT fk_profiles_class
      FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- 003 — Sessions table
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sessions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id       UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  lecturer_id    UUID NOT NULL REFERENCES public.profiles(id),
  instructor_id  UUID REFERENCES public.profiles(id),
  room_lat       DOUBLE PRECISION NOT NULL DEFAULT 0,
  room_lng       DOUBLE PRECISION NOT NULL DEFAULT 0,
  radius_metres  INTEGER NOT NULL DEFAULT 50,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'open';

UPDATE public.sessions
  SET instructor_id = lecturer_id
  WHERE instructor_id IS NULL AND lecturer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_class_id      ON public.sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_lecturer_id   ON public.sessions(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor_id ON public.sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active     ON public.sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_status        ON public.sessions(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sessions_updated_at' AND tgrelid = 'public.sessions'::regclass
  ) THEN
    CREATE TRIGGER sessions_updated_at
      BEFORE UPDATE ON public.sessions
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- 004 — Attendance table
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.attendance (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.profiles(id),
  status           TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  distance_metres  INTEGER,
  face_match_score DOUBLE PRECISION,
  suspicious_flag  BOOLEAN DEFAULT FALSE,
  signed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS face_match_score DOUBLE PRECISION;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS suspicious_flag  BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);


-- ════════════════════════════════════════════════════════════
-- 005 — Row Level Security
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ── profiles policies ────────────────────────────────────────
-- Drop and recreate all profile policies cleanly
DROP POLICY IF EXISTS "Users read own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Lecturers read class profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public read email by student_id" ON public.profiles;
DROP POLICY IF EXISTS "Public read email by staff_id"   ON public.profiles;

-- Authenticated users can read their own profile
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Authenticated users can update their own profile
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Authenticated users can insert their own profile
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Lecturers can read profiles of students in their class
CREATE POLICY "Lecturers read class profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.classes c
    WHERE (c.lecturer_id = auth.uid() OR c.instructor_id = auth.uid())
      AND c.id = profiles.class_id
  ));

-- *** CRITICAL: Allow unauthenticated lookup of email by student_id or staff_id ***
-- This is needed for the login screen to resolve an ID to an email before signing in
CREATE POLICY "Public read email by student_id"
  ON public.profiles FOR SELECT
  USING (student_id IS NOT NULL);

CREATE POLICY "Public read email by staff_id"
  ON public.profiles FOR SELECT
  USING (staff_id IS NOT NULL);

-- ── classes policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "Lecturers manage own classes"                       ON public.classes;
DROP POLICY IF EXISTS "Instructors manage own classes via instructor_id"   ON public.classes;
DROP POLICY IF EXISTS "Students read their class"                          ON public.classes;
DROP POLICY IF EXISTS "Students read open enrollment classes"              ON public.classes;

CREATE POLICY "Lecturers manage own classes" ON public.classes FOR ALL
  USING (lecturer_id = auth.uid() OR instructor_id = auth.uid());

CREATE POLICY "Instructors manage own classes via instructor_id" ON public.classes FOR ALL
  USING (instructor_id = auth.uid());

CREATE POLICY "Students read their class" ON public.classes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.class_id = classes.id
  ));

CREATE POLICY "Students read open enrollment classes" ON public.classes FOR SELECT
  USING (enrollment_open = TRUE);

-- ── sessions policies ────────────────────────────────────────
DROP POLICY IF EXISTS "Lecturers manage own sessions"                     ON public.sessions;
DROP POLICY IF EXISTS "Instructors manage own sessions via instructor_id" ON public.sessions;
DROP POLICY IF EXISTS "Students read active sessions"                     ON public.sessions;

CREATE POLICY "Lecturers manage own sessions" ON public.sessions FOR ALL
  USING (lecturer_id = auth.uid() OR instructor_id = auth.uid());

CREATE POLICY "Instructors manage own sessions via instructor_id" ON public.sessions FOR ALL
  USING (instructor_id = auth.uid());

CREATE POLICY "Students read active sessions" ON public.sessions FOR SELECT
  USING (is_active = TRUE AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.class_id = sessions.class_id
  ));

-- ── attendance policies ──────────────────────────────────────
DROP POLICY IF EXISTS "Students insert own attendance"    ON public.attendance;
DROP POLICY IF EXISTS "Students read own attendance"      ON public.attendance;
DROP POLICY IF EXISTS "Lecturers read session attendance" ON public.attendance;

CREATE POLICY "Students insert own attendance" ON public.attendance FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students read own attendance" ON public.attendance FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Lecturers read session attendance" ON public.attendance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = attendance.session_id
      AND (s.lecturer_id = auth.uid() OR s.instructor_id = auth.uid())
  ));


-- ════════════════════════════════════════════════════════════
-- 006 — Realtime & Storage
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('face-photos', 'face-photos', false)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Users upload own face photo"        ON storage.objects;
DROP POLICY IF EXISTS "Users read own face photo"          ON storage.objects;
DROP POLICY IF EXISTS "Lecturers read student face photos" ON storage.objects;

CREATE POLICY "Users upload own face photo" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'face-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own face photo" ON storage.objects FOR SELECT
  USING (bucket_id = 'face-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Lecturers read student face photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'face-photos');


-- ════════════════════════════════════════════════════════════
-- 008 — Auto-create profile trigger on signup
-- SECURITY DEFINER bypasses RLS so profile is always created
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, role, student_id, staff_id
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.raw_user_meta_data->>'student_id',
    NEW.raw_user_meta_data->>'staff_id'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    role       = CASE WHEN EXCLUDED.role      <> '' THEN EXCLUDED.role      ELSE profiles.role      END,
    student_id = COALESCE(EXCLUDED.student_id, profiles.student_id),
    staff_id   = COALESCE(EXCLUDED.staff_id,   profiles.staff_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ════════════════════════════════════════════════════════════
-- Backfill profiles for existing auth users
-- ════════════════════════════════════════════════════════════

INSERT INTO public.profiles (id, email, full_name, role, student_id, staff_id)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(u.raw_user_meta_data->>'role', 'student'),
  u.raw_user_meta_data->>'student_id',
  u.raw_user_meta_data->>'staff_id'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ════════════════════════════════════════════════════════════
-- Done ✓
-- ════════════════════════════════════════════════════════════
