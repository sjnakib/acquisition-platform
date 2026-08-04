# Database & Security Architecture

The **Acquire Platform** relies on Supabase PostgreSQL (14+). Security and access control are enforced natively at the database layer using Row-Level Security (RLS), custom Postgres functions, triggers, and JWT app metadata claims.

---

## 1. Migration Strategy

The database schema is defined across 53 sequential migration steps flattened into `supabase/migrations/0001_initial_schema.sql`.
*   **Extensions**:
    *   `pgcrypto`: Used for UUID primary keys (`gen_random_uuid()`) and symmetric credential encryption (`pgp_sym_encrypt`).
    *   `pg_trgm` & `unaccent`: Used for trigram index matching and unaccented fuzzy search on projects and dynamic deal fields.
*   **Deployment**: Migrations are applied using `npx supabase db push` (or `npm run db:push:local` for local Docker development).

---

## 2. Core Tables & Schema Reference

| Table Name | Primary Purpose | Foreign Key Relationships |
| :--- | :--- | :--- |
| `projects` | Top-level workspace container | `google_connection_id` -> `google_connections(id)` |
| `profiles` | User profile data | `id` -> `auth.users(id)` |
| `project_members` | Internal team membership | `project_id` -> `projects(id)`, `user_id` -> `auth.users(id)` |
| `sponsors` | Client sponsor membership | `project_id` -> `projects(id)`, `user_id` -> `auth.users(id)` |
| `invitations` | Branded user invitation tokens | `invited_by` -> `auth.users(id)`, `accepted_by` -> `auth.users(id)` |
| `password_resets` | Password reset tokens | None (Service Role lookup by email) |
| `campaigns` | Region/market outreach campaign | `project_id` -> `projects(id)`, `email_template_id` -> `email_templates(id)` |
| `portfolios` | Grouping of deals | `project_id` -> `projects(id)`, `portfolio_deal_id` -> `deals(id)` |
| `deals` | Pipeline deal records | `project_id` -> `projects(id)`, `campaign_id` -> `campaigns(id)`, `portfolio_id` -> `portfolios(id)` |
| `field_definitions` | Dynamic EAV field schema registry | `project_id` -> `projects(id)` |
| `deal_fields` | Dynamic field values per deal | `deal_id` -> `deals(id)`, `field_id` -> `field_definitions(id)` |
| `contacts` | Brokers & sellers attached to deals | `deal_id` -> `deals(id)` |
| `email_outreach` | Outreach logs & Gmail thread IDs | `deal_id` -> `deals(id)`, `contact_id` -> `contacts(id)` |
| `snoozed_threads` | Snoozed Gmail threads | `project_id` -> `projects(id)`, `deal_id` -> `deals(id)` |
| `email_templates` | Project mail merge templates | `project_id` -> `projects(id)` |
| `email_attachments` | Outreach email file attachments | `email_outreach_id` -> `email_outreach(id)` |
| `document_checklist` | Flexible deal document checklist | `deal_id` -> `deals(id)` |
| `deal_ca` & `ca_credentials` | CA status & encrypted credentials | `deal_id` -> `deals(id)`, `ca_credential_id` -> `ca_credentials(id)` |
| `underwriting` | Financial metrics & 2-tier approvals | `deal_id` -> `deals(id)`, `uw_analyst_id`, `reviewer_1_id`, `reviewer_2_id` -> `profiles(id)` |
| `loi_records` & `loi_rounds` | LOI tracking & counter-offer rounds | `deal_id` -> `deals(id)`, `loi_id` -> `loi_records(id)` |
| `call_briefs` | Sponsor call queue & client notes | `deal_id` -> `deals(id)`, `flagged_by` -> `profiles(id)` |
| `google_connections` | OAuth tokens for Gmail/Drive | Unique on `(google_email, connection_type)` |
| `import_jobs` | CoStar import job status & mappings | `project_id` -> `projects(id)`, `campaign_id` -> `campaigns(id)` |

---

## 3. Custom Role Claims & Trigger Functions

The system synchronizes user roles directly into JWT app metadata to avoid extra `JOIN` queries on `public.profiles`.

### A. New User Registration Trigger (`handle_new_user`)
When a user is created in `auth.users`, a trigger automatically populates `public.profiles` and updates `auth.users.raw_app_meta_data`:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare v_role public.user_role;
begin
  v_role := coalesce(
    (new.raw_user_meta_data->>'role')::public.user_role,
    (new.raw_app_meta_data->>'role')::public.user_role,
    'internal'
  );

  insert into public.profiles (id, full_name, role, client_org, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role,
    new.raw_user_meta_data->>'client_org',
    new.raw_user_meta_data->>'avatar_url'
  );

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', v_role::text)
  where id = new.id;

  return new;
end;
$$;
```

---

## 4. Row-Level Security (RLS) Policy Matrix

Row-Level Security is enabled on every table. Access is determined by two security helper functions:
*   `public.get_my_role()`: Returns custom role (`'admin'`, `'internal'`, `'client'`).
*   `public.is_staff()`: Returns `true` if role is `'admin'` or `'internal'`.

### Policy Matrix Overview:

```sql
-- Staff Helper Policy (Admin & Internal Members)
create policy "deals: internal all" on public.deals
  for all using (public.is_staff());

-- Client Policy (Filtered by Project Membership via Sponsors)
create policy "deals: client read good" on public.deals
  for select using (
    public.get_my_role() = 'client'
    and is_archived = false
    and exists (
      select 1 from public.sponsors
      where sponsors.project_id = deals.project_id
      and sponsors.user_id = auth.uid()
    )
  );

-- Call Briefs Client Policy (Allows Updating Notes Only)
create policy "call_briefs: client update notes" on public.call_briefs
  for update using (
    public.get_my_role() = 'client'
    and published = true
    and exists (
      select 1 from public.deals d
      join public.sponsors s on s.project_id = d.project_id and s.user_id = auth.uid()
      where d.id = call_briefs.deal_id and d.is_archived = false
    )
  );
```

---

## 5. Security Definer Stored Functions

1.  **`get_pipeline_summary()`**: Aggregates pipeline counts across campaigns. Gated to staff (`WHERE public.is_staff()`).
2.  **`get_recent_projects(p_limit int)`**: Returns projects ordered by recent access timestamps from `project_access`.
3.  **`store_ca_credential(p_platform, p_username, p_password, p_encryption_key)`**: Encrypts sensitive platform passwords using `pgp_sym_encrypt`.
4.  **`find_user_by_email(p_email)`**: Performs indexed lookup in `auth.users` for password resets and invitation checks.
