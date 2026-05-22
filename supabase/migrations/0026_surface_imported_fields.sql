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
