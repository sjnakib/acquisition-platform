-- 0021_project_id_columns
-- Add project_id FK to all entity tables.

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS deals_project_idx ON public.deals(project_id);

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS campaigns_project_idx ON public.campaigns(project_id);

ALTER TABLE public.portfolios ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS portfolios_project_idx ON public.portfolios(project_id);

ALTER TABLE public.field_definitions ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS field_definitions_project_idx ON public.field_definitions(project_id);

-- field_definitions.key uniqueness becomes per-project instead of global
ALTER TABLE public.field_definitions DROP CONSTRAINT IF EXISTS field_definitions_key_key;
ALTER TABLE public.field_definitions ADD CONSTRAINT field_definitions_key_project_unique UNIQUE (key, project_id);

ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS import_jobs_project_idx ON public.import_jobs(project_id);
