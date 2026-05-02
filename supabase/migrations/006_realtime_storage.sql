-- Migration 006 — Realtime & Storage
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
