-- Migration 003 — Sessions Table
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

CREATE INDEX IF NOT EXISTS idx_sessions_class_id    ON public.sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_lecturer_id ON public.sessions(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active   ON public.sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_status      ON public.sessions(status);

CREATE OR REPLACE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
