

-- Ensure schema usage and default privileges exist for Supabase default roles
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- ── MIGRATION: 0001_extensions.sql ──
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;


-- ── MIGRATION: 0002_auth_roles.sql ──
create type public.user_role as enum ('internal', 'client', 'admin');

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  role          public.user_role not null default 'internal',
  client_org    text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role public.user_role;
begin
  v_role := coalesce(
    (new.raw_user_meta_data->>'role')::public.user_role,
    (new.raw_app_meta_data->>'role')::public.user_role,
    'internal'
  );

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role
  );

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', v_role::text)
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── MIGRATION: 0003_campaigns.sql ──
create type public.listing_type as enum ('on_market', 'off_market');
create type public.deal_source  as enum ('direct', 'indirect');
create type public.email_template_key as enum ('outreach', 'thank_you', 'declination', 'custom');

create table public.campaigns (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  market                   text not null,
  listing_type             public.listing_type,
  email_template           public.email_template_key,
  email_subject_template   text,
  target_response_rate_pct numeric(5,2),
  target_loi_count         int,
  is_active                boolean not null default true,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);


-- ── MIGRATION: 0004_deals.sql ──
create type public.deal_stage as enum (
  'lead',
  'outreach',
  'response',
  'document_collection',
  'underwritability_review',
  'underwriting',
  'scored',
  'call_scheduled',
  'loi',
  'closed',
  'archived'
);

create type public.deal_score as enum ('very_good', 'good', 'bad', 'very_bad');

create type public.property_type as enum (
  'multifamily', 'retail', 'office', 'industrial', 'mixed_use', 'other'
);

create type public.building_class as enum ('A', 'B', 'C', 'D', 'unclassified');

