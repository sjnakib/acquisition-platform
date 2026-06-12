-- 0043: Portfolios as deals
-- Add is_portfolio flag to deals and portfolio_deal_id FK to portfolios.
-- This allows portfolios to have a linked deal record that carries all
-- deal behaviors (stage, emails, underwriting, LOI, calls, drive folders).

-- 1. Add is_portfolio flag to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_portfolio boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS deals_is_portfolio_idx ON public.deals(is_portfolio);

-- 2. Link portfolios to their deal record
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS portfolio_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS portfolios_portfolio_deal_idx ON public.portfolios(portfolio_deal_id);
