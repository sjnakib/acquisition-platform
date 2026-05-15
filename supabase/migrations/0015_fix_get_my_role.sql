-- Fix: auth.jwt()->>'role' returns Supabase role ('authenticated'), not custom role.
-- Custom role is stored in app_metadata.role (set by handle_new_user trigger).
create or replace function public.get_my_role()
returns public.user_role language sql stable security definer as $$
  select coalesce(
    (auth.jwt()->'app_metadata'->>'role')::public.user_role,
    (auth.jwt()->'user_metadata'->>'role')::public.user_role,
    'internal'
  )
$$;
