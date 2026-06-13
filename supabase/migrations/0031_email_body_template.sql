-- 0031: Add email_body_template to campaigns for mail-merge / mass email support
alter table public.campaigns
  add column email_body_template text;