create table public.deals (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid references public.campaigns(id) on delete set null,

  property_id           text,
  deal_name             text,
  import_batch          text,

  source                public.deal_source not null default 'indirect',
  listing_type          public.listing_type,
  property_type         public.property_type,
  building_class        public.building_class,
  year_built            int,
  year_renovated        int,
  unit_count            int,
  property_link         text,

  address               text,
  city                  text,
  state                 text,
  zip                   text,

  stage                 public.deal_stage not null default 'lead',
  score                 public.deal_score,
  is_archived           boolean not null default false,
  archive_reason        text,

  drive_folder_url      text,

  internal_notes        text,

  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index deals_property_id_campaign_idx
  on public.deals(property_id, campaign_id)
  where property_id is not null;

create index deals_search_idx on public.deals
  using gin(to_tsvector('english',
    coalesce(deal_name, '') || ' ' ||
    coalesce(address, '')   || ' ' ||
    coalesce(city, '')      || ' ' ||
    coalesce(state, '')
  ));


-- ── MIGRATION: 0005_contacts.sql ──
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


-- ── MIGRATION: 0006_email_outreach.sql ──
create type public.email_status as enum (
  'not_sent', 'sent', 'invalid_address', 'gmail_error', 'replied'
);

create type public.response_classification as enum (
  'positive', 'neutral', 'negative', 'no_response'
);

create table public.email_outreach (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references public.deals(id) on delete cascade,
  contact_id              uuid references public.contacts(id) on delete set null,

  status                  public.email_status not null default 'not_sent',
  sent_at                 timestamptz,
  subject                 text,
  template_used           public.email_template_key,
  gmail_message_id        text,
  gmail_thread_id         text,
  error_message           text,

  response_classification public.response_classification,
  responded_at            timestamptz,

  conversation_log        text,

  thank_you_sent          boolean not null default false,
  thank_you_sent_at       timestamptz,

  declination_sent        boolean not null default false,
  declination_sent_at     timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index email_outreach_deal_idx on public.email_outreach(deal_id);
create index email_outreach_thread_idx on public.email_outreach(gmail_thread_id)
  where gmail_thread_id is not null;


-- ── MIGRATION: 0007_documents.sql ──
create type public.ca_status as enum (
  'not_required', 'pending', 'signed', 'approved'
);

-- CA credentials must exist before document_checklist references it
create table public.ca_credentials (
  id                  uuid primary key default gen_random_uuid(),
  platform            text not null,
  username            text,
  password_encrypted  bytea,
  notes               text,
  created_at          timestamptz not null default now()
);

create table public.document_checklist (
  id                     uuid primary key default gen_random_uuid(),
  deal_id                uuid not null references public.deals(id) on delete cascade,

  pl_collected           boolean not null default false,
  pl_period              text,
  rent_roll_collected    boolean not null default false,
  rent_roll_as_of        date,
  om_collected           boolean not null default false,
  tax_bill_collected     boolean,
  capex_collected        boolean,
  market_report_1        boolean,
  market_report_2        boolean,
  market_report_3        boolean,
  market_report_4        boolean,

  ca_status              public.ca_status not null default 'not_required',
  ca_platform            text,
  ca_credential_id       uuid references public.ca_credentials(id) on delete set null,

  updated_at             timestamptz not null default now(),
  unique(deal_id)
);

create or replace function public.store_ca_credential(
  p_platform text,
  p_username text,
  p_password text,
  p_encryption_key text
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.ca_credentials (platform, username, password_encrypted)
  values (p_platform, p_username, pgp_sym_encrypt(p_password, p_encryption_key))
  returning id into v_id;
  return v_id;
end;
$$;


-- ── MIGRATION: 0008_underwriting.sql ──
create type public.underwritability as enum (
  'underwritable', 'not_underwritable', 'maybe'
);

create table public.underwriting (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references public.deals(id) on delete cascade,

  underwritability        public.underwritability,
  screened_at             timestamptz,
  screened_by             uuid references public.profiles(id),

  asking_price            numeric(15,2),
  asking_price_per_unit   numeric(12,2),
  population_1mi          int,
  population_growth_pct   numeric(6,3),
  rent_growth_t12_pct     numeric(6,3),
  rent_growth_fwd_pct     numeric(6,3),
  vacancy_rate_pct        numeric(6,3),
  market_price_per_unit   numeric(12,2),
  market_delta_pct        numeric(6,3),
  cap_rate                numeric(6,3),
  sale_comps_available    boolean,
  rent_comps_available    boolean,

  purchase_price          numeric(15,2),
  purchase_price_per_unit numeric(12,2),
  capex_estimate          numeric(15,2),
  irr_pct                 numeric(6,3),
  equity_multiple         numeric(6,3),
  cash_on_cash_pct        numeric(6,3),
  projected_profit        numeric(15,2),
  occupancy_pct           numeric(6,3),
  uw_notes                text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(deal_id)
);


-- ── MIGRATION: 0009_call_briefs.sql ──
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


-- ── MIGRATION: 0010_loi.sql ──
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


-- ── MIGRATION: 0011_google_tokens.sql ──
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


-- ── MIGRATION: 0012_import_jobs.sql ──
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


-- ── MIGRATION: 0013_rls_policies.sql ──
alter table public.profiles           enable row level security;
alter table public.campaigns          enable row level security;
alter table public.deals              enable row level security;
alter table public.contacts           enable row level security;
alter table public.email_outreach     enable row level security;
alter table public.document_checklist enable row level security;
alter table public.ca_credentials     enable row level security;
alter table public.underwriting       enable row level security;
alter table public.call_briefs        enable row level security;
alter table public.loi_records        enable row level security;
alter table public.loi_rounds         enable row level security;
alter table public.google_tokens      enable row level security;
alter table public.import_jobs        enable row level security;

create or replace function public.get_my_role()
returns public.user_role language sql stable security definer as $$
  select (auth.jwt()->>'role')::public.user_role
$$;

create policy "profiles: own row" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: internal sees all" on public.profiles
  for select using (public.get_my_role() = 'internal');

create policy "profiles: own update" on public.profiles
  for update using (id = auth.uid());

create policy "campaigns: internal all" on public.campaigns
  for all using (public.get_my_role() = 'internal');

create policy "deals: internal all" on public.deals
  for all using (public.get_my_role() = 'internal');

create policy "deals: client read good" on public.deals
  for select using (
    public.get_my_role() = 'client'
    and is_archived = false
    and score in ('good', 'very_good')
  );

create policy "contacts: internal all" on public.contacts
  for all using (public.get_my_role() = 'internal');

create policy "email_outreach: internal all" on public.email_outreach
  for all using (public.get_my_role() = 'internal');

create policy "document_checklist: internal all" on public.document_checklist
  for all using (public.get_my_role() = 'internal');

create policy "ca_credentials: internal all" on public.ca_credentials
  for all using (public.get_my_role() = 'internal');

create policy "underwriting: internal all" on public.underwriting
  for all using (public.get_my_role() = 'internal');

create policy "call_briefs: internal all" on public.call_briefs
  for all using (public.get_my_role() = 'internal');

create policy "call_briefs: client sees published" on public.call_briefs
  for select using (
    public.get_my_role() = 'client'
    and published = true
    and exists (
      select 1 from public.deals d
      where d.id = call_briefs.deal_id
        and d.is_archived = false
        and d.score in ('good', 'very_good')
    )
  );

create policy "call_briefs: client update notes" on public.call_briefs
  for update using (
    public.get_my_role() = 'client'
    and published = true
    and exists (
      select 1 from public.deals d
      where d.id = call_briefs.deal_id
        and d.is_archived = false
        and d.score in ('good', 'very_good')
    )
  )
  with check (
    public.get_my_role() = 'client'
    and published = true
  );

create policy "loi_records: internal all" on public.loi_records
  for all using (public.get_my_role() = 'internal');

create policy "loi_rounds: internal all" on public.loi_rounds
  for all using (public.get_my_role() = 'internal');

create policy "google_tokens: own row" on public.google_tokens
  for all using (user_id = auth.uid());

create policy "import_jobs: internal all" on public.import_jobs
  for all using (public.get_my_role() = 'internal');


-- ── MIGRATION: 0014_functions.sql ──
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare t text;
begin
  foreach t in array array[
    'profiles','campaigns','deals','email_outreach',
    'document_checklist','underwriting','call_briefs',
    'loi_records','google_tokens','import_jobs'
  ] loop
    execute format('
      create trigger trg_%s_updated_at
      before update on public.%s
      for each row execute procedure public.update_updated_at();
    ', t, t);
  end loop;
end $$;

create or replace function public.get_pipeline_summary()
returns table (
  campaign_name          text,
  market                 text,
  leads                  bigint,
  emails_sent            bigint,
  responses_positive     bigint,
  underwritten           bigint,
  scored_good            bigint,
  loi_count              bigint,
  closed_count           bigint
) language sql stable security definer as $$
  select
    c.name,
    c.market,
    count(*) filter (where d.stage = 'lead')::bigint,
    count(*) filter (where e.status = 'sent')::bigint,
    count(*) filter (where e.response_classification = 'positive')::bigint,
    count(*) filter (where d.stage in ('underwriting','scored','call_scheduled','loi','closed'))::bigint,
    count(*) filter (where d.score in ('good','very_good'))::bigint,
    count(*) filter (where d.stage in ('loi','closed'))::bigint,
    count(*) filter (where d.stage = 'closed')::bigint
  from public.deals d
  join public.campaigns c on c.id = d.campaign_id
  left join public.email_outreach e on e.deal_id = d.id
  where public.get_my_role() = 'internal'
  group by c.id, c.name, c.market
$$;


-- ── MIGRATION: 0015_fix_get_my_role.sql ──
-- Fix: auth.jwt()->>'role' returns Supabase role ('authenticated'), not custom role.
-- Custom role is stored in app_metadata.role (set by handle_new_user trigger).
create or replace function public.get_my_role()
returns public.user_role language sql stable security definer as $$
  select coalesce(
    (auth.jwt()->'app_metadata'->>'role')::public.user_role,
    (auth.jwt()->'user_metadata'->>'role')::public.user_role,
    'internal'
  )
$$;


-- ── MIGRATION: 0016_v2_schema_transform.sql ──
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


-- ── MIGRATION: 0017_v2_rls_functions.sql ──
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


-- ── MIGRATION: 0018_increase_max_rows.sql ──
-- Increase PostgREST max-rows from default 1000 to 100,000
-- so the client can request up to 5000 rows per page without server-side capping.
ALTER ROLE authenticator SET pgrst.db_max_rows = 100000;


-- ── MIGRATION: 0019_projects.sql ──
-- 0019_projects
-- Top-level organizational container for all entities.

CREATE TABLE public.projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_name_idx ON public.projects USING gin (name gin_trgm_ops);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: internal all" ON public.projects
  FOR ALL USING (get_my_role() = 'internal');

-- Client policy added in 0020 after sponsors table is created.

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── MIGRATION: 0020_sponsors.sql ──
-- 0020_sponsors
-- Links client users to projects. Replaces profiles.client_org for access control.

CREATE TABLE public.sponsors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(project_id, user_id)
);

CREATE INDEX sponsors_project_idx ON public.sponsors(project_id);
CREATE INDEX sponsors_user_idx ON public.sponsors(user_id);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sponsors: internal all" ON public.sponsors
  FOR ALL USING (get_my_role() = 'internal');

CREATE POLICY "sponsors: client sees own" ON public.sponsors
  FOR SELECT USING (user_id = auth.uid());

-- projects client policy (deferred from 0019 — needs sponsors table to exist)
CREATE POLICY "projects: client sees sponsored" ON public.projects
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.sponsors
      WHERE sponsors.project_id = projects.id
      AND sponsors.user_id = auth.uid()
    )
  );


-- ── MIGRATION: 0021_project_id_columns.sql ──
-- 0021_project_id_columns
-- Add project_id FK to all entity tables.

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS deals_project_idx ON public.deals(project_id);

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS campaigns_project_idx ON public.campaigns(project_id);

ALTER TABLE public.portfolios ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS portfolios_project_idx ON public.portfolios(project_id);

ALTER TABLE public.field_definitions ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS field_definitions_project_idx ON public.field_definitions(project_id);

-- field_definitions.key uniqueness becomes per-project instead of global
ALTER TABLE public.field_definitions DROP CONSTRAINT IF EXISTS field_definitions_key_key;
ALTER TABLE public.field_definitions ADD CONSTRAINT field_definitions_key_project_unique UNIQUE (key, project_id);

ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS import_jobs_project_idx ON public.import_jobs(project_id);


-- ── MIGRATION: 0022_rls_project_scope.sql ──
-- 0022_rls_project_scope
-- Update RLS policies to enforce project membership for client users.
-- Internal users unaffected (continue to see all).

-- ── deals ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals: client read good" ON public.deals;
CREATE POLICY "deals: client read good" ON public.deals
  FOR SELECT USING (
    get_my_role() = 'client'
    AND is_archived = false
    AND score IN ('good', 'very_good')
    AND EXISTS (
      SELECT 1 FROM public.sponsors
      WHERE sponsors.project_id = deals.project_id
      AND sponsors.user_id = auth.uid()
    )
  );

-- ── deal_fields ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_fields: client read good" ON public.deal_fields;
CREATE POLICY "deal_fields: client read good" ON public.deal_fields
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = deal_fields.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
    )
  );

