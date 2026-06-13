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
