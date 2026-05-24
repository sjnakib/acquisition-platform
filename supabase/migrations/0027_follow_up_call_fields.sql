-- Migration 0027: Add follow-up call fields to call_briefs
-- Adds contact_name, contact_role, phone_number for rich call entries

ALTER TABLE public.call_briefs
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS phone_number text;