-- ── call_briefs ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "call_briefs: client sees published" ON public.call_briefs;
CREATE POLICY "call_briefs: client sees published" ON public.call_briefs
  FOR SELECT USING (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
    )
  );

DROP POLICY IF EXISTS "call_briefs: client update notes" ON public.call_briefs;
CREATE POLICY "call_briefs: client update notes" ON public.call_briefs
  FOR UPDATE USING (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
    )
  )
  WITH CHECK (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
    )
  );

-- ── field_definitions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "field_definitions: read all" ON public.field_definitions;
CREATE POLICY "field_definitions: read sponsored" ON public.field_definitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      get_my_role() = 'internal'
      OR EXISTS (
        SELECT 1 FROM public.sponsors
        WHERE sponsors.project_id = field_definitions.project_id
        AND sponsors.user_id = auth.uid()
      )
    )
  );


-- ── MIGRATION: 0023_backfill_deals_project_id.sql ──
-- 0023_backfill_deals_project_id
-- Backfill project_id on deals and import_jobs where currently NULL.
-- Fixes bug where imported leads inherited no project_id and were invisible
-- in project-scoped campaign views.

UPDATE public.deals
SET project_id = campaigns.project_id
FROM public.campaigns
WHERE deals.campaign_id = campaigns.id
  AND deals.project_id IS NULL;

UPDATE public.import_jobs
SET project_id = campaigns.project_id
FROM public.campaigns
WHERE import_jobs.campaign_id = campaigns.id
  AND import_jobs.project_id IS NULL;


-- ── MIGRATION: 0024_column_rationalization.sql ──
-- 0024_column_rationalization
-- Moves deal_name and unit_count from permanent columns → dynamic deal_fields.
-- Adds last_email_sent_on, response_type to deals.
-- Splits underwriting.rent_growth_pct → rent_growth_12mo_pct + rent_growth_fwd_pct.
-- Adds sale_rent_comps to underwriting.
-- Adds LOI-related columns to loi_records.
-- Updates seed_default_checklist to include Deal Room Link.

-- ═══ Part 1: Create field_definitions for deal_name and unit_count ═══

do $$
declare
  proj record;
begin
  for proj in select id from public.projects loop
    insert into public.field_definitions (key, label, data_type, sort_order, show_in_grid, project_id)
    values ('deal_name', 'Deal Name', 'text', 0, true, proj.id)
    on conflict (key, project_id) do nothing;

    insert into public.field_definitions (key, label, data_type, sort_order, show_in_grid, project_id)
    values ('unit_count', 'Units', 'integer', 5, true, proj.id)
    on conflict (key, project_id) do nothing;
  end loop;
end $$;

-- Also create global field_definitions for any deals that lack a project_id
insert into public.field_definitions (key, label, data_type, sort_order, show_in_grid, project_id)
values ('deal_name', 'Deal Name', 'text', 0, true, null)
on conflict (key, project_id) do nothing;

insert into public.field_definitions (key, label, data_type, sort_order, show_in_grid, project_id)
values ('unit_count', 'Units', 'integer', 5, true, null)
on conflict (key, project_id) do nothing;

-- ═══ Part 2: Backfill deal_fields from existing deal_name / unit_count ═══

do $$
declare
  d record;
  v_fdef_id uuid;
begin
  for d in
    select id, project_id, deal_name, unit_count
    from public.deals
    where deal_name is not null or unit_count is not null
  loop
    -- deal_name
    if d.deal_name is not null then
      select fd.id into v_fdef_id
      from public.field_definitions fd
      where fd.key = 'deal_name'
        and (fd.project_id = d.project_id or (fd.project_id is null and d.project_id is null))
      limit 1;

      if v_fdef_id is not null then
        insert into public.deal_fields (deal_id, field_id, value)
        values (d.id, v_fdef_id, d.deal_name)
        on conflict (deal_id, field_id) do update set value = excluded.value;
      end if;
    end if;

    -- unit_count
    if d.unit_count is not null then
      select fd.id into v_fdef_id
      from public.field_definitions fd
      where fd.key = 'unit_count'
        and (fd.project_id = d.project_id or (fd.project_id is null and d.project_id is null))
      limit 1;

      if v_fdef_id is not null then
        insert into public.deal_fields (deal_id, field_id, value)
        values (d.id, v_fdef_id, d.unit_count::text)
        on conflict (deal_id, field_id) do update set value = excluded.value;
      end if;
    end if;
  end loop;
end $$;

-- ═══ Part 3: Add new columns to deals ═══

alter table public.deals
  add column if not exists last_email_sent_on timestamptz,
  add column if not exists response_type text;

-- ═══ Part 4: Drop deal_name and unit_count from deals ═══

