alter table public.profiles           enable row level security;
alter table public.campaigns          enable row level security;
alter table public.deals              enable row level security;
alter table public.contacts           enable row level security;
alter table public.email_outreach     enable row level security;
alter table public.document_checklist enable row level security;
alter table public.ca_credentials     enable row level security;
alter table public.underwriting       enable row level security;
alter table public.call_briefs        enable row level security;
alter table public.loi_records        enable row level security;
alter table public.loi_rounds         enable row level security;
alter table public.google_tokens      enable row level security;
alter table public.import_jobs        enable row level security;

create or replace function public.get_my_role()
returns public.user_role language sql stable security definer as $$
  select (auth.jwt()->>'role')::public.user_role
$$;

create policy "profiles: own row" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: internal sees all" on public.profiles
  for select using (public.get_my_role() = 'internal');

create policy "profiles: own update" on public.profiles
  for update using (id = auth.uid());

create policy "campaigns: internal all" on public.campaigns
  for all using (public.get_my_role() = 'internal');

create policy "deals: internal all" on public.deals
  for all using (public.get_my_role() = 'internal');

create policy "deals: client read good" on public.deals
  for select using (
    public.get_my_role() = 'client'
    and is_archived = false
    and score in ('good', 'very_good')
  );

create policy "contacts: internal all" on public.contacts
  for all using (public.get_my_role() = 'internal');

create policy "email_outreach: internal all" on public.email_outreach
  for all using (public.get_my_role() = 'internal');

create policy "document_checklist: internal all" on public.document_checklist
  for all using (public.get_my_role() = 'internal');

create policy "ca_credentials: internal all" on public.ca_credentials
  for all using (public.get_my_role() = 'internal');

create policy "underwriting: internal all" on public.underwriting
  for all using (public.get_my_role() = 'internal');

create policy "call_briefs: internal all" on public.call_briefs
  for all using (public.get_my_role() = 'internal');

create policy "call_briefs: client sees published" on public.call_briefs
  for select using (
    public.get_my_role() = 'client'
    and published = true
    and exists (
      select 1 from public.deals d
      where d.id = call_briefs.deal_id
        and d.is_archived = false
        and d.score in ('good', 'very_good')
    )
  );

create policy "call_briefs: client update notes" on public.call_briefs
  for update using (
    public.get_my_role() = 'client'
    and published = true
    and exists (
      select 1 from public.deals d
      where d.id = call_briefs.deal_id
        and d.is_archived = false
        and d.score in ('good', 'very_good')
    )
  )
  with check (
    public.get_my_role() = 'client'
    and published = true
  );

create policy "loi_records: internal all" on public.loi_records
  for all using (public.get_my_role() = 'internal');

create policy "loi_rounds: internal all" on public.loi_rounds
  for all using (public.get_my_role() = 'internal');

create policy "google_tokens: own row" on public.google_tokens
  for all using (user_id = auth.uid());

create policy "import_jobs: internal all" on public.import_jobs
  for all using (public.get_my_role() = 'internal');
