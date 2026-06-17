-- ═══ Atomic drive_file_count operations ═══
-- Replaces non-atomic read-then-write pattern with true atomic increment/decrement.
-- Used by drive files API routes to maintain accurate file counts.

CREATE OR REPLACE FUNCTION increment_drive_file_count(p_deal_id uuid, p_delta int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE deals
  SET drive_file_count = GREATEST(COALESCE(drive_file_count, 0) + p_delta, 0)
  WHERE id = p_deal_id;
$$;

-- Grant execute to authenticated users (RLS on deals table is bypassed via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION increment_drive_file_count(uuid, int) TO authenticated;