alter table public.deals
  drop column if exists deal_name,
  drop column if exists unit_count;

-- ═══ Part 5: Split underwriting.rent_growth_pct → two columns ═══

-- Backfill existing single value → 12mo
alter table public.underwriting
  add column if not exists rent_growth_12mo_pct numeric(6,3),
  add column if not exists rent_growth_fwd_pct   numeric(6,3);

update public.underwriting
set rent_growth_12mo_pct = rent_growth_pct
where rent_growth_pct is not null
  and rent_growth_12mo_pct is null;

alter table public.underwriting
  drop column if exists rent_growth_pct;

-- Add sale_rent_comps
alter table public.underwriting
  add column if not exists sale_rent_comps text;

-- ═══ Part 6: Set show_in_grid = false for address/city/state/zip ═══

update public.field_definitions
set show_in_grid = false
where key in ('address', 'city', 'state', 'zip')
  and show_in_grid = true;

-- ═══ Part 7: Add LOI-related columns to loi_records ═══

alter table public.loi_records
  add column if not exists insurance_declarations      boolean not null default false,
  add column if not exists vendor_service_contracts     boolean not null default false,
  add column if not exists utility_bills                boolean not null default false,
  add column if not exists email_for_loi                text,
  add column if not exists last_email_for_loi_sent_on   timestamptz;

-- ═══ Part 8: Update seed_default_checklist to include Deal Room Link ═══

create or replace function public.seed_default_checklist(p_deal_id uuid)
returns void language plpgsql as $$
declare
  items text[] := array[
    'P&L', 'Rent Roll', 'Offering Memorandum (OM)', 'Tax Bill',
    'CAPEX Schedule', 'Market Report 1', 'Market Report 2',
    'Market Report 3', 'Market Report 4', 'Deal Room Link'
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


-- ── MIGRATION: 0025_hide_deal_name_units.sql ──
-- 0025_hide_deal_name_units
-- Set show_in_grid = false for deal_name and unit_count so they don't appear
-- as columns in the Leads/Deals tables. Values remain in deal_fields for
-- detail views, imports, and programmatic access.

update public.field_definitions
set show_in_grid = false
where key in ('deal_name', 'unit_count')
  and show_in_grid = true;


-- ── MIGRATION: 0026_surface_imported_fields.sql ──
-- 0026_surface_imported_fields
-- Field definitions created by imports before the show_in_grid fix defaulted
-- to false. Surface all fields except the seed defaults the user has
-- explicitly chosen to hide.

update public.field_definitions
set show_in_grid = true
where show_in_grid = false
  and key not in (
    'address', 'city', 'state', 'zip',
    'deal_name', 'unit_count',
    'property_type', 'building_class', 'year_built', 'property_link'
  );


-- ── MIGRATION: 0027_follow_up_call_fields.sql ──
-- Migration 0027: Add follow-up call fields to call_briefs
-- Adds contact_name, contact_role, phone_number for rich call entries

ALTER TABLE public.call_briefs
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS phone_number text;


-- ── MIGRATION: 0028_deal_detail_enhancements.sql ──
-- Migration 0028: Deal detail page enhancements
-- Re-adds dropped underwriting screening columns + adds LOI tracking fields

-- ── Underwriting: re-add dropped screening columns ───────────────────

ALTER TABLE public.underwriting
  ADD COLUMN IF NOT EXISTS rent_growth_12mo_pct     numeric(6,3),
  ADD COLUMN IF NOT EXISTS rent_growth_forecast_pct numeric(6,3),
  ADD COLUMN IF NOT EXISTS sale_rent_comps           text;

-- ── LOI records: add document tracking and email fields ──────────────

ALTER TABLE public.loi_records
  ADD COLUMN IF NOT EXISTS insurance_declarations    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_service_contracts  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS utility_bills             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loi_email                 text,
  ADD COLUMN IF NOT EXISTS last_loi_email_sent_at    timestamptz;


-- ── MIGRATION: 0029_project_access.sql ──
-- Migration 0029: Track user project access for relevance ranking
-- Powers the sidebar "Switch Project" section to show recent projects only

CREATE TABLE IF NOT EXISTS public.project_access (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

CREATE INDEX IF NOT EXISTS project_access_user_id_idx ON public.project_access(user_id);

ALTER TABLE public.project_access ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users manage own project access'
      AND tablename = 'project_access'
  ) THEN
    CREATE POLICY "Users manage own project access" ON public.project_access
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Returns projects sorted by recency for a given user, falling back to created_at
-- SECURITY INVOKER so RLS on projects and project_access still applies
CREATE OR REPLACE FUNCTION get_recent_projects(p_limit int DEFAULT 4)
RETURNS SETOF projects
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT p.*
  FROM projects p
  LEFT JOIN project_access pa ON pa.project_id = p.id AND pa.user_id = auth.uid()
  ORDER BY pa.accessed_at DESC NULLS LAST, p.created_at DESC
  LIMIT p_limit;
$$;


-- ── MIGRATION: 0030_multi_project_gmail.sql ──
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


-- ── MIGRATION: 0031_email_body_template.sql ──
-- 0031: Add email_body_template to campaigns for mail-merge / mass email support
alter table public.campaigns
  add column email_body_template text;


-- ── MIGRATION: 0032_custom_templates.sql ──
-- 0032: Custom email templates, field source tracking, email attachments

-- 1. Field source enum + column
create type public.field_source as enum ('system', 'import', 'manual');
alter table public.field_definitions
  add column source public.field_source not null default 'manual';

-- Mark known system fields
update public.field_definitions
  set source = 'system'
where key in (
  'address', 'city', 'state', 'zip', 'deal_name', 'unit_count',
  'property_type', 'building_class', 'year_built', 'property_link'
);

-- 2. Custom email templates (project-scoped)
create table public.email_templates (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  name             text not null,
  subject_template text not null default '',
  body_template    text not null default '',
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index email_templates_project_idx on public.email_templates(project_id);

alter table public.email_templates enable row level security;

create policy "email_templates: internal all" on public.email_templates
  for all using (public.get_my_role() = 'internal');

-- updated_at trigger
create trigger trg_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.update_updated_at();

-- 3. FK from campaigns to email_templates (backward compat with email_template enum)
alter table public.campaigns
  add column email_template_id uuid references public.email_templates(id) on delete set null;

-- 4. Email attachments
create table public.email_attachments (
  id               uuid primary key default gen_random_uuid(),
  email_outreach_id uuid references public.email_outreach(id) on delete cascade,
  filename         text not null,
  storage_path     text not null,
  size_bytes       bigint not null,
  mime_type        text not null,
  created_at       timestamptz not null default now()
);

alter table public.email_attachments enable row level security;

create policy "email_attachments: internal all" on public.email_attachments
  for all using (public.get_my_role() = 'internal');


-- ── MIGRATION: 0033_custom_template_enum.sql ──
-- 0033: Add 'custom' value to email_template_key enum for custom templates

-- alter type public.email_template_key add value 'custom'; (Handled in initial enum creation)


-- ── MIGRATION: 0034_address_not_deal_name.sql ──
-- Migration 0034: Address as required field instead of Deal Name
-- Enforce 'address' as the primary required field, rename existing 'deal_name' keys to 'address'.

do $$
declare
  r record;
  v_deal_name_fd_id uuid;
  v_address_fd_id uuid;
begin
  -- For each project (including global null project)
  for r in 
    select distinct project_id from public.field_definitions
    union
    select null::uuid
  loop
    -- Check if deal_name and address field definitions exist for this project
    select id into v_deal_name_fd_id 
    from public.field_definitions 
    where key = 'deal_name' 
      and (project_id = r.project_id or (project_id is null and r.project_id is null))
    limit 1;
    
    select id into v_address_fd_id 
    from public.field_definitions 
    where key = 'address' 
      and (project_id = r.project_id or (project_id is null and r.project_id is null))
    limit 1;

    if v_deal_name_fd_id is not null then
      if v_address_fd_id is not null then
        -- Both exist: migrate values from deal_name to address if address value is empty/null
        update public.deal_fields df_addr
        set value = df_name.value
        from public.deal_fields df_name
        where df_addr.deal_id = df_name.deal_id
          and df_name.field_id = v_deal_name_fd_id
          and df_addr.field_id = v_address_fd_id
          and (df_addr.value is null or df_addr.value = '');

        -- Insert missing address records that only exist in deal_name
        insert into public.deal_fields (deal_id, field_id, value)
        select df_name.deal_id, v_address_fd_id, df_name.value
        from public.deal_fields df_name
        where df_name.field_id = v_deal_name_fd_id
          and not exists (
            select 1 from public.deal_fields df_addr 
            where df_addr.deal_id = df_name.deal_id 
              and df_addr.field_id = v_address_fd_id
          );

        -- Delete the deal_name field definition (and cascade deletes its remaining deal_fields)
        delete from public.field_definitions where id = v_deal_name_fd_id;
      else
        -- Only deal_name exists: rename it to address
        update public.field_definitions
        set key = 'address', label = 'Address', show_in_grid = true
        where id = v_deal_name_fd_id;
      end if;
    elsif v_address_fd_id is not null then
      -- Only address exists: make sure it is visible in grid
      update public.field_definitions
      set show_in_grid = true
      where id = v_address_fd_id;
    else
      -- Neither exists: create address field definition
      insert into public.field_definitions (key, label, data_type, sort_order, show_in_grid, project_id)
      values ('address', 'Address', 'text', 0, true, r.project_id);
    end if;
  end loop;
end $$;


-- ── MIGRATION: 0035_snoozed_threads.sql ──
-- Migration 0035: Track snoozed email threads
-- Scoped to projects and deals with RLS enforcement for internal users

CREATE TABLE IF NOT EXISTS public.snoozed_threads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  deal_id       uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  thread_id     text NOT NULL,
  snoozed_until timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, thread_id)
);

