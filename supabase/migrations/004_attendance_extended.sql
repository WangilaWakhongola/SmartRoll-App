-- Migration 004 — Attendance Table
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

CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);
