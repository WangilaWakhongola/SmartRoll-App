-- ============================================================
-- Migration 008 — Auto-create profile on signup
-- SECURITY DEFINER means this runs as the DB owner, bypassing RLS.
-- This ensures a profile row always exists after signup regardless
-- of whether email confirmation is on or off.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    student_id,
    staff_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.raw_user_meta_data->>'student_id',
    NEW.raw_user_meta_data->>'staff_id'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = CASE WHEN EXCLUDED.full_name  <> '' THEN EXCLUDED.full_name  ELSE profiles.full_name  END,
    role       = CASE WHEN EXCLUDED.role       <> '' THEN EXCLUDED.role       ELSE profiles.role       END,
    student_id = COALESCE(EXCLUDED.student_id, profiles.student_id),
    staff_id   = COALESCE(EXCLUDED.staff_id,   profiles.staff_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to ensure it's up to date
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
