-- 0047: Drop recursive project_members RLS policy
-- The "internal sees own" policy had a self-referencing subquery:
--   EXISTS (SELECT 1 FROM public.project_members pm WHERE ...)
-- This triggers its own RLS evaluation → infinite recursion.
-- It's redundant anyway — "project_members: staff all" (is_staff())
-- already covers internal users fully.

DROP POLICY IF EXISTS "project_members: internal sees own" ON public.project_members;
