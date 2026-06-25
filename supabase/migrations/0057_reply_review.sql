-- Add reply review columns to email_outreach
-- Supports the reply-review-flow: webhook detects reply → needs_review=true → human confirms/dismisses/snoozes

ALTER TABLE public.email_outreach
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- Index for efficiently finding pending reviews per deal
CREATE INDEX IF NOT EXISTS email_outreach_needs_review_idx
  ON public.email_outreach(deal_id, needs_review)
  WHERE needs_review = true;
