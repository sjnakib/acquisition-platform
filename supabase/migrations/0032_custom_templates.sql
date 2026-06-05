-- 0032: Custom email templates, field source tracking, email attachments

-- 1. Field source enum + column
create type public.field_source as enum ('system', 'import', 'manual');
alter table public.field_definitions
  add column source public.field_source not null default 'manual';

-- Mark known system fields
update public.field_definitions
  set source = 'system'
where key in (
  'address', 'city', 'state', 'zip', 'deal_name', 'unit_count',
  'property_type', 'building_class', 'year_built', 'property_link'
);

-- 2. Custom email templates (project-scoped)
create table public.email_templates (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  name             text not null,
  subject_template text not null default '',
  body_template    text not null default '',
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index email_templates_project_idx on public.email_templates(project_id);

alter table public.email_templates enable row level security;

create policy "email_templates: internal all" on public.email_templates
  for all using (public.get_my_role() = 'internal');

-- updated_at trigger
create trigger trg_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.update_updated_at();

-- 3. FK from campaigns to email_templates (backward compat with email_template enum)
alter table public.campaigns
  add column email_template_id uuid references public.email_templates(id) on delete set null;

-- 4. Email attachments
create table public.email_attachments (
  id               uuid primary key default gen_random_uuid(),
  email_outreach_id uuid references public.email_outreach(id) on delete cascade,
  filename         text not null,
  storage_path     text not null,
  size_bytes       bigint not null,
  mime_type        text not null,
  created_at       timestamptz not null default now()
);

alter table public.email_attachments enable row level security;

create policy "email_attachments: internal all" on public.email_attachments
  for all using (public.get_my_role() = 'internal');
