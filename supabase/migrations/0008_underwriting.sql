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
