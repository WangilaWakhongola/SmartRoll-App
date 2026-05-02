-- ============================================================
-- SmartRoll — Fix Login SQL
-- Run this in Supabase SQL Editor to unblock signup & login.
-- ============================================================

-- 1. Ensure profiles table has all required columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_id       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_id       UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS face_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token     TEXT;

-- 2. Ensure classes table exists (needed for FK)
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

-- 3. Add FK from profiles.class_id → classes.id (safe)
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

-- 4. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes  ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for profiles (drop & recreate to ensure correct)
DROP POLICY IF EXISTS "Users read own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Users read own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Auto-create profile trigger (SECURITY DEFINER bypasses RLS)
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

-- Done ✓
