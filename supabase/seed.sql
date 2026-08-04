-- ── Users (profiles auto-created by on_auth_user_created trigger) ──

-- Admin test user: test-admin@example.com / Password123!
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  is_super_admin, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change, phone_change_token,
  email_change_token_current, phone_change, reauthentication_token,
  created_at, updated_at
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test-admin@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(),
  false,
  '{"role": "admin"}',
  '{"full_name": "Admin Tester", "role": "admin"}',
  '', '', '', '', '', '', '', '',
  now(), now()
);

-- Internal test user: test-internal@example.com / Password123!
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  is_super_admin, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change, phone_change_token,
  email_change_token_current, phone_change, reauthentication_token,
  created_at, updated_at
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test-internal@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(),
  false,
  '{"role": "internal"}',
  '{"full_name": "Internal Tester", "role": "internal"}',
  '', '', '', '', '', '', '', '',
  now(), now()
);

-- Sponsor test user: test-client@example.com / Password123!
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  is_super_admin, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change, phone_change_token,
  email_change_token_current, phone_change, reauthentication_token,
  created_at, updated_at
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test-client@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(),
  false,
  '{"role": "client"}',
  '{"full_name": "project SPONSOR", "role": "client"}',
  '', '', '', '', '', '', '', '',
  now(), now()
);
