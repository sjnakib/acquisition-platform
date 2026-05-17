-- Internal test user: test-internal@example.com / Password123!
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'test-internal@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(),
  '{"role": "internal"}',
  '{"full_name": "Internal Tester", "role": "internal"}'
);

-- Client test user: test-client@example.com / Password123!
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'test-client@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(),
  '{"role": "client"}',
  '{"full_name": "CEO Client", "role": "client"}'
);

-- Seed portfolio
insert into public.portfolios (id, name, description)
values (
  'pppppppp-0000-0000-0000-000000000001',
  'NJ Core Portfolio',
  'Primary multifamily assets in northern NJ'
);

-- Seed campaign
insert into public.campaigns (id, name, market, listing_type, email_template,
  email_subject_template, is_active)
values (
  'cccccccc-0000-0000-0000-000000000001',
  'NJ Multifamily Q1 2026',
  'NJ',
  'off_market',
  'outreach',
  'Acquisition Inquiry -- {{property_address}}',
  true
);

-- Seed 3 sample deals (v2 schema: system fields only)
insert into public.deals (id, campaign_id, portfolio_id, deal_name,
  outreach_emails, unit_count, stage, score, created_by)
values
  ('dddddddd-0001-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'pppppppp-0000-0000-0000-000000000001',
   'Oak Park Apartments',
   '{owner@oakparkapts.com}',
   48, 'underwriting', 'good',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0002-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'pppppppp-0000-0000-0000-000000000001',
   'Riverside Heights',
   '{contact@riversideheights.com}',
   72, 'response', 'very_good',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0003-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   null,
   'Maple Court',
   '{maplecourt@gmail.com}',
   24, 'lead', null,
   'aaaaaaaa-0000-0000-0000-000000000001');

-- Seed dynamic field definitions
insert into public.field_definitions (id, key, label, data_type, sort_order, show_in_grid)
values
  ('fdef0000-0000-0000-0000-000000000001', 'address',       'Address',             'text',     10, true),
  ('fdef0000-0000-0000-0000-000000000002', 'city',          'City',                'text',     20, true),
  ('fdef0000-0000-0000-0000-000000000003', 'state',         'State',               'text',     30, true),
  ('fdef0000-0000-0000-0000-000000000004', 'zip',           'Zip Code',            'text',     40, true),
  ('fdef0000-0000-0000-0000-000000000005', 'property_type', 'Property Type',       'text',     50, false),
  ('fdef0000-0000-0000-0000-000000000006', 'building_class','Building Class',      'text',     60, false),
  ('fdef0000-0000-0000-0000-000000000007', 'year_built',    'Year Built',          'integer',  70, false),
  ('fdef0000-0000-0000-0000-000000000008', 'property_link', 'Property Link',       'url',      80, false);

-- Seed dynamic field values for each deal
insert into public.deal_fields (deal_id, field_id, value) values
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000001', '123 Oak St'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000002', 'Newark'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000003', 'NJ'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000004', '07102'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000005', 'multifamily'),
  ('dddddddd-0001-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000006', 'B'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000001', '456 River Rd'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000002', 'Jersey City'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000003', 'NJ'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000004', '07305'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000005', 'multifamily'),
  ('dddddddd-0002-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000006', 'A'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000001', '789 Maple Ave'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000002', 'Trenton'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000003', 'NJ'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000004', '08608'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000005', 'multifamily'),
  ('dddddddd-0003-0000-0000-000000000001', 'fdef0000-0000-0000-0000-000000000006', 'C');

-- Seed default document checklists for each deal
select public.seed_default_checklist('dddddddd-0001-0000-0000-000000000001');
select public.seed_default_checklist('dddddddd-0002-0000-0000-000000000001');
select public.seed_default_checklist('dddddddd-0003-0000-0000-000000000001');

-- Seed underwriting for Oak Park
insert into public.underwriting (deal_id, asking_price, price_per_unit, underwritability_status)
values ('dddddddd-0001-0000-0000-000000000001', 4800000, 100000, 'maybe');

-- Seed contacts
insert into public.contacts (deal_id, name, company, title, email, is_primary)
values
  ('dddddddd-0001-0000-0000-000000000001', 'John Smith', 'Oak Park LLC', 'Owner', '{owner@oakparkapts.com}', true),
  ('dddddddd-0002-0000-0000-000000000001', 'Jane Doe', 'Riverside Holdings', 'Asset Manager', '{contact@riversideheights.com}', true);

-- Seed a call brief for Riverside
insert into public.call_briefs (deal_id, summary_text, published, call_status, published_at)
values
  ('dddddddd-0002-0000-0000-000000000001', 'Strong financials, owner motivated. Recommend moving to underwriting.', true, 'completed', now());
