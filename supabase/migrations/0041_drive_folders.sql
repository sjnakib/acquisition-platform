-- 0041: Add Google Drive working folder to projects and drive_folder_id to deals
-- Supports per-project Drive folder for document management

-- Add working folder columns to projects
alter table public.projects
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_folder_url text;

-- Add explicit folder ID to deals (complement existing drive_folder_url)
alter table public.deals
  add column if not exists drive_folder_id text;
