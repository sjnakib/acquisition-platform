-- 0025_hide_deal_name_units
-- Set show_in_grid = false for deal_name and unit_count so they don't appear
-- as columns in the Leads/Deals tables. Values remain in deal_fields for
-- detail views, imports, and programmatic access.

update public.field_definitions
set show_in_grid = false
where key in ('deal_name', 'unit_count')
  and show_in_grid = true;
