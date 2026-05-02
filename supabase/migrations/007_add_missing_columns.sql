-- ============================================================
-- Migration 007 — Add Missing Columns
-- Safe to run on existing databases (all changes are guarded).
-- ============================================================

-- classes: add missing columns if not present
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS instructor_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS radius_meters    INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS enrollment_open  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS class_id         TEXT,
  ADD COLUMN IF NOT EXISTS building         TEXT;

-- Sync instructor_id from lecturer_id for existing rows
UPDATE public.classes
  SET instructor_id = lecturer_id
  WHERE instructor_id IS NULL AND lecturer_id IS NOT NULL;

-- sessions: add missing columns if not present
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'open';

-- Sync instructor_id from lecturer_id for existing rows
UPDATE public.sessions
  SET instructor_id = lecturer_id
  WHERE instructor_id IS NULL AND lecturer_id IS NOT NULL;

-- attendance: add face match and suspicious flag columns if missing
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS face_match_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS suspicious_flag  BOOLEAN DEFAULT FALSE;

-- profiles: add optional columns if missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token      TEXT,
  ADD COLUMN IF NOT EXISTS face_photo_url  TEXT,
  ADD COLUMN IF NOT EXISTS staff_id        TEXT,
  ADD COLUMN IF NOT EXISTS class_id        UUID;

-- profiles: add FK for class_id if not already present
DO $$ BEGIN
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

-- ── Additional indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id  ON public.classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor_id ON public.sessions(instructor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status        ON public.sessions(status);

-- ── Additional RLS policies (guarded) ───────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Instructors manage own classes via instructor_id' AND tablename = 'classes') THEN
    CREATE POLICY "Instructors manage own classes via instructor_id"
      ON public.classes FOR ALL
      USING (instructor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Instructors manage own sessions via instructor_id' AND tablename = 'sessions') THEN
    CREATE POLICY "Instructors manage own sessions via instructor_id"
      ON public.sessions FOR ALL
      USING (instructor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students read open enrollment classes' AND tablename = 'classes') THEN
    CREATE POLICY "Students read open enrollment classes"
      ON public.classes FOR SELECT
      USING (enrollment_open = TRUE);
  END IF;
END $$;

-- ── Realtime (guarded) ───────────────────────────────────────
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
