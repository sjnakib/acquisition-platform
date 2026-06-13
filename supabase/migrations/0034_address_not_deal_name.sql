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
