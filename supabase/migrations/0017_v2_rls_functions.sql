-- 0017_v2_rls_functions
-- RLS for new v2 tables + updated pipeline summary
-- Idempotent: safe to run multiple times

-- Enable RLS on new tables
alter table if exists public.portfolios         enable row level security;
alter table if exists public.field_definitions  enable row level security;
alter table if exists public.deal_fields        enable row level security;
alter table if exists public.activity_log       enable row level security;
alter table if exists public.deal_ca            enable row level security;

-- Portfolios: internal only
drop policy if exists "portfolios: internal all" on public.portfolios;
create policy "portfolios: internal all" on public.portfolios
  for all using (public.get_my_role() = 'internal');

-- Field definitions: readable by all authenticated; writable by internal
drop policy if exists "field_definitions: read all" on public.field_definitions;
create policy "field_definitions: read all" on public.field_definitions
  for select using (auth.uid() is not null);
drop policy if exists "field_definitions: internal write" on public.field_definitions;
create policy "field_definitions: internal write" on public.field_definitions
  for all using (public.get_my_role() = 'internal');

-- Deal fields: internal all; client sees fields for visible deals
drop policy if exists "deal_fields: internal all" on public.deal_fields;
create policy "deal_fields: internal all" on public.deal_fields
  for all using (public.get_my_role() = 'internal');
drop policy if exists "deal_fields: client read good" on public.deal_fields;
create policy "deal_fields: client read good" on public.deal_fields
  for select using (
    public.get_my_role() = 'client'
    and exists (
      select 1 from public.deals d
      where d.id = deal_fields.deal_id
        and d.is_archived = false
        and d.score in ('good', 'very_good')
    )
  );

-- Activity log: internal only
drop policy if exists "activity_log: internal all" on public.activity_log;
create policy "activity_log: internal all" on public.activity_log
  for all using (public.get_my_role() = 'internal');

-- Deal CA: internal only
drop policy if exists "deal_ca: internal all" on public.deal_ca;
create policy "deal_ca: internal all" on public.deal_ca
  for all using (public.get_my_role() = 'internal');

-- Add updated_at triggers for new tables
drop trigger if exists trg_portfolios_updated_at on public.portfolios;
create trigger trg_portfolios_updated_at
  before update on public.portfolios
  for each row execute procedure public.update_updated_at();

drop trigger if exists trg_deal_fields_updated_at on public.deal_fields;
create trigger trg_deal_fields_updated_at
  before update on public.deal_fields
  for each row execute procedure public.update_updated_at();

drop trigger if exists trg_deal_ca_updated_at on public.deal_ca;
create trigger trg_deal_ca_updated_at
  before update on public.deal_ca
  for each row execute procedure public.update_updated_at();

-- Update pipeline summary for v2 stages
drop function if exists public.get_pipeline_summary();

create or replace function public.get_pipeline_summary()
returns table (
  campaign_name        text,
  market               text,
  leads                bigint,
  emails_sent          bigint,
  responses_positive   bigint,
  underwritten         bigint,
  scored_good          bigint,
  loi_count            bigint,
  closed_count         bigint,
  failed_count         bigint
) language sql stable security definer as $$
  select
    c.name,
    c.market,
    count(*) filter (where d.stage = 'lead'),
    count(*) filter (where e.status = 'sent'),
    count(*) filter (where e.response_classification in ('positive','neutral')),
    count(*) filter (where d.stage in ('underwriting','loi','closed','failed')),
    count(*) filter (where d.score in ('good','very_good')),
    count(*) filter (where d.stage in ('loi','closed')),
    count(*) filter (where d.stage = 'closed'),
    count(*) filter (where d.stage = 'failed')
  from public.deals d
  join public.campaigns c on c.id = d.campaign_id
  left join public.email_outreach e on e.deal_id = d.id
  where public.get_my_role() = 'internal'
  group by c.id, c.name, c.market
$$;
