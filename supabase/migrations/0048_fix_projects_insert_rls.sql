-- 0048: Fix projects RLS — separate INSERT from SELECT/UPDATE/DELETE
-- The FOR ALL policy used an EXISTS(project_members) check that fails for
-- INSERT because no project_members row exists for a brand-new project.
-- Split into: INSERT (staff only, no membership check) and
-- SELECT/UPDATE/DELETE (admin OR internal with membership).

-- Drop the old combined policy
DROP POLICY IF EXISTS "projects: internal all" ON public.projects;

-- SELECT: admin sees all, internal sees assigned projects
CREATE POLICY "projects: select" ON public.projects
  FOR SELECT USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  );

-- INSERT: any staff user can create a project
CREATE POLICY "projects: insert" ON public.projects
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('admin', 'internal')
  );

-- UPDATE: same visibility as SELECT
CREATE POLICY "projects: update" ON public.projects
  FOR UPDATE USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  );

-- DELETE: same visibility as SELECT
CREATE POLICY "projects: delete" ON public.projects
  FOR DELETE USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  );
