create type public.loi_outcome as enum (
  'in_progress', 'deal_reached', 'fallen_through'
);

create table public.loi_records (
  id                    uuid primary key default gen_random_uuid(),
  deal_id               uuid not null references public.deals(id) on delete cascade,

  submitted_at          date,
  offered_price         numeric(15,2),
  outcome               public.loi_outcome not null default 'in_progress',
  final_price           numeric(15,2),
  close_date            date,
  fallen_through_reason text,
  fallen_through_date   date,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(deal_id)
);

create table public.loi_rounds (
  id          uuid primary key default gen_random_uuid(),
  loi_id      uuid not null references public.loi_records(id) on delete cascade,
  round_num   int not null,
  price       numeric(15,2),
  party       text check (party in ('buyer', 'seller')),
  round_date  date,
  notes       text,
  created_at  timestamptz not null default now()
);

create index loi_rounds_loi_idx on public.loi_rounds(loi_id);
