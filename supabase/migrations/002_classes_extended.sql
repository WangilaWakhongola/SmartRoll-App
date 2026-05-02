-- Migration 002 — Classes Table
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

CREATE INDEX IF NOT EXISTS idx_classes_lecturer_id   ON public.classes(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id ON public.classes(instructor_id);

CREATE OR REPLACE TRIGGER classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
