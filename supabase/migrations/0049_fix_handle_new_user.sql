-- 0049: Fix handle_new_user trigger to copy client_org and avatar_url, and backfill existing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := COALESCE(
    (new.raw_user_meta_data->>'role')::public.user_role,
    (new.raw_app_meta_data->>'role')::public.user_role,
    'internal'
  );

  INSERT INTO public.profiles (id, full_name, role, client_org, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    new.raw_user_meta_data->>'client_org',
    new.raw_user_meta_data->>'avatar_url'
  );

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', v_role::text)
  WHERE id = new.id;

  RETURN new;
END;
$$;

-- Backfill existing profiles with client_org and avatar_url from auth.users if available
UPDATE public.profiles p
SET client_org = u.raw_user_meta_data->>'client_org',
    avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
FROM auth.users u
WHERE p.id = u.id
  AND (u.raw_user_meta_data->>'client_org' IS NOT NULL OR u.raw_user_meta_data->>'avatar_url' IS NOT NULL);
