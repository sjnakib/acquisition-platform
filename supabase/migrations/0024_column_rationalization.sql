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
