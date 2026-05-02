-- ============================================================
-- SmartRoll — Master Schema
-- Paste this entire file into Supabase SQL Editor and run it.
-- It is safe to run on a fresh database.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── profiles ────────────────────────────────────────────────
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

-- ── classes ─────────────────────────────────────────────────
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

-- FK: profiles.class_id -> classes.id
-- Also ensures the column exists for databases upgraded from older migrations
DO $$
BEGIN
  -- Add class_id column if missing (e.g. existing DB from older migration)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'class_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN class_id UUID;
  END IF;

  -- Add FK constraint if not already present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_profiles_class'
      AND table_name      = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT fk_profiles_class
      FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── sessions ────────────────────────────────────────────────
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

-- ── attendance ──────────────────────────────────────────────
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

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role         ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_class_id     ON public.profiles(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_lecturer_id   ON public.classes(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id ON public.classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class_id     ON public.sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_lecturer_id  ON public.sessions(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active    ON public.sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_status       ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_attendance_session    ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student    ON public.attendance(student_id);

-- ── updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ── profiles policies ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lecturers read class profiles' AND tablename = 'profiles') THEN
    CREATE POLICY "Lecturers read class profiles" ON public.profiles FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.classes c
        WHERE (c.lecturer_id = auth.uid() OR c.instructor_id = auth.uid())
          AND c.id = profiles.class_id
      ));
  END IF;
END $$;

-- ── classes policies ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lecturers manage own classes' AND tablename = 'classes') THEN
    CREATE POLICY "Lecturers manage own classes" ON public.classes FOR ALL
      USING (lecturer_id = auth.uid() OR instructor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students read their class' AND tablename = 'classes') THEN
    CREATE POLICY "Students read their class" ON public.classes FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.class_id = classes.id
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students read open enrollment classes' AND tablename = 'classes') THEN
    CREATE POLICY "Students read open enrollment classes" ON public.classes FOR SELECT
      USING (enrollment_open = TRUE);
  END IF;
END $$;

-- ── sessions policies ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lecturers manage own sessions' AND tablename = 'sessions') THEN
    CREATE POLICY "Lecturers manage own sessions" ON public.sessions FOR ALL
      USING (lecturer_id = auth.uid() OR instructor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students read active sessions' AND tablename = 'sessions') THEN
    CREATE POLICY "Students read active sessions" ON public.sessions FOR SELECT
      USING (is_active = TRUE AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.class_id = sessions.class_id
      ));
  END IF;
END $$;

-- ── attendance policies ──────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students insert own attendance' AND tablename = 'attendance') THEN
    CREATE POLICY "Students insert own attendance" ON public.attendance FOR INSERT
      WITH CHECK (student_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students read own attendance' AND tablename = 'attendance') THEN
    CREATE POLICY "Students read own attendance" ON public.attendance FOR SELECT
      USING (student_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lecturers read session attendance' AND tablename = 'attendance') THEN
    CREATE POLICY "Lecturers read session attendance" ON public.attendance FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = attendance.session_id
          AND (s.lecturer_id = auth.uid() OR s.instructor_id = auth.uid())
      ));
  END IF;
END $$;

-- ── Realtime ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
END $$;

-- ── Storage: face-photos bucket ──────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-photos', 'face-photos', false)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users upload own face photo' AND tablename = 'objects') THEN
    CREATE POLICY "Users upload own face photo" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'face-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own face photo' AND tablename = 'objects') THEN
    CREATE POLICY "Users read own face photo" ON storage.objects FOR SELECT
      USING (bucket_id = 'face-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Lecturers read student face photos' AND tablename = 'objects') THEN
    CREATE POLICY "Lecturers read student face photos" ON storage.objects FOR SELECT
      USING (bucket_id = 'face-photos');
  END IF;
END $$;
