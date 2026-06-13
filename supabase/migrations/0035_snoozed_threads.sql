-- Migration 0035: Track snoozed email threads
-- Scoped to projects and deals with RLS enforcement for internal users

CREATE TABLE IF NOT EXISTS public.snoozed_threads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  deal_id       uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  thread_id     text NOT NULL,
  snoozed_until timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, thread_id)
);

-- Index for lookup and deal filtering
CREATE INDEX IF NOT EXISTS snoozed_threads_lookup_idx ON public.snoozed_threads(snoozed_until);
CREATE INDEX IF NOT EXISTS snoozed_threads_deal_idx ON public.snoozed_threads(deal_id);

-- Enable RLS
ALTER TABLE public.snoozed_threads ENABLE ROW LEVEL SECURITY;

-- Create policy for internal users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'snoozed_threads: internal all'
      AND tablename = 'snoozed_threads'
  ) THEN
    CREATE POLICY "snoozed_threads: internal all" ON public.snoozed_threads
      FOR ALL USING (public.get_my_role() = 'internal');
  END IF;
END $$;
