-- 0023_backfill_deals_project_id
-- Backfill project_id on deals and import_jobs where currently NULL.
-- Fixes bug where imported leads inherited no project_id and were invisible
-- in project-scoped campaign views.

UPDATE public.deals
SET project_id = campaigns.project_id
FROM public.campaigns
WHERE deals.campaign_id = campaigns.id
  AND deals.project_id IS NULL;

UPDATE public.import_jobs
SET project_id = campaigns.project_id
FROM public.campaigns
WHERE import_jobs.campaign_id = campaigns.id
  AND import_jobs.project_id IS NULL;
