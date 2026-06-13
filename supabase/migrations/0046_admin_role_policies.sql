-- 0046: Admin role RLS policies + project membership
-- Depends on 0045 (admin enum value must exist).
-- Updates all RLS policies to treat admin like internal via is_staff(),
-- and adds project_members table to scope internal users to projects.

-- 1. Helper: is_staff() — true for internal OR admin ----------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.get_my_role() IN ('internal', 'admin');
$$;

-- 3. Update all RLS policies that previously checked = 'internal' ---------
-- Each policy: drop if exists, recreate using is_staff()

-- ── profiles ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: internal sees all" ON public.profiles;
CREATE POLICY "profiles: internal sees all" ON public.profiles
  FOR SELECT USING (public.is_staff());

-- ── campaigns ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "campaigns: internal all" ON public.campaigns;
CREATE POLICY "campaigns: internal all" ON public.campaigns
  FOR ALL USING (public.is_staff());

-- ── deals ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals: internal all" ON public.deals;
CREATE POLICY "deals: internal all" ON public.deals
  FOR ALL USING (public.is_staff());

-- ── contacts ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contacts: internal all" ON public.contacts;
CREATE POLICY "contacts: internal all" ON public.contacts
  FOR ALL USING (public.is_staff());

-- ── email_outreach ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "email_outreach: internal all" ON public.email_outreach;
CREATE POLICY "email_outreach: internal all" ON public.email_outreach
  FOR ALL USING (public.is_staff());

-- ── document_checklist ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "document_checklist: internal all" ON public.document_checklist;
CREATE POLICY "document_checklist: internal all" ON public.document_checklist
  FOR ALL USING (public.is_staff());

-- ── ca_credentials ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ca_credentials: internal all" ON public.ca_credentials;
CREATE POLICY "ca_credentials: internal all" ON public.ca_credentials
  FOR ALL USING (public.is_staff());

-- ── underwriting ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "underwriting: internal all" ON public.underwriting;
CREATE POLICY "underwriting: internal all" ON public.underwriting
  FOR ALL USING (public.is_staff());

-- ── call_briefs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "call_briefs: internal all" ON public.call_briefs;
CREATE POLICY "call_briefs: internal all" ON public.call_briefs
  FOR ALL USING (public.is_staff());

-- ── loi_records ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "loi_records: internal all" ON public.loi_records;
CREATE POLICY "loi_records: internal all" ON public.loi_records
  FOR ALL USING (public.is_staff());

-- ── loi_rounds ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "loi_rounds: internal all" ON public.loi_rounds;
CREATE POLICY "loi_rounds: internal all" ON public.loi_rounds
  FOR ALL USING (public.is_staff());

-- ── import_jobs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "import_jobs: internal all" ON public.import_jobs;
CREATE POLICY "import_jobs: internal all" ON public.import_jobs
  FOR ALL USING (public.is_staff());

-- ── portfolios ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "portfolios: internal all" ON public.portfolios;
CREATE POLICY "portfolios: internal all" ON public.portfolios
  FOR ALL USING (public.is_staff());

-- ── field_definitions: internal write ────────────────────────────────────
DROP POLICY IF EXISTS "field_definitions: internal write" ON public.field_definitions;
CREATE POLICY "field_definitions: internal write" ON public.field_definitions
  FOR ALL USING (public.is_staff());

-- ── field_definitions: read sponsored ────────────────────────────────────
DROP POLICY IF EXISTS "field_definitions: read sponsored" ON public.field_definitions;
CREATE POLICY "field_definitions: read sponsored" ON public.field_definitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_staff()
      OR field_definitions.project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.sponsors
        WHERE sponsors.project_id = field_definitions.project_id
        AND sponsors.user_id = auth.uid()
      )
    )
  );

-- ── deal_fields ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_fields: internal all" ON public.deal_fields;
CREATE POLICY "deal_fields: internal all" ON public.deal_fields
  FOR ALL USING (public.is_staff());

-- ── activity_log: table dropped in 0042, skip ────────────────────────────

-- ── deal_ca ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_ca: internal all" ON public.deal_ca;
CREATE POLICY "deal_ca: internal all" ON public.deal_ca
  FOR ALL USING (public.is_staff());

