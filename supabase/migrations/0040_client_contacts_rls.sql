-- 0040_client_contacts_rls
-- Add client SELECT policy for contacts. Clients can see contacts for deals
-- in their sponsored projects. Required for email thread listing to resolve
-- tracked emails for Gmail search queries.

DROP POLICY IF EXISTS "contacts: client read sponsored" ON public.contacts;
CREATE POLICY "contacts: client read sponsored" ON public.contacts
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = contacts.deal_id
      AND d.is_archived = false
    )
  );
