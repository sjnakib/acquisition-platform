-- 0054: Batch auth.users email lookup function
-- Allows looking up emails for multiple user IDs in a single indexed query.
-- Returns table of id and email matching the input array.

CREATE OR REPLACE FUNCTION public.get_user_emails(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, user_email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id, email FROM auth.users WHERE id = ANY(p_user_ids);
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO service_role;
