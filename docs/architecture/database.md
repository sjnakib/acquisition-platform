# Database & Security Architecture

The Acquisition Platform is heavily reliant on Supabase (PostgreSQL 14+). Security is enforced primarily at the database level using Row-Level Security (RLS) rather than standard backend controller logic.

## 1. Migration Strategy

The database schema is defined across 15 sequentially executed migrations located in `supabase/migrations/`.
*   **Extensions:** `pgcrypto` is used for UUID generation (`gen_random_uuid()`) and symmetric encryption (`pgp_sym_encrypt`). `pg_trgm` and `unaccent` are used for fuzzy text searching on deal names.
*   **Deployment:** `supabase migration up` is deprecated. Migrations are applied using `npx supabase db push`.

## 2. Core Entities & Schema

The schema contains robust structures for tracking real estate deals:

*   **`profiles`**: Linked to `auth.users(id)`. Stores `full_name`, `role`, `client_org`, and `avatar_url`.
*   **`campaigns`**: Outreach batches targeting specific regions (e.g., "NJ Q1 2026"). Stores target KPIs.
*   **`deals`**: The core entity. Tracks `property_type`, `unit_count`, `stage`, `score`, and CoStar `property_link`. Has a text search index using `to_tsvector`.
*   **`contacts`**: People linked to a deal. Supports multiple email addresses per contact.
*   **`email_outreach`**: Records sent emails. Tracks `gmail_message_id` and `gmail_thread_id` to correlate incoming replies from the Gmail API webhook.
*   **`document_checklist` & `ca_credentials`**: Tracks required diligence (P&L, Rent Rolls). `ca_credentials` stores login passwords for platforms like Buildout, heavily encrypted using the `DB_ENCRYPTION_KEY`.
*   **`underwriting`**: The financial engine. Tracks Market Cap Rate, calculates Market Delta %, IRR, and Cash-on-Cash returns.
*   **`call_briefs`**: Summaries curated by the internal team for the client to review before synchronous meetings.
*   **`loi_records` & `loi_rounds`**: State machines for tracking Letters of Intent, tracking counter-offers, parties, and outcomes (Deal Reached / Fallen Through).

## 3. JWT & Role Syncing

The application avoids `JOIN`ing the `profiles` table on every request. Instead, user roles are injected directly into the user's JWT.

**The `handle_new_user` Trigger:**
When a row is inserted into `auth.users`, a Postgres trigger fires. It creates the `profiles` row and synchronously updates `auth.users.raw_app_meta_data` to include the role. 
Because the role is in `app_metadata`, the Supabase API client automatically includes it in the JWT payload, making it instantly available in `req.auth` or `auth.jwt()` in Postgres.

## 4. Row-Level Security (RLS)

All tables have RLS enabled. The platform uses a custom Postgres helper function:
```sql
create or replace function public.get_my_role()
returns public.user_role language sql stable security definer as $$
  select (auth.jwt()->>'role')::public.user_role
$$;
```

### Internal Users
For almost all tables, Internal users have full access:
```sql
create policy "deals: internal all" on public.deals
  for all using (public.get_my_role() = 'internal');
```

### Client Users
Clients are severely restricted. They are not allowed to see the raw pipeline, low-quality deals, or unpolished internal notes.
*   **Deals:** Can only `SELECT` deals where `is_archived = false` AND `score in ('good', 'very_good')`.
*   **Call Briefs:** Can only `SELECT` briefs where `published = true` and the underlying deal is accessible. Clients are allowed to `UPDATE` call briefs, but a `WITH CHECK` clause ensures they can only modify `call_status` and `client_notes`, and cannot flip `published` back to false.
*   **Campaigns, Underwriting, Contacts:** Completely restricted (no policies allow access).

## 5. Security Definier Functions

Some calculations require aggregating data across tables the user shouldn't directly read. The platform uses `SECURITY DEFINER` functions for this.
*   **`get_pipeline_summary()`**: Calculates funnel metrics (leads, emails sent, responses, LOIs). It is hard-gated inside the function to return empty results if `get_my_role() != 'internal'`, preventing clients from bypassing RLS to view pipeline metrics.
*   **`store_ca_credential()`**: Takes a plaintext password via API, encrypts it securely using `pgp_sym_encrypt` and `DB_ENCRYPTION_KEY`, and stores the `bytea` ciphertext. This ensures passwords are never stored in plaintext and never leaked back to clients.
