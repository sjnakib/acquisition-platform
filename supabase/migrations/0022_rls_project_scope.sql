-- 0022_rls_project_scope
-- Update RLS policies to enforce project membership for client users.
-- Internal users unaffected (continue to see all).

-- ── deals ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals: client read good" ON public.deals;
CREATE POLICY "deals: client read good" ON public.deals
  FOR SELECT USING (
    get_my_role() = 'client'
    AND is_archived = false
    AND score IN ('good', 'very_good')
    AND EXISTS (
      SELECT 1 FROM public.sponsors
      WHERE sponsors.project_id = deals.project_id
      AND sponsors.user_id = auth.uid()
    )
  );

-- ── deal_fields ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_fields: client read good" ON public.deal_fields;
CREATE POLICY "deal_fields: client read good" ON public.deal_fields
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = deal_fields.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
    )
  );

-- ── call_briefs ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "call_briefs: client sees published" ON public.call_briefs;
CREATE POLICY "call_briefs: client sees published" ON public.call_briefs
  FOR SELECT USING (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
    )
  );

DROP POLICY IF EXISTS "call_briefs: client update notes" ON public.call_briefs;
CREATE POLICY "call_briefs: client update notes" ON public.call_briefs
  FOR UPDATE USING (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
    )
  )
  WITH CHECK (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
    )
  );

-- ── field_definitions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "field_definitions: read all" ON public.field_definitions;
CREATE POLICY "field_definitions: read sponsored" ON public.field_definitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      get_my_role() = 'internal'
      OR EXISTS (
        SELECT 1 FROM public.sponsors
        WHERE sponsors.project_id = field_definitions.project_id
        AND sponsors.user_id = auth.uid()
      )
    )
  );
