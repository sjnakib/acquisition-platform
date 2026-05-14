create table public.google_tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  access_token     text not null,
  refresh_token    text,
  token_type       text,
  expiry           timestamptz,
  scopes           text[],
  last_history_id  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id)
);
