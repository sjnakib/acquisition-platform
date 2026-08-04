-- 0016_v2_schema_transform
-- Transforms old 11-stage fixed-column schema → v2 8-stage flexible schema
-- Idempotent: safe to run multiple times

-- ── New enum types (skip if already exist) ────────────────────────
do $$ begin
  create type public.field_data_type as enum (
    'text', 'number', 'integer', 'date', 'boolean', 'url', 'currency'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.activity_type as enum (
    'call', 'voicemail', 'note', 'meeting', 'other'
  );
exception when duplicate_object then null;
end $$;

-- ── New tables ───────────────────────────────────────────────────
create table if not exists public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists portfolios_name_idx on public.portfolios using gin (name gin_trgm_ops);

create table if not exists public.field_definitions (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  label         text not null,
  data_type     public.field_data_type not null default 'text',
  sort_order    int not null default 100,
  show_in_grid  boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.deal_fields (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  field_id     uuid not null references public.field_definitions(id) on delete cascade,
  value        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (deal_id, field_id)
);
create index if not exists deal_fields_deal_idx  on public.deal_fields(deal_id);
create index if not exists deal_fields_field_idx on public.deal_fields(field_id);

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  type        public.activity_type not null,
  summary     text not null,
  logged_by   uuid references public.profiles(id),
  logged_at   timestamptz not null default now()
);
create index if not exists activity_log_deal_idx on public.activity_log(deal_id, logged_at desc);

create table if not exists public.deal_ca (
  deal_id           uuid primary key references public.deals(id) on delete cascade,
  ca_status         public.ca_status not null default 'not_required',
  ca_platform       text,
  ca_credential_id  uuid references public.ca_credentials(id) on delete set null,
  updated_at        timestamptz not null default now()
);

-- ── Transform deal_stage enum (11 values → 8 values) ─────────────
-- Run if the 'failed' enum value is missing (meaning it is still using the old definition)
do $$
begin
  if not exists (
    select 1 from pg_type t 
    join pg_enum e on t.oid = e.enumtypid 
    where t.typname = 'deal_stage' and e.enumlabel = 'failed'
  ) then
    alter table public.deals alter column stage drop default;
    alter table public.deals alter column stage type text;
    drop type public.deal_stage;
    create type public.deal_stage as enum (
      'lead', 'outreach', 'response', 'underwriting',
      'loi', 'closed', 'failed', 'archived'
    );
    update public.deals set stage = case stage
      when 'document_collection'     then 'underwriting'
      when 'underwritability_review' then 'underwriting'
      when 'scored'                  then 'underwriting'
      when 'call_scheduled'          then 'loi'
      else stage
    end;
    alter table public.deals alter column stage type public.deal_stage using stage::public.deal_stage;
    alter table public.deals alter column stage set default 'lead'::public.deal_stage;
  end if;
exception when others then
  -- Enum already transformed or no data yet
  raise notice 'deal_stage transform skipped: %', SQLERRM;
end $$;

-- ── Transform underwritability enum ──────────────────────────────
do $$
declare
  v_exists boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'underwriting'
    and column_name = 'underwritability'
  ) into v_exists;
  if v_exists then
    alter table public.underwriting alter column underwritability type text;
    drop type public.underwritability;
    create type public.underwritability as enum ('go', 'no_go', 'maybe');
    update public.underwriting set underwritability = case underwritability
      when 'underwritable'     then 'go'
      when 'not_underwritable' then 'no_go'
      else 'maybe'
    end;
    alter table public.underwriting alter column underwritability type public.underwritability using underwritability::public.underwritability;
    alter table public.underwriting rename column underwritability to underwritability_status;
  end if;
exception when others then
  raise notice 'underwritability transform skipped: %', SQLERRM;
end $$;

-- ── Alter deals: add v2 columns, drop deprecated fixed columns ──
alter table public.deals
  add column if not exists portfolio_id      uuid references public.portfolios(id) on delete set null,
  add column if not exists outreach_emails   text[] not null default '{}',
  add column if not exists unit_count        int,
  add column if not exists last_contacted_at timestamptz;

alter table public.deals
  drop column if exists property_id,
  drop column if exists source,
  drop column if exists listing_type,
  drop column if exists property_type,
  drop column if exists building_class,
  drop column if exists year_built,
  drop column if exists year_renovated,
  drop column if exists address,
  drop column if exists city,
  drop column if exists state,
  drop column if exists zip,
  drop column if exists property_link;

