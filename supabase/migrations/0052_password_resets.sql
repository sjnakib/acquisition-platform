-- 0052: Password reset system
-- Supports self-service password reset via branded email links.
-- Users request a reset → token generated → email sent via system Gmail →
-- user clicks link → sets new password.
-- All access via admin client server-side (no public RLS policies).

-- 1. Password resets table
CREATE TABLE IF NOT EXISTS public.password_resets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  token        text NOT NULL UNIQUE,
  used         boolean NOT NULL DEFAULT false,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS password_resets_token_idx ON public.password_resets(token);
CREATE INDEX IF NOT EXISTS password_resets_email_idx ON public.password_resets(email);

-- 3. RLS — all operations use admin client server-side (service role).
--    No user-facing RLS policies needed; the service role bypasses RLS.
--    We enable RLS to prevent accidental anonymous access via PostgREST,
--    but provide a catch-all policy for the service_role so PostgREST
--    does not reject queries on a table with RLS enabled and zero policies.
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "password_resets: service_role full access"
    ON public.password_resets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
