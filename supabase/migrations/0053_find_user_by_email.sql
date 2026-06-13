-- 0053: Direct auth.users email lookup function
-- Replaces client-side listUsers() + .find() pattern which is fragile
-- (pagination, client-side filtering, O(n) over all users).
-- This function performs a single indexed lookup in auth.users.

CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text)
RETURNS TABLE (user_id uuid, user_email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id, email FROM auth.users WHERE email = p_email;
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO service_role;
