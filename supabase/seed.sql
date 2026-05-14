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

-- Seed 3 sample deals
insert into public.deals (id, campaign_id, deal_name, address, city, state, zip,
  unit_count, building_class, stage, score, property_type, source, created_by)
values
  ('dddddddd-0001-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'Oak Park Apartments', '123 Oak St', 'Newark', 'NJ', '07102',
   48, 'B', 'underwriting', 'good', 'multifamily', 'indirect',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0002-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'Riverside Heights', '456 River Rd', 'Jersey City', 'NJ', '07305',
   72, 'A', 'call_scheduled', 'very_good', 'multifamily', 'indirect',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0003-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'Maple Court', '789 Maple Ave', 'Trenton', 'NJ', '08608',
   24, 'C', 'lead', null, 'multifamily', 'indirect',
   'aaaaaaaa-0000-0000-0000-000000000001');
