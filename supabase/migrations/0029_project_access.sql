-- Migration 0029: Track user project access for relevance ranking
-- Powers the sidebar "Switch Project" section to show recent projects only

CREATE TABLE IF NOT EXISTS public.project_access (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

CREATE INDEX IF NOT EXISTS project_access_user_id_idx ON public.project_access(user_id);

ALTER TABLE public.project_access ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users manage own project access'
      AND tablename = 'project_access'
  ) THEN
    CREATE POLICY "Users manage own project access" ON public.project_access
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Returns projects sorted by recency for a given user, falling back to created_at
-- SECURITY INVOKER so RLS on projects and project_access still applies
CREATE OR REPLACE FUNCTION get_recent_projects(p_limit int DEFAULT 4)
RETURNS SETOF projects
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT p.*
  FROM projects p
  LEFT JOIN project_access pa ON pa.project_id = p.id AND pa.user_id = auth.uid()
  ORDER BY pa.accessed_at DESC NULLS LAST, p.created_at DESC
  LIMIT p_limit;
$$;