-- ── sponsors ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sponsors: internal all" ON public.sponsors;
CREATE POLICY "sponsors: internal all" ON public.sponsors
  FOR ALL USING (public.is_staff());

-- ── google_connections ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "google_connections: internal all" ON public.google_connections;
CREATE POLICY "google_connections: internal all" ON public.google_connections
  FOR ALL USING (public.is_staff());

-- ── email_templates ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "email_templates: internal all" ON public.email_templates;
CREATE POLICY "email_templates: internal all" ON public.email_templates
  FOR ALL USING (public.is_staff());

-- ── email_attachments ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "email_attachments: internal all" ON public.email_attachments;
CREATE POLICY "email_attachments: internal all" ON public.email_attachments
  FOR ALL USING (public.is_staff());

-- ── snoozed_threads ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "snoozed_threads: internal all" ON public.snoozed_threads;
CREATE POLICY "snoozed_threads: internal all" ON public.snoozed_threads
  FOR ALL USING (public.is_staff());

-- 4. Create project_members table (must exist before projects policy) ------
CREATE TABLE public.project_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(project_id, user_id)
);

CREATE INDEX project_members_project_idx ON public.project_members(project_id);
CREATE INDEX project_members_user_idx ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members: staff all" ON public.project_members
  FOR ALL USING (public.is_staff());

CREATE POLICY "project_members: internal sees own" ON public.project_members
  FOR SELECT USING (
    public.get_my_role() = 'internal'
    AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- 5. Update projects policy (project_members table now exists) -------------
DROP POLICY IF EXISTS "projects: internal all" ON public.projects;
CREATE POLICY "projects: internal all" ON public.projects
  FOR ALL USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  );

-- 6. Update get_pipeline_summary() to use is_staff() ----------------------
DROP FUNCTION IF EXISTS public.get_pipeline_summary();

CREATE OR REPLACE FUNCTION public.get_pipeline_summary()
RETURNS TABLE (
  campaign_name        text,
  market               text,
  leads                bigint,
  emails_sent          bigint,
  responses_positive   bigint,
  underwritten         bigint,
  scored_good          bigint,
  loi_count            bigint,
  closed_count         bigint,
  failed_count         bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    c.name,
    c.market,
    count(*) FILTER (WHERE d.stage = 'lead'),
    count(*) FILTER (WHERE e.status = 'sent'),
    count(*) FILTER (WHERE e.response_classification IN ('positive','neutral')),
    count(*) FILTER (WHERE d.stage IN ('underwriting','loi','closed','failed')),
    count(*) FILTER (WHERE d.score IN ('good','very_good')),
    count(*) FILTER (WHERE d.stage IN ('loi','closed')),
    count(*) FILTER (WHERE d.stage = 'closed'),
    count(*) FILTER (WHERE d.stage = 'failed')
  FROM public.deals d
  JOIN public.campaigns c ON c.id = d.campaign_id
  LEFT JOIN public.email_outreach e ON e.deal_id = d.id
  WHERE public.is_staff()
  GROUP BY c.id, c.name, c.market
$$;

-- 8. Backfill: assign existing internal users to all existing projects ----
DO $$
DECLARE
  v_internal_id uuid;
BEGIN
  FOR v_internal_id IN
    SELECT p.id FROM public.profiles p
    WHERE p.role = 'internal'
  LOOP
    INSERT INTO public.project_members (project_id, user_id)
    SELECT pr.id, v_internal_id
    FROM public.projects pr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = pr.id AND pm.user_id = v_internal_id
    );
  END LOOP;
END $$;

-- 9. Update handle_new_user() to support admin role -----------------------
-- Recreate the trigger function (idempotent — same logic, just recognizes
-- the new 'admin' enum value).
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

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    v_role
  );

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', v_role::text)
  WHERE id = new.id;

  RETURN new;
END;
$$;

-- 10. Update debug_client_access() to show role info -----------------------
DROP FUNCTION IF EXISTS public.debug_client_access();
CREATE FUNCTION public.debug_client_access()
RETURNS TABLE(role text, is_staff boolean, sponsored_project_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    get_my_role()::text,
    public.is_staff(),
    array_agg(project_id)
  FROM public.sponsors
  WHERE user_id = auth.uid()
$$;
