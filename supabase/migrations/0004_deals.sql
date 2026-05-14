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