-- Index for lookup and deal filtering
CREATE INDEX IF NOT EXISTS snoozed_threads_lookup_idx ON public.snoozed_threads(snoozed_until);
CREATE INDEX IF NOT EXISTS snoozed_threads_deal_idx ON public.snoozed_threads(deal_id);

-- Enable RLS
ALTER TABLE public.snoozed_threads ENABLE ROW LEVEL SECURITY;

-- Create policy for internal users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'snoozed_threads: internal all'
      AND tablename = 'snoozed_threads'
  ) THEN
    CREATE POLICY "snoozed_threads: internal all" ON public.snoozed_threads
      FOR ALL USING (public.get_my_role() = 'internal');
  END IF;
END $$;


-- ── MIGRATION: 0036_enable_realtime.sql ──
-- Migration 0036: Enable realtime replication for email-related tables
-- Allows the frontend to listen for real-time changes to emails, snoozes, and Gmail webhook updates.

-- Enable replication for email_outreach
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'email_outreach'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_outreach;
  END IF;
END $$;

-- Enable replication for snoozed_threads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'snoozed_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.snoozed_threads;
  END IF;
END $$;

-- Enable replication for google_connections (captures incoming email webhook updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'google_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.google_connections;
  END IF;
END $$;


-- ── MIGRATION: 0037_email_attachments_storage.sql ──
-- 0037: Create email-attachments storage bucket and RLS policies

-- 1. Create the bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-attachments',
  'email-attachments',
  false,
  52428800, -- 50MB limit
  null      -- all MIME types allowed
)
on conflict (id) do nothing;

-- 2. Allow authenticated users to upload files to 'email-attachments' bucket inside their user ID folder
DROP POLICY IF EXISTS "Allow authenticated uploads to email-attachments" ON storage.objects;
create policy "Allow authenticated uploads to email-attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow authenticated users to read files in 'email-attachments' bucket inside their user ID folder
DROP POLICY IF EXISTS "Allow authenticated reads from email-attachments" ON storage.objects;
create policy "Allow authenticated reads from email-attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow authenticated users to delete files in 'email-attachments' bucket inside their user ID folder
DROP POLICY IF EXISTS "Allow authenticated deletes from email-attachments" ON storage.objects;
create policy "Allow authenticated deletes from email-attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);


-- ── MIGRATION: 0038_fix_client_field_defs.sql ──
-- 0038_fix_client_field_defs
-- 1. Fix field_definitions RLS: allow clients to read global field definitions
--    (project_id IS NULL), e.g. address, deal_name, unit_count created by
--    migrations 0024/0034. Without this, PostgREST nested joins can silently
--    drop deal_fields rows that reference global definitions.
-- 2. Add debug_client_access() helper for verifying RLS state.

-- ── Fix field_definitions RLS ────────────────────────────────────────

DROP POLICY IF EXISTS "field_definitions: read sponsored" ON public.field_definitions;
CREATE POLICY "field_definitions: read sponsored" ON public.field_definitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      get_my_role() = 'internal'
      OR field_definitions.project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.sponsors
        WHERE sponsors.project_id = field_definitions.project_id
        AND sponsors.user_id = auth.uid()
      )
    )
  );

