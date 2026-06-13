-- 0050: Custom invitation system
-- Replaces supabase.auth.admin.inviteUserByEmail() with a branded invitation flow.
-- Admin creates an invite (email, role, optional project assignments, expiry).
-- Invitee receives a branded email and sets up their account (name + password).
-- Expired or used links show appropriate status pages.

-- 1. Invitation status enum
DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  role         public.user_role NOT NULL,
  token        text NOT NULL UNIQUE,
  status       public.invitation_status NOT NULL DEFAULT 'pending',
  project_ids  uuid[] DEFAULT '{}',
  invited_by   uuid NOT NULL REFERENCES auth.users(id),
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  accepted_by  uuid REFERENCES auth.users(id),
  message      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations(email);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON public.invitations(status);

-- 4. RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Staff (internal + admin) can manage all invitations
CREATE POLICY "invitations: staff all" ON public.invitations
  FOR ALL USING (public.is_staff());

-- No public SELECT policy — public token validation uses admin client server-side
-- to avoid leaking invitation data through accidental anonymous queries.

-- 5. Updated_at trigger
DROP TRIGGER IF EXISTS trg_invitations_updated_at ON public.invitations;
CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
