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
