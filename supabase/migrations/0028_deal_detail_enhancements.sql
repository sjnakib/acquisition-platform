-- Migration 0028: Deal detail page enhancements
-- Re-adds dropped underwriting screening columns + adds LOI tracking fields

-- ── Underwriting: re-add dropped screening columns ───────────────────

ALTER TABLE public.underwriting
  ADD COLUMN IF NOT EXISTS rent_growth_12mo_pct     numeric(6,3),
  ADD COLUMN IF NOT EXISTS rent_growth_forecast_pct numeric(6,3),
  ADD COLUMN IF NOT EXISTS sale_rent_comps           text;

-- ── LOI records: add document tracking and email fields ──────────────

ALTER TABLE public.loi_records
  ADD COLUMN IF NOT EXISTS insurance_declarations    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_service_contracts  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS utility_bills             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loi_email                 text,
  ADD COLUMN IF NOT EXISTS last_loi_email_sent_at    timestamptz;
