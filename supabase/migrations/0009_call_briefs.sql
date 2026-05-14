create type public.call_status as enum (
  'pending', 'completed', 'cancelled'
);

create table public.call_briefs (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references public.deals(id) on delete cascade,

  summary_text    text,
  published       boolean not null default false,
  published_at    timestamptz,

  call_status     public.call_status not null default 'pending',
  completed_at    timestamptz,
  client_notes    text,

  flagged_by      uuid references public.profiles(id),
  flagged_at      timestamptz not null default now(),

  updated_at      timestamptz not null default now()
);

create index call_briefs_deal_idx on public.call_briefs(deal_id);
create index call_briefs_status_idx on public.call_briefs(call_status) where published = true;
