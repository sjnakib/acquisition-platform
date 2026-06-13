-- 0051: System Gmail connection for transactional emails (invitations, etc.)
-- Extends google_connections with a connection_type column so the same Google
-- account can be used for both project-scoped email (type='project') and
-- system-level transactional email (type='system') as two separate rows.

-- 1. Add connection_type column
ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'project';

-- 2. Replace UNIQUE(google_email) with UNIQUE(google_email, connection_type)
ALTER TABLE public.google_connections
  DROP CONSTRAINT IF EXISTS google_connections_google_email_key;

ALTER TABLE public.google_connections
  ADD CONSTRAINT google_connections_google_email_connection_type_key
  UNIQUE(google_email, connection_type);
