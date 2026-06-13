-- ── Users (profiles auto-created by on_auth_user_created trigger) ──

-- Internal test user: test-internal@example.com / Password123!
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'test-internal@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(),
  '{"role": "internal"}',
  '{"full_name": "Internal Tester", "role": "internal"}'
);

-- Client test user 1: test-client@example.com / Password123!
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'test-client@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(),
  '{"role": "client"}',
  '{"full_name": "CEO Client One", "role": "client"}'
);

-- Client test user 2: test-client2@example.com / Password123!
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'test-client2@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(),
  '{"role": "client"}',
  '{"full_name": "CEO Client Two", "role": "client"}'
);

-- ── Projects ────────────────────────────────────────────────────────

INSERT INTO public.projects (id, name, description, created_by)
VALUES
  ('proj00000-0000-0000-0000-000000000001',
   'Heritage Multifamily Fund I',
   'Core multifamily acquisitions in the NJ / PA corridor. Targeting 50–150 unit properties.',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('proj00000-0000-0000-0000-000000000002',
   'Coastal Retail Portfolio',
   'Retail and mixed-use properties along the Jersey Shore. Value-add strategy.',
   'aaaaaaaa-0000-0000-0000-000000000001');

-- ── Sponsors ────────────────────────────────────────────────────────

INSERT INTO public.sponsors (id, project_id, user_id)
VALUES
  ('spon00000-0000-0000-0000-000000000001',
   'proj00000-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002'),
  ('spon00000-0000-0000-0000-000000000002',
   'proj00000-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000003');

-- ── Field definitions (per project) ─────────────────────────────────

-- Project 1: Heritage Multifamily Fund I
INSERT INTO public.field_definitions (id, key, label, data_type, sort_order, show_in_grid, project_id)
VALUES
  ('fdef0000-0000-0000-0000-000000000001', 'address',       'Address',             'text',     10, true, 'proj00000-0000-0000-0000-000000000001'),
  ('fdef0000-0000-0000-0000-000000000002', 'city',          'City',                'text',     20, false, 'proj00000-0000-0000-0000-000000000001'),
  ('fdef0000-0000-0000-0000-000000000003', 'state',         'State',               'text',     30, false, 'proj00000-0000-0000-0000-000000000001'),
  ('fdef0000-0000-0000-0000-000000000004', 'zip',           'Zip Code',            'text',     40, false, 'proj00000-0000-0000-0000-000000000001'),
  ('fdef0000-0000-0000-0000-000000000005', 'property_type', 'Property Type',       'text',     50, false, 'proj00000-0000-0000-0000-000000000001'),
  ('fdef0000-0000-0000-0000-000000000006', 'building_class','Building Class',      'text',     60, false, 'proj00000-0000-0000-0000-000000000001'),
  ('fdef0000-0000-0000-0000-000000000007', 'year_built',    'Year Built',          'integer',  70, false, 'proj00000-0000-0000-0000-000000000001'),
  ('fdef0000-0000-0000-0000-000000000008', 'property_link', 'Property Link',       'url',      80, false, 'proj00000-0000-0000-0000-000000000001'),
  ('fdef0000-0000-0000-0000-000000000010', 'unit_count',    'Units',               'integer',   5, false, 'proj00000-0000-0000-0000-000000000001');

-- Project 2: Coastal Retail Portfolio
INSERT INTO public.field_definitions (id, key, label, data_type, sort_order, show_in_grid, project_id)
VALUES
  ('fdef0000-0000-0000-0000-000000000011', 'address',       'Address',             'text',     10, true, 'proj00000-0000-0000-0000-000000000002'),
  ('fdef0000-0000-0000-0000-000000000012', 'city',          'City',                'text',     20, false, 'proj00000-0000-0000-0000-000000000002'),
  ('fdef0000-0000-0000-0000-000000000013', 'state',         'State',               'text',     30, false, 'proj00000-0000-0000-0000-000000000002'),
  ('fdef0000-0000-0000-0000-000000000014', 'zip',           'Zip Code',            'text',     40, false, 'proj00000-0000-0000-0000-000000000002'),
  ('fdef0000-0000-0000-0000-000000000015', 'property_type', 'Property Type',       'text',     50, false, 'proj00000-0000-0000-0000-000000000002'),
  ('fdef0000-0000-0000-0000-000000000016', 'building_class','Building Class',      'text',     60, false, 'proj00000-0000-0000-0000-000000000002'),
  ('fdef0000-0000-0000-0000-000000000017', 'year_built',    'Year Built',          'integer',  70, false, 'proj00000-0000-0000-0000-000000000002'),
  ('fdef0000-0000-0000-0000-000000000018', 'property_link', 'Property Link',       'url',      80, false, 'proj00000-0000-0000-0000-000000000002'),
  ('fdef0000-0000-0000-0000-000000000020', 'unit_count',    'Units',               'integer',   5, false, 'proj00000-0000-0000-0000-000000000002');

-- ── Campaigns ───────────────────────────────────────────────────────

INSERT INTO public.campaigns (id, project_id, name, market, listing_type, email_template,
  email_subject_template, is_active)
VALUES
  ('cccccccc-0000-0000-0000-000000000001',
   'proj00000-0000-0000-0000-000000000001',
   'NJ Multifamily Q1 2026', 'NJ', 'off_market', 'outreach',
   'Acquisition Inquiry -- {{property_address}}', true),
  ('cccccccc-0000-0000-0000-000000000002',
   'proj00000-0000-0000-0000-000000000002',
   'Shore Retail Q1 2026', 'NJ Shore', 'on_market', 'outreach',
   'Acquisition Interest -- {{property_address}}', true);

-- ── Portfolios ──────────────────────────────────────────────────────

INSERT INTO public.portfolios (id, project_id, name, description)
VALUES
  ('pppppppp-0000-0000-0000-000000000001',
   'proj00000-0000-0000-0000-000000000001',
   'NJ Core Portfolio',
   'Primary multifamily assets in northern NJ'),
  ('pppppppp-0000-0000-0000-000000000002',
   'proj00000-0000-0000-0000-000000000002',
   'Shore Value-Add',
   'Retail/mixed-use properties along the Jersey Shore');

-- ── Deals ───────────────────────────────────────────────────────────

-- Project 1 deals
INSERT INTO public.deals (id, project_id, campaign_id, portfolio_id,
  outreach_emails, stage, score, created_by)
VALUES
  ('dddddddd-0001-0000-0000-000000000001',
   'proj00000-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'pppppppp-0000-0000-0000-000000000001',
   '{owner@oakparkapts.com}',
   'underwriting', 'good',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0002-0000-0000-000000000001',
   'proj00000-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'pppppppp-0000-0000-0000-000000000001',
   '{contact@riversideheights.com}',
   'response', 'very_good',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0003-0000-0000-000000000001',
   'proj00000-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   null,
   '{maplecourt@gmail.com}',
   'lead', null,
   'aaaaaaaa-0000-0000-0000-000000000001');

-- Project 2 deals
INSERT INTO public.deals (id, project_id, campaign_id, portfolio_id,
  outreach_emails, stage, score, created_by)
VALUES
  ('dddddddd-0004-0000-0000-000000000001',
   'proj00000-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000002',
   'pppppppp-0000-0000-0000-000000000002',
   '{owner@boardwalkplaza.com}',
   'lead', null,
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0005-0000-0000-000000000001',
   'proj00000-0000-0000-0000-000000000002',
   'cccccccc-0000-0000-0000-000000000002',
   'pppppppp-0000-0000-0000-000000000002',
   '{contact@harborsq.com}',
   'outreach', 'good',
   'aaaaaaaa-0000-0000-0000-000000000001');

-- ── Deal fields (Project 1) ─────────────────────────────────────────

INSERT INTO public.deal_fields (deal_id, field_id, value) VALUES
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000001', '123 Oak St'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000002', 'Newark'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000003', 'NJ'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000004', '07102'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000005', 'multifamily'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000006', 'B'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000010', '48'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000001', '456 River Rd'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000002', 'Jersey City'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000003', 'NJ'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000004', '07305'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000005', 'multifamily'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000006', 'A'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000010', '72'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000001', '789 Maple Ave'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000002', 'Trenton'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000003', 'NJ'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000004', '08608'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000005', 'multifamily'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000006', 'C'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000010', '24');

-- ── Deal fields (Project 2) ─────────────────────────────────────────

INSERT INTO public.deal_fields (deal_id, field_id, value) VALUES
  ('dddddddd-0004-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000011', '100 Boardwalk'),
  ('dddddddd-0004-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000012', 'Atlantic City'),
  ('dddddddd-0004-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000013', 'NJ'),
  ('dddddddd-0004-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000014', '08401'),
  ('dddddddd-0004-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000015', 'retail'),
  ('dddddddd-0004-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000020', '12'),
  ('dddddddd-0005-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000011', '50 Harbor Blvd'),
  ('dddddddd-0005-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000012', 'Long Branch'),
  ('dddddddd-0005-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000013', 'NJ'),
  ('dddddddd-0005-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000014', '07740'),
  ('dddddddd-0005-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000015', 'mixed_use'),
  ('dddddddd-0005-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000020', '8');

-- ── Document checklists ─────────────────────────────────────────────

SELECT public.seed_default_checklist('dddddddd-0001-0000-0000-000000000001');
SELECT public.seed_default_checklist('dddddddd-0002-0000-0000-000000000001');
SELECT public.seed_default_checklist('dddddddd-0003-0000-0000-000000000001');
SELECT public.seed_default_checklist('dddddddd-0004-0000-0000-000000000001');
SELECT public.seed_default_checklist('dddddddd-0005-0000-0000-000000000001');

-- ── Underwriting ────────────────────────────────────────────────────

INSERT INTO public.underwriting (deal_id, asking_price, price_per_unit, underwritability_status)
VALUES ('dddddddd-0001-0000-0000-000000000001', 4800000, 100000, 'maybe');

-- ── Contacts ────────────────────────────────────────────────────────

INSERT INTO public.contacts (deal_id, name, company, title, email, is_primary)
VALUES
  ('dddddddd-0001-0000-0000-000000000001', 'John Smith', 'Oak Park LLC', 'Owner', '{owner@oakparkapts.com}', true),
  ('dddddddd-0002-0000-0000-000000000001', 'Jane Doe', 'Riverside Holdings', 'Asset Manager', '{contact@riversideheights.com}', true),
  ('dddddddd-0004-0000-0000-000000000001', 'Mike Boardwalk', 'Boardwalk Properties', 'Owner', '{owner@boardwalkplaza.com}', true);

-- ── Call briefs ─────────────────────────────────────────────────────

INSERT INTO public.call_briefs (deal_id, summary_text, published, call_status, published_at)
VALUES
  ('dddddddd-0002-0000-0000-000000000001', 'Strong financials, owner motivated. Recommend moving to underwriting.', true, 'completed', now()),
  ('dddddddd-0005-0000-0000-000000000001', 'Initial outreach positive. Owner open to offers. Schedule follow-up call.', true, 'completed', now());
