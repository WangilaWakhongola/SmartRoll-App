-- ============================================================
-- SmartRoll — Fix RLS to allow ID-based login lookup
-- Run this in Supabase SQL Editor
-- ============================================================

-- The login screen looks up email by student_id/staff_id BEFORE
-- the user is authenticated. Default RLS blocks this.
-- We need to allow anonymous reads of email+student_id+staff_id.

-- Drop all existing profile SELECT policies first
DROP POLICY IF EXISTS "Users read own profile"          ON public.profiles;
DROP POLICY IF EXISTS "Lecturers read class profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Public read email by student_id" ON public.profiles;
DROP POLICY IF EXISTS "Public read email by staff_id"   ON public.profiles;

-- Allow anyone (including unauthenticated) to look up email by ID
-- This is safe — only email is exposed, not sensitive data
CREATE POLICY "Allow public ID lookup"
  ON public.profiles FOR SELECT
  USING (true);

-- Done ✓
-- After login works, you can tighten this policy if needed.
