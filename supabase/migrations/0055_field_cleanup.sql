-- 0055_field_cleanup
-- Unifies field storage: financial/underwriting fields → underwriting table only,
-- system fields → deals table only, imported property fields → deal_fields only.
-- Removes redundant LOI columns, stale document checklist items, and unused fields.

-- ═══ Part 1: Clean field_definitions — remove keys that belong to other tables ═══

-- These keys correspond to columns in underwriting, loi_records, or deals tables.
-- Deleting from field_definitions cascades to deal_fields (ON DELETE CASCADE),
-- ensuring no orphaned deal_fields rows remain.
DELETE FROM public.field_definitions
WHERE key IN (
  -- Underwriting table fields
  'asking_price', 'price_per_unit', 'purchase_price', 'purchase_price_per_unit',
  'capex', 'capex_per_unit', 'irr', 'irr_pct', 'equity_multiple', 'em',
  'cash_on_cash', 'coc', 'cash_on_cash_pct', 'profit', 'projected_profit',
  'occupancy', 'occupancy_pct', 'proceed_with_loi', 'loi_recommendation',
  'underwritability', 'underwritability_status', 'screened_at',
  'population_1mi', 'population_growth_pct', 'rent_growth_12mo_pct',
  'rent_growth_forecast_pct', 'rent_growth_fwd_pct', 'vacancy_rate_pct',
  'market_price_per_unit', 'delta_pct', 'cap_rate', 'sale_rent_comps',
  'uw_notes', 'uw_analyst', 'screened_by',
  -- LOI table fields
  'offered_price', 'final_price', 'close_date', 'loi_outcome', 'outcome',
  'fallen_through_reason', 'fallen_through_date',
  'insurance_declarations', 'vendor_service_contracts', 'utility_bills',
  'email_for_loi', 'loi_email', 'last_email_for_loi_sent_on', 'last_loi_email_sent_at',
  'loi_status',
  -- System fields on deals table
  'stage', 'score', 'portfolio', 'portfolio_id', 'created_at', 'date_added',
  'last_email_sent_on', 'response_type', 'drive_folder_url', 'drive_folder_id',
  'drive_file_count', 'outreach_emails', 'is_portfolio', 'is_archived',
  -- Document checklist / removed fields
  'pl', 'pl_date', 'rent_roll', 'rent_roll_date', 'om', 'tax_bill',
  'capex_schedule', 'market_report', 'market_reports', 'deal_room_link',
  'docs_count'
);

-- ═══ Part 2: Add drive_file_count to deals ═══

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS drive_file_count integer;

-- ═══ Part 3: Consolidate LOI email columns ═══

-- Backfill: copy old email_for_loi → loi_email where loi_email is null
UPDATE public.loi_records
SET loi_email = email_for_loi
WHERE email_for_loi IS NOT NULL AND (loi_email IS NULL OR loi_email = '');

-- Backfill: copy old last_email_for_loi_sent_on → last_loi_email_sent_at
UPDATE public.loi_records
SET last_loi_email_sent_at = last_email_for_loi_sent_on
WHERE last_email_for_loi_sent_on IS NOT NULL AND last_loi_email_sent_at IS NULL;

-- Drop redundant columns (added by uncoordinated migrations 0024 and 0028)
ALTER TABLE public.loi_records
  DROP COLUMN IF EXISTS email_for_loi,
  DROP COLUMN IF EXISTS last_email_for_loi_sent_on;

-- ═══ Part 4: Remove diligence checklist columns from loi_records ═══

ALTER TABLE public.loi_records
  DROP COLUMN IF EXISTS insurance_declarations,
  DROP COLUMN IF EXISTS vendor_service_contracts,
  DROP COLUMN IF EXISTS utility_bills;

-- ═══ Part 5: Drop sale_rent_comps from underwriting ═══

ALTER TABLE public.underwriting
  DROP COLUMN IF EXISTS sale_rent_comps;

-- ═══ Part 6: Rename proceed_with_loi → loi_recommendation ═══

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'underwriting'
      AND column_name = 'proceed_with_loi'
  ) THEN
    ALTER TABLE public.underwriting RENAME COLUMN proceed_with_loi TO loi_recommendation;
  END IF;
END $$;

-- ═══ Part 7: Update seed_default_checklist — remove stale doc items ═══

CREATE OR REPLACE FUNCTION public.seed_default_checklist(p_deal_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  items text[] := ARRAY['Deal Room Link'];
  d text; i int := 0;
BEGIN
  FOREACH d IN ARRAY items LOOP
    INSERT INTO public.document_checklist (deal_id, doc_name, sort_order)
    VALUES (p_deal_id, d, i);
    i := i + 10;
  END LOOP;
END;
$$;