-- ── Diagnostic helper ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.debug_client_access()
RETURNS TABLE(role text, sponsored_project_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    get_my_role()::text,
    array_agg(project_id)
  FROM public.sponsors
  WHERE user_id = auth.uid()
$$;


-- ── MIGRATION: 0039_relax_client_deal_rls.sql ──
-- 0039_relax_client_deal_rls
-- Remove score requirement from client RLS policies. Clients now see all
-- non-archived deals from sponsored projects, regardless of score.
-- The score field remains for internal filtering/sorting.

-- ── deals ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals: client read good" ON public.deals;
CREATE POLICY "deals: client read good" ON public.deals
  FOR SELECT USING (
    get_my_role() = 'client'
    AND is_archived = false
    AND EXISTS (
      SELECT 1 FROM public.sponsors
      WHERE sponsors.project_id = deals.project_id
      AND sponsors.user_id = auth.uid()
    )
  );

-- ── deal_fields ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_fields: client read good" ON public.deal_fields;
CREATE POLICY "deal_fields: client read good" ON public.deal_fields
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = deal_fields.deal_id
      AND d.is_archived = false
    )
  );

-- ── call_briefs ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "call_briefs: client sees published" ON public.call_briefs;
CREATE POLICY "call_briefs: client sees published" ON public.call_briefs
  FOR SELECT USING (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
    )
  );

DROP POLICY IF EXISTS "call_briefs: client update notes" ON public.call_briefs;
CREATE POLICY "call_briefs: client update notes" ON public.call_briefs
  FOR UPDATE USING (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
    )
  )
  WITH CHECK (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
    )
  );


-- ── MIGRATION: 0040_client_contacts_rls.sql ──
-- 0040_client_contacts_rls
-- Add client SELECT policy for contacts. Clients can see contacts for deals
-- in their sponsored projects. Required for email thread listing to resolve
-- tracked emails for Gmail search queries.

DROP POLICY IF EXISTS "contacts: client read sponsored" ON public.contacts;
CREATE POLICY "contacts: client read sponsored" ON public.contacts
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.sponsors s ON s.project_id = d.project_id AND s.user_id = auth.uid()
      WHERE d.id = contacts.deal_id
      AND d.is_archived = false
    )
  );


-- ── MIGRATION: 0041_drive_folders.sql ──
-- 0041: Add Google Drive working folder to projects and drive_folder_id to deals
-- Supports per-project Drive folder for document management

-- Add working folder columns to projects
alter table public.projects
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_folder_url text;

-- Add explicit folder ID to deals (complement existing drive_folder_url)
alter table public.deals
  add column if not exists drive_folder_id text;


-- ── MIGRATION: 0042_remove_activity_log.sql ──
-- Drop trigger and function
drop trigger if exists trg_activity_touches_deal on public.activity_log;
drop function if exists public.touch_last_contacted();

-- Drop table
drop table if exists public.activity_log;


-- ── MIGRATION: 0043_portfolios_as_deals.sql ──
-- 0043: Portfolios as deals
-- Add is_portfolio flag to deals and portfolio_deal_id FK to portfolios.
-- This allows portfolios to have a linked deal record that carries all
-- deal behaviors (stage, emails, underwriting, LOI, calls, drive folders).

-- 1. Add is_portfolio flag to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_portfolio boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS deals_is_portfolio_idx ON public.deals(is_portfolio);

-- 2. Link portfolios to their deal record
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS portfolio_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS portfolios_portfolio_deal_idx ON public.portfolios(portfolio_deal_id);


-- ── MIGRATION: 0044_backfill_portfolio_deals.sql ──
-- 0044: Backfill linked deals for existing portfolios
-- For each portfolio without a portfolio_deal_id, create a linked deal
-- and populate the address deal_field with the portfolio name.

DO $$
DECLARE
  rec record;
  v_deal_id uuid;
  v_field_def_id uuid;
BEGIN
  FOR rec IN
    SELECT p.*
    FROM public.portfolios p
    WHERE p.portfolio_deal_id IS NULL
  LOOP
    -- Find the 'address' field definition: prefer project-scoped, fall back to global
    SELECT fd.id INTO v_field_def_id
    FROM public.field_definitions fd
    WHERE fd.key = 'address'
      AND (fd.project_id = rec.project_id OR fd.project_id IS NULL)
    ORDER BY fd.project_id DESC NULLS LAST
    LIMIT 1;

    -- If no address field definition exists, skip (deal won't have a display name)
    -- but still create the linked deal so the portfolio works.

    -- Create linked deal
    INSERT INTO public.deals (
      project_id,
      is_portfolio,
      stage,
      created_by,
      created_at
    ) VALUES (
      rec.project_id,
      true,
      'lead',
      rec.created_by,
      rec.created_at
    )
    RETURNING id INTO v_deal_id;

    -- Set the portfolio's linked deal
    UPDATE public.portfolios
    SET portfolio_deal_id = v_deal_id
    WHERE id = rec.id;

    -- Create address deal_field if we found a field definition
    IF v_field_def_id IS NOT NULL THEN
      INSERT INTO public.deal_fields (deal_id, field_id, value)
      VALUES (v_deal_id, v_field_def_id, rec.name);
    END IF;

    -- Seed document checklist
    PERFORM public.seed_default_checklist(v_deal_id);

  END LOOP;
END;
$$;


-- ── MIGRATION: 0045_admin_role_enum.sql ──
-- 0045: Add 'admin' to user_role enum
-- Must run in its own migration — ALTER TYPE ADD VALUE cannot be combined
-- with other statements that reference the new value in the same transaction.

-- ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin'; (Handled in initial enum creation)


-- ── MIGRATION: 0046_admin_role_policies.sql ──
-- 0046: Admin role RLS policies + project membership
-- Depends on 0045 (admin enum value must exist).
-- Updates all RLS policies to treat admin like internal via is_staff(),
-- and adds project_members table to scope internal users to projects.

-- 1. Helper: is_staff() — true for internal OR admin ----------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.get_my_role() IN ('internal', 'admin');
$$;

-- 3. Update all RLS policies that previously checked = 'internal' ---------
-- Each policy: drop if exists, recreate using is_staff()

-- ── profiles ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: internal sees all" ON public.profiles;
CREATE POLICY "profiles: internal sees all" ON public.profiles
  FOR SELECT USING (public.is_staff());

-- ── campaigns ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "campaigns: internal all" ON public.campaigns;
CREATE POLICY "campaigns: internal all" ON public.campaigns
  FOR ALL USING (public.is_staff());

-- ── deals ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals: internal all" ON public.deals;
CREATE POLICY "deals: internal all" ON public.deals
  FOR ALL USING (public.is_staff());

-- ── contacts ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contacts: internal all" ON public.contacts;
CREATE POLICY "contacts: internal all" ON public.contacts
  FOR ALL USING (public.is_staff());

-- ── email_outreach ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "email_outreach: internal all" ON public.email_outreach;
CREATE POLICY "email_outreach: internal all" ON public.email_outreach
  FOR ALL USING (public.is_staff());

-- ── document_checklist ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "document_checklist: internal all" ON public.document_checklist;
CREATE POLICY "document_checklist: internal all" ON public.document_checklist
  FOR ALL USING (public.is_staff());

-- ── ca_credentials ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ca_credentials: internal all" ON public.ca_credentials;
CREATE POLICY "ca_credentials: internal all" ON public.ca_credentials
  FOR ALL USING (public.is_staff());

-- ── underwriting ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "underwriting: internal all" ON public.underwriting;
CREATE POLICY "underwriting: internal all" ON public.underwriting
  FOR ALL USING (public.is_staff());

-- ── call_briefs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "call_briefs: internal all" ON public.call_briefs;
CREATE POLICY "call_briefs: internal all" ON public.call_briefs
  FOR ALL USING (public.is_staff());

-- ── loi_records ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "loi_records: internal all" ON public.loi_records;
CREATE POLICY "loi_records: internal all" ON public.loi_records
  FOR ALL USING (public.is_staff());

-- ── loi_rounds ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "loi_rounds: internal all" ON public.loi_rounds;
CREATE POLICY "loi_rounds: internal all" ON public.loi_rounds
  FOR ALL USING (public.is_staff());

-- ── import_jobs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "import_jobs: internal all" ON public.import_jobs;
CREATE POLICY "import_jobs: internal all" ON public.import_jobs
  FOR ALL USING (public.is_staff());

-- ── portfolios ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "portfolios: internal all" ON public.portfolios;
CREATE POLICY "portfolios: internal all" ON public.portfolios
  FOR ALL USING (public.is_staff());

-- ── field_definitions: internal write ────────────────────────────────────
DROP POLICY IF EXISTS "field_definitions: internal write" ON public.field_definitions;
CREATE POLICY "field_definitions: internal write" ON public.field_definitions
  FOR ALL USING (public.is_staff());

-- ── field_definitions: read sponsored ────────────────────────────────────
DROP POLICY IF EXISTS "field_definitions: read sponsored" ON public.field_definitions;
CREATE POLICY "field_definitions: read sponsored" ON public.field_definitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_staff()
      OR field_definitions.project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.sponsors
        WHERE sponsors.project_id = field_definitions.project_id
        AND sponsors.user_id = auth.uid()
      )
    )
  );

