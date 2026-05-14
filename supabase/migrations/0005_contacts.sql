create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  name         text,
  company      text,
  title        text,
  email        text[],
  phone_office text,
  phone_cell   text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index contacts_deal_idx on public.contacts(deal_id);
