-- 0038_fix_client_field_defs
-- 1. Fix field_definitions RLS: allow clients to read global field definitions
--    (project_id IS NULL), e.g. address, deal_name, unit_count created by
--    migrations 0024/0034. Without this, PostgREST nested joins can silently
--    drop deal_fields rows that reference global definitions.
-- 2. Add debug_client_access() helper for verifying RLS state.

-- ── Fix field_definitions RLS ────────────────────────────────────────

DROP POLICY IF EXISTS "field_definitions: read sponsored" ON public.field_definitions;
CREATE POLICY "field_definitions: read sponsored" ON public.field_definitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      get_my_role() = 'internal'
      OR field_definitions.project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.sponsors
        WHERE sponsors.project_id = field_definitions.project_id
        AND sponsors.user_id = auth.uid()
      )
    )
  );

-- ── Diagnostic helper ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.debug_client_access()
RETURNS TABLE(role text, sponsored_project_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    get_my_role()::text,
    array_agg(project_id)
  FROM public.sponsors
  WHERE user_id = auth.uid()
$$;
