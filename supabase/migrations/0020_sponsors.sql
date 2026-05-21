-- 0020_sponsors
-- Links client users to projects. Replaces profiles.client_org for access control.

CREATE TABLE public.sponsors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(project_id, user_id)
);

CREATE INDEX sponsors_project_idx ON public.sponsors(project_id);
CREATE INDEX sponsors_user_idx ON public.sponsors(user_id);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sponsors: internal all" ON public.sponsors
  FOR ALL USING (get_my_role() = 'internal');

CREATE POLICY "sponsors: client sees own" ON public.sponsors
  FOR SELECT USING (user_id = auth.uid());

-- projects client policy (deferred from 0019 — needs sponsors table to exist)
CREATE POLICY "projects: client sees sponsored" ON public.projects
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.sponsors
      WHERE sponsors.project_id = projects.id
      AND sponsors.user_id = auth.uid()
    )
  );
