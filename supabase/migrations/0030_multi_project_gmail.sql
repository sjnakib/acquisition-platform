-- 0030: Multi-project Gmail — replace per-user google_tokens with per-account google_connections
-- Each project can connect to any Google account. Multiple projects can share one connection.
-- When no project references a connection, it is auto-cleaned up at the application level.

-- 1. New table for Google account connections (keyed by Google email, not user)
create table public.google_connections (
  id              uuid primary key default gen_random_uuid(),
  google_email    text not null,
  access_token    text not null,
  refresh_token   text,
  token_type      text,
  expiry          timestamptz,
  scopes          text[],
  last_history_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(google_email)
);

-- 2. Add FK from projects to google_connections
alter table public.projects
  add column google_connection_id uuid
  references public.google_connections(id) on delete set null;

-- 3. Enable RLS and create policies
alter table public.google_connections enable row level security;

create policy "google_connections: internal all" on public.google_connections
  for all using (public.get_my_role() = 'internal');

-- 4. updated_at trigger
create trigger trg_google_connections_updated_at
  before update on public.google_connections
  for each row execute function public.update_updated_at();