-- ── deal_fields ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_fields: internal all" ON public.deal_fields;
CREATE POLICY "deal_fields: internal all" ON public.deal_fields
  FOR ALL USING (public.is_staff());

-- ── activity_log: table dropped in 0042, skip ────────────────────────────

-- ── deal_ca ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_ca: internal all" ON public.deal_ca;
CREATE POLICY "deal_ca: internal all" ON public.deal_ca
  FOR ALL USING (public.is_staff());

-- ── sponsors ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sponsors: internal all" ON public.sponsors;
CREATE POLICY "sponsors: internal all" ON public.sponsors
  FOR ALL USING (public.is_staff());

-- ── google_connections ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "google_connections: internal all" ON public.google_connections;
CREATE POLICY "google_connections: internal all" ON public.google_connections
  FOR ALL USING (public.is_staff());

-- ── email_templates ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "email_templates: internal all" ON public.email_templates;
CREATE POLICY "email_templates: internal all" ON public.email_templates
  FOR ALL USING (public.is_staff());

-- ── email_attachments ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "email_attachments: internal all" ON public.email_attachments;
CREATE POLICY "email_attachments: internal all" ON public.email_attachments
  FOR ALL USING (public.is_staff());

-- ── snoozed_threads ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "snoozed_threads: internal all" ON public.snoozed_threads;
CREATE POLICY "snoozed_threads: internal all" ON public.snoozed_threads
  FOR ALL USING (public.is_staff());

-- 4. Create project_members table (must exist before projects policy) ------
CREATE TABLE public.project_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE(project_id, user_id)
);

CREATE INDEX project_members_project_idx ON public.project_members(project_id);
CREATE INDEX project_members_user_idx ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members: staff all" ON public.project_members
  FOR ALL USING (public.is_staff());

CREATE POLICY "project_members: internal sees own" ON public.project_members
  FOR SELECT USING (
    public.get_my_role() = 'internal'
    AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- 5. Update projects policy (project_members table now exists) -------------
DROP POLICY IF EXISTS "projects: internal all" ON public.projects;
CREATE POLICY "projects: internal all" ON public.projects
  FOR ALL USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  );

-- 6. Update get_pipeline_summary() to use is_staff() ----------------------
DROP FUNCTION IF EXISTS public.get_pipeline_summary();

CREATE OR REPLACE FUNCTION public.get_pipeline_summary()
RETURNS TABLE (
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
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    c.name,
    c.market,
    count(*) FILTER (WHERE d.stage = 'lead'),
    count(*) FILTER (WHERE e.status = 'sent'),
    count(*) FILTER (WHERE e.response_classification IN ('positive','neutral')),
    count(*) FILTER (WHERE d.stage IN ('underwriting','loi','closed','failed')),
    count(*) FILTER (WHERE d.score IN ('good','very_good')),
    count(*) FILTER (WHERE d.stage IN ('loi','closed')),
    count(*) FILTER (WHERE d.stage = 'closed'),
    count(*) FILTER (WHERE d.stage = 'failed')
  FROM public.deals d
  JOIN public.campaigns c ON c.id = d.campaign_id
  LEFT JOIN public.email_outreach e ON e.deal_id = d.id
  WHERE public.is_staff()
  GROUP BY c.id, c.name, c.market
$$;

-- 8. Backfill: assign existing internal users to all existing projects ----
DO $$
DECLARE
  v_internal_id uuid;
BEGIN
  FOR v_internal_id IN
    SELECT p.id FROM public.profiles p
    WHERE p.role = 'internal'
  LOOP
    INSERT INTO public.project_members (project_id, user_id)
    SELECT pr.id, v_internal_id
    FROM public.projects pr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = pr.id AND pm.user_id = v_internal_id
    );
  END LOOP;
END $$;

-- 9. Update handle_new_user() to support admin role -----------------------
-- Recreate the trigger function (idempotent — same logic, just recognizes
-- the new 'admin' enum value).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := COALESCE(
    (new.raw_user_meta_data->>'role')::public.user_role,
    (new.raw_app_meta_data->>'role')::public.user_role,
    'internal'
  );

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    v_role
  );

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', v_role::text)
  WHERE id = new.id;

  RETURN new;