create index if not exists deals_portfolio_idx on public.deals(portfolio_id);

-- ── Alter document_checklist: fixed booleans → flexible rows ─────
alter table public.document_checklist
  drop column if exists pl_collected,
  drop column if exists pl_period,
  drop column if exists rent_roll_collected,
  drop column if exists rent_roll_as_of,
  drop column if exists om_collected,
  drop column if exists tax_bill_collected,
  drop column if exists capex_collected,
  drop column if exists market_report_1,
  drop column if exists market_report_2,
  drop column if exists market_report_3,
  drop column if exists market_report_4,
  drop column if exists ca_status,
  drop column if exists ca_platform,
  drop column if exists ca_credential_id;

alter table public.document_checklist
  add column if not exists doc_name   text,
  add column if not exists collected  boolean not null default false,
  add column if not exists metadata   jsonb not null default '{}'::jsonb,
  add column if not exists sort_order int not null default 100;

-- Drop old unique constraint on deal_id (since we now have multiple rows per deal)
alter table public.document_checklist drop constraint if exists document_checklist_deal_id_key;

-- Add new unique constraint on (deal_id, doc_name)
alter table public.document_checklist add constraint document_checklist_deal_id_doc_name_key unique (deal_id, doc_name);

drop index if exists document_checklist_deal_idx;
create index if not exists document_checklist_deal_idx on public.document_checklist(deal_id);

-- ── Alter underwriting: rename columns, add approval fields ──────
do $$ begin alter table public.underwriting rename column asking_price_per_unit to price_per_unit; exception when others then null; end $$;
do $$ begin alter table public.underwriting rename column market_delta_pct to delta_pct; exception when others then null; end $$;
do $$ begin alter table public.underwriting rename column capex_estimate to capex; exception when others then null; end $$;
do $$ begin alter table public.underwriting rename column projected_profit to profit; exception when others then null; end $$;

alter table public.underwriting
  drop column if exists rent_growth_t12_pct,
  drop column if exists rent_growth_fwd_pct,
  drop column if exists sale_comps_available,
  drop column if exists rent_comps_available;

alter table public.underwriting
  add column if not exists rent_growth_pct         numeric(6,3),
  add column if not exists purchase_price          numeric(15,2),
  add column if not exists purchase_price_per_unit numeric(12,2),
  add column if not exists capex_per_unit          numeric(12,2),
  add column if not exists proceed_with_loi        boolean,
  add column if not exists uw_analyst_id           uuid references public.profiles(id),
  add column if not exists uw_completion_date      date,
  add column if not exists reviewer_1_id           uuid references public.profiles(id),
  add column if not exists review_1_date           date,
  add column if not exists reviewer_2_id           uuid references public.profiles(id),
  add column if not exists review_2_date           date;

-- ── Alter import_jobs: add v2 columns ────────────────────────────
alter table public.import_jobs
  add column if not exists portfolio_id   uuid references public.portfolios(id) on delete set null,
  add column if not exists source_headers text[] not null default '{}',
  add column if not exists column_mapping jsonb not null default '{}'::jsonb;

alter table public.import_jobs
  drop constraint if exists import_jobs_status_check;

alter table public.import_jobs
  add constraint import_jobs_status_check
    check (status in ('pending', 'mapping', 'running', 'done', 'failed'));

-- ── seed_default_checklist function ──────────────────────────────
create or replace function public.seed_default_checklist(p_deal_id uuid)
returns void language plpgsql as $$
declare items text[] := array[
  'P&L', 'Rent Roll', 'Offering Memorandum (OM)', 'Tax Bill',
  'CAPEX Schedule', 'Market Report 1', 'Market Report 2',
  'Market Report 3', 'Market Report 4'
];
  d text; i int := 0;
begin
  foreach d in array items loop
    insert into public.document_checklist (deal_id, doc_name, sort_order)
    values (p_deal_id, d, i);
    i := i + 10;
  end loop;
end;
$$;

-- ── touch_last_contacted trigger ─────────────────────────────────
create or replace function public.touch_last_contacted()
returns trigger language plpgsql as $$
begin
  update public.deals
  set last_contacted_at = greatest(coalesce(last_contacted_at, new.logged_at), new.logged_at)
  where id = new.deal_id;
  return new;
end;
$$;

drop trigger if exists trg_activity_touches_deal on public.activity_log;
create trigger trg_activity_touches_deal
  after insert on public.activity_log
  for each row execute procedure public.touch_last_contacted();
