-- Migration 005 — Row Level Security Policies
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- profiles
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

-- classes
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
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.class_id = classes.id
      ));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students read open enrollment classes' AND tablename = 'classes') THEN
    CREATE POLICY "Students read open enrollment classes" ON public.classes FOR SELECT
      USING (enrollment_open = TRUE);
  END IF;
END $$;

-- sessions
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
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.class_id = sessions.class_id
      ));
  END IF;
END $$;

-- attendance
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
