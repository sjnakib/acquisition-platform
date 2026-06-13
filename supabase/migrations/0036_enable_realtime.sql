-- Migration 0036: Enable realtime replication for email-related tables
-- Allows the frontend to listen for real-time changes to emails, snoozes, and Gmail webhook updates.

-- Enable replication for email_outreach
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'email_outreach'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_outreach;
  END IF;
END $$;

-- Enable replication for snoozed_threads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'snoozed_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.snoozed_threads;
  END IF;
END $$;

-- Enable replication for google_connections (captures incoming email webhook updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'google_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_connections;
  END IF;
END $$;
