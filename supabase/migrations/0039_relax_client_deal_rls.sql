-- 0039_relax_client_deal_rls
-- Remove score requirement from client RLS policies. Clients now see all
-- non-archived deals from sponsored projects, regardless of score.
-- The score field remains for internal filtering/sorting.

-- ── deals ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals: client read good" ON public.deals;
CREATE POLICY "deals: client read good" ON public.deals
  FOR SELECT USING (
    get_my_role() = 'client'
    AND is_archived = false
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
    )
  );