END;
$$;

-- 10. Update debug_client_access() to show role info -----------------------
DROP FUNCTION IF EXISTS public.debug_client_access();
CREATE FUNCTION public.debug_client_access()
RETURNS TABLE(role text, is_staff boolean, sponsored_project_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    get_my_role()::text,
    public.is_staff(),
    array_agg(project_id)
  FROM public.sponsors
  WHERE user_id = auth.uid()
$$;


-- ── MIGRATION: 0047_fix_project_members_rls.sql ──
-- 0047: Drop recursive project_members RLS policy
-- The "internal sees own" policy had a self-referencing subquery:
--   EXISTS (SELECT 1 FROM public.project_members pm WHERE ...)
-- This triggers its own RLS evaluation → infinite recursion.
-- It's redundant anyway — "project_members: staff all" (is_staff())
-- already covers internal users fully.

DROP POLICY IF EXISTS "project_members: internal sees own" ON public.project_members;


-- ── MIGRATION: 0048_fix_projects_insert_rls.sql ──
-- 0048: Fix projects RLS — separate INSERT from SELECT/UPDATE/DELETE
-- The FOR ALL policy used an EXISTS(project_members) check that fails for
-- INSERT because no project_members row exists for a brand-new project.
-- Split into: INSERT (staff only, no membership check) and
-- SELECT/UPDATE/DELETE (admin OR internal with membership).

-- Drop the old combined policy
DROP POLICY IF EXISTS "projects: internal all" ON public.projects;

-- SELECT: admin sees all, internal sees assigned projects
CREATE POLICY "projects: select" ON public.projects
  FOR SELECT USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  );

-- INSERT: any staff user can create a project
CREATE POLICY "projects: insert" ON public.projects
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('admin', 'internal')
  );

-- UPDATE: same visibility as SELECT
CREATE POLICY "projects: update" ON public.projects
  FOR UPDATE USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  );

-- DELETE: same visibility as SELECT
CREATE POLICY "projects: delete" ON public.projects
  FOR DELETE USING (
    public.get_my_role() = 'admin'
    OR (
      public.get_my_role() = 'internal'
      AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
      )
    )
  );


-- ── MIGRATION: 0049_fix_handle_new_user.sql ──
-- 0049: Fix handle_new_user trigger to copy client_org and avatar_url, and backfill existing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := COALESCE(
    (new.raw_user_meta_data->>'role')::public.user_role,
    (new.raw_app_meta_data->>'role')::public.user_role,
    'internal'
  );

  INSERT INTO public.profiles (id, full_name, role, client_org, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    new.raw_user_meta_data->>'client_org',
    new.raw_user_meta_data->>'avatar_url'
  );

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', v_role::text)
  WHERE id = new.id;

  RETURN new;
END;
$$;

-- Backfill existing profiles with client_org and avatar_url from auth.users if available
UPDATE public.profiles p
SET client_org = u.raw_user_meta_data->>'client_org',
    avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url')
FROM auth.users u
WHERE p.id = u.id
  AND (u.raw_user_meta_data->>'client_org' IS NOT NULL OR u.raw_user_meta_data->>'avatar_url' IS NOT NULL);


-- ── MIGRATION: 0050_invitations.sql ──
-- 0050: Custom invitation system
-- Replaces supabase.auth.admin.inviteUserByEmail() with a branded invitation flow.
-- Admin creates an invite (email, role, optional project assignments, expiry).
-- Invitee receives a branded email and sets up their account (name + password).
-- Expired or used links show appropriate status pages.

-- 1. Invitation status enum
DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  role         public.user_role NOT NULL,
  token        text NOT NULL UNIQUE,
  status       public.invitation_status NOT NULL DEFAULT 'pending',
  project_ids  uuid[] DEFAULT '{}',
  invited_by   uuid NOT NULL REFERENCES auth.users(id),
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  accepted_by  uuid REFERENCES auth.users(id),
  message      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations(token);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations(email);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON public.invitations(status);

-- 4. RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Staff (internal + admin) can manage all invitations
CREATE POLICY "invitations: staff all" ON public.invitations
  FOR ALL USING (public.is_staff());

-- No public SELECT policy — public token validation uses admin client server-side
-- to avoid leaking invitation data through accidental anonymous queries.

-- 5. Updated_at trigger
DROP TRIGGER IF EXISTS trg_invitations_updated_at ON public.invitations;
CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ── MIGRATION: 0051_system_gmail.sql ──
-- 0051: System Gmail connection for transactional emails (invitations, etc.)
-- Extends google_connections with a connection_type column so the same Google
-- account can be used for both project-scoped email (type='project') and
-- system-level transactional email (type='system') as two separate rows.

-- 1. Add connection_type column
ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'project';

-- 2. Replace UNIQUE(google_email) with UNIQUE(google_email, connection_type)
ALTER TABLE public.google_connections
  DROP CONSTRAINT IF EXISTS google_connections_google_email_key;

ALTER TABLE public.google_connections
  ADD CONSTRAINT google_connections_google_email_connection_type_key
  UNIQUE(google_email, connection_type);


-- ── MIGRATION: 0052_password_resets.sql ──
-- 0052: Password reset system
-- Supports self-service password reset via branded email links.
-- Users request a reset → token generated → email sent via system Gmail →
-- user clicks link → sets new password.
-- All access via admin client server-side (no public RLS policies).

-- 1. Password resets table
CREATE TABLE IF NOT EXISTS public.password_resets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  token        text NOT NULL UNIQUE,
  used         boolean NOT NULL DEFAULT false,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS password_resets_token_idx ON public.password_resets(token);
CREATE INDEX IF NOT EXISTS password_resets_email_idx ON public.password_resets(email);

-- 3. RLS — all operations use admin client server-side (service role).
--    No user-facing RLS policies needed; the service role bypasses RLS.
--    We enable RLS to prevent accidental anonymous access via PostgREST,
--    but provide a catch-all policy for the service_role so PostgREST
--    does not reject queries on a table with RLS enabled and zero policies.
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "password_resets: service_role full access"
    ON public.password_resets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── MIGRATION: 0053_find_user_by_email.sql ──
-- 0053: Direct auth.users email lookup function
-- Replaces client-side listUsers() + .find() pattern which is fragile
-- (pagination, client-side filtering, O(n) over all users).
-- This function performs a single indexed lookup in auth.users.

CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text)
RETURNS TABLE (user_id uuid, user_email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id, email FROM auth.users WHERE email = p_email;
$$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO service_role;

-- Grant all privileges on all public schema objects to Supabase default roles
grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all functions in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;
