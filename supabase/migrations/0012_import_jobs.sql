create table public.import_jobs (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  total_rows  int not null default 0,
  inserted    int not null default 0,
  skipped     int not null default 0,
  status      text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  error_log   text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
