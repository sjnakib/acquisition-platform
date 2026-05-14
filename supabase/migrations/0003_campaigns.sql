create type public.listing_type as enum ('on_market', 'off_market');
create type public.deal_source  as enum ('direct', 'indirect');
create type public.email_template_key as enum ('outreach', 'thank_you', 'declination');

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
