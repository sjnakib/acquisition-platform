# Acquire — Multifamily Property Acquisition Platform
## Comprehensive Technical Specification & System Architecture (v2.5)

> **Document Status**: Production Reference Architecture  
> **Target Audience**: Core Engineering Team, AI Coding Agents, System Architects  
> **Stack**: Next.js 16.2.6 (App Router) · React 19 · TypeScript 5 · Supabase PostgreSQL (RLS) · Cloudflare Turnstile · Upstash Redis · Google Gmail API · Google Drive API · Google People API  

---

## 1. System Overview & Architecture

### 1.1 Platform Mission & Objectives
**Acquire** is an enterprise-grade, multi-tenant acquisition management platform built for commercial real estate acquisition teams, brokers, and investment sponsors. It streamlines the lifecycle of multifamily real estate transactions from raw lead ingestion (e.g. CoStar CSV/Excel exports) through automated Gmail outreach, underwritability evaluation, financial underwriting with multi-tier approvals, LOI negotiations, document checklist collection, and Google Drive file repository management.

The platform provides a role-based dual experience:
1. **Internal Execution Portal**: For acquisition teams and underwriters to manage campaigns, run bulk imports, send outreach, execute underwriting, handle LOI counter-offers, and manage project files.
2. **Client Sponsor Portal**: For external investors and client sponsors to monitor active pipeline deals, access published call briefs, and leave notes on scheduled calls for sponsored projects.

---

### 1.2 Multi-Tenant / Multi-Project Workspace Model
All platform data and workflows are strictly scoped to **Projects** (`public.projects`). 
- A **Project** represents a distinct investment fund, target market campaign group, or client portfolio.
- **Internal Team Members** and **Admins** can belong to one or more projects via `public.project_members`.
- **Client Sponsors** are mapped to specific projects via `public.sponsors`.
- **Database Row-Level Security (RLS)** enforces strict project isolation so client users can never view deals or files from projects they do not sponsor.

```
                    ┌─────────────────────────────────────────┐
                    │               Admin User                │
                    │   (Full System Control, All Projects)   │
                    └───────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────┴─────────────────────┐
                    │            Project (Workspace)          │
                    │  (Google Connection, Drive Workspace)   │
                    └─────────┬─────────────────────┬─────────┘
                              │                     │
      ┌───────────────────────┴──────┐       ┌──────┴───────────────────────┐
      │     Internal Team Member     │       │        Client Sponsor        │
      │  (Assigned via project_members)│       │    (Assigned via sponsors)    │
      └──────────────┬───────────────┘       └──────────────┬───────────────┘
                     │                                      │
     ┌───────────────┴───────────────┐       ┌──────────────┴───────────────┐
     │ Full Pipeline & File Control  │       │ Read-Only Active Pipeline &   │
     │  (All 8 Stages, UW, LOI, etc) │       │  Published Call Brief Notes  │
     └───────────────────────────────┘       └──────────────────────────────┘
```

---

### 1.3 Technology Stack Breakdown

| Layer | Component | Technology / Library | Version / Details |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Web App Core | Next.js (App Router) | `16.2.6` (React `19.2.4`) |
| **Language** | Type Safety | TypeScript | `^5.0.0` |
| **Styling & Icons** | CSS System | Tailwind CSS v4, Vanilla CSS variables | `@tailwindcss/postcss ^4`, `lucide-react ^0.460` |
| **State & Data Fetching** | Server State Management | TanStack React Query v5 | `@tanstack/react-query ^5.100` |
| **Data Grid & Virtualization** | High-Volume Tables | TanStack React Virtual | `@tanstack/react-virtual ^3.13` |
| **Form Validation** | Form Schemas | React Hook Form, Zod | `react-hook-form ^7.75`, `zod ^3.25` |
| **Database & Auth** | Database & RLS | Supabase PostgreSQL, SSR client | `@supabase/ssr ^0.5`, `@supabase/supabase-js ^2.105` |
| **Rate Limiting & Cache** | API Protection | Upstash Redis | `@upstash/redis ^1.38`, `@upstash/ratelimit ^2.0` |
| **Bot Protection** | Captcha Validation | Cloudflare Turnstile | `react-turnstile ^1.1` |
| **Email & Contacts** | Mail Templates & APIs | React Email, Gmail API v1, People API v1 | `@react-email/components`, `googleapis ^140.0` |
| **Cloud Storage** | Workspace & Deal Files | Google Drive API v3, Supabase Storage | `googleapis ^140.0`, `email-attachments` bucket |
| **Data Import & Export** | File Parsing & Exports | PapaParse (CSV), ExcelJS | `papaparse ^5.5`, `exceljs ^4.4` |
| **Testing** | Unit & Property Tests | Vitest, Fast-Check | `vitest ^4.1`, `fast-check ^4.8` |

---

## 2. Database Schema & Data Model Reference

The platform database is powered by Supabase PostgreSQL with 53 migration steps consolidated into `supabase/migrations/0001_initial_schema.sql`.

### 2.1 Enum Types

```sql
create type public.user_role as enum ('internal', 'client', 'admin');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.deal_stage as enum ('lead', 'outreach', 'response', 'underwriting', 'loi', 'closed', 'failed', 'archived');
create type public.deal_score as enum ('very_good', 'good', 'bad', 'very_bad');
create type public.listing_type as enum ('on_market', 'off_market');
create type public.deal_source as enum ('direct', 'indirect');
create type public.email_template_key as enum ('outreach', 'thank_you', 'declination', 'custom');
create type public.email_status as enum ('not_sent', 'sent', 'invalid_address', 'gmail_error', 'replied');
create type public.response_classification as enum ('positive', 'neutral', 'negative', 'no_response');
create type public.ca_status as enum ('not_required', 'pending', 'signed', 'approved');
create type public.underwritability as enum ('go', 'no_go', 'maybe');
create type public.call_status as enum ('pending', 'completed', 'cancelled');
create type public.loi_outcome as enum ('in_progress', 'deal_reached', 'fallen_through');
create type public.field_data_type as enum ('text', 'number', 'integer', 'date', 'boolean', 'url', 'currency');
create type public.field_source as enum ('system', 'import', 'manual');
```

---

### 2.2 Table Schemas

#### `projects`
Top-level workspace container for all platform operations.
```sql
create table public.projects (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text,
  google_connection_id uuid references public.google_connections(id) on delete set null,
  google_drive_folder_id text,
  google_drive_folder_url text,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
```

#### `profiles`
User metadata extending `auth.users`.
```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       public.user_role not null default 'internal',
  client_org text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `project_members`
Links internal team members to specific projects.
```sql
create table public.project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique(project_id, user_id)
);
```

#### `sponsors`
Links client/sponsor users to specific projects for access control.
```sql
create table public.sponsors (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);
```

#### `invitations`
Branded user invitation tokens.
```sql
create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  role         public.user_role not null,
  token        text not null unique,
  status       public.invitation_status not null default 'pending',
  project_ids  uuid[] default '{}',
  invited_by   uuid not null references auth.users(id),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id),
  message      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

#### `password_resets`
Self-service password reset tokens.
```sql
create table public.password_resets (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  token      text not null unique,
  used       boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
```

#### `campaigns`
Outreach campaign groupings within a project.
```sql
create table public.campaigns (
  id                       uuid primary key default gen_random_uuid(),
  project_id               uuid references public.projects(id) on delete cascade,
  name                     text not null,
  market                   text not null,
  listing_type             public.listing_type,
  email_template           public.email_template_key,
  email_template_id        uuid references public.email_templates(id) on delete set null,
  email_subject_template   text,
  email_body_template      text,
  target_response_rate_pct numeric(5,2),
  target_loi_count         int,
  is_active                boolean not null default true,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
```

#### `portfolios`
Grouping of properties, linked to a synthetic deal record for full pipeline feature parity.
```sql
create table public.portfolios (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects(id) on delete cascade,
  name              text not null,
  description       text,
  portfolio_deal_id uuid references public.deals(id) on delete set null,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

#### `deals`
Core pipeline record representing property leads and portfolio entities.
```sql
create table public.deals (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references public.projects(id) on delete cascade,
  campaign_id         uuid references public.campaigns(id) on delete set null,
  portfolio_id        uuid references public.portfolios(id) on delete set null,
  is_portfolio        boolean not null default false,
  stage               public.deal_stage not null default 'lead',
  score               public.deal_score,
  is_archived         boolean not null default false,
  archive_reason      text,
  drive_folder_id     text,
  drive_folder_url    text,
  outreach_emails     text[] not null default '{}',
  last_email_sent_on  timestamptz,
  last_contacted_at   timestamptz,
  response_type       text,
  internal_notes      text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

#### `field_definitions`
Schema registry for dynamic Entity-Attribute-Value (EAV) fields per project.
```sql
create table public.field_definitions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects(id) on delete cascade,
  key          text not null,
  label        text not null,
  data_type    public.field_data_type not null default 'text',
  source       public.field_source not null default 'manual',
  sort_order   int not null default 100,
  show_in_grid boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint field_definitions_key_project_unique unique (key, project_id)
);
```

#### `deal_fields`
Values for dynamic fields associated with a deal.
```sql
create table public.deal_fields (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deals(id) on delete cascade,
  field_id   uuid not null references public.field_definitions(id) on delete cascade,
  value      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, field_id)
);
```

#### `contacts`
Contact records (brokers, sellers) attached to a deal.
```sql
create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  name         text,
  company      text,
  title        text,
  email        text[],
  phone_office text,
  phone_cell   text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);
```

#### `email_outreach`
Outreach tracking and Gmail thread reference per deal contact.
```sql
create table public.email_outreach (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references public.deals(id) on delete cascade,
  contact_id              uuid references public.contacts(id) on delete set null,
  status                  public.email_status not null default 'not_sent',
  sent_at                 timestamptz,
  subject                 text,
  template_used           public.email_template_key,
  gmail_message_id        text,
  gmail_thread_id         text,
  error_message           text,
  response_classification public.response_classification,
  responded_at            timestamptz,
  conversation_log        text,
  thank_you_sent          boolean not null default false,
  thank_you_sent_at       timestamptz,
  declination_sent        boolean not null default false,
  declination_sent_at     timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
```

#### `snoozed_threads`
Gmail threads snoozed until a future timestamp within a project.
```sql
create table public.snoozed_threads (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  deal_id       uuid not null references public.deals(id) on delete cascade,
  thread_id     text not null,
  snoozed_until timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(project_id, thread_id)
);
```

#### `email_templates`
Custom mail merge templates scoped to a project.
```sql
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
```

#### `email_attachments`
File attachments associated with an outreach email.
```sql
create table public.email_attachments (
  id                uuid primary key default gen_random_uuid(),
  email_outreach_id uuid references public.email_outreach(id) on delete cascade,
  filename          text not null,
  storage_path      text not null,
  size_bytes        bigint not null,
  mime_type         text not null,
  created_at        timestamptz not null default now()
);
```

#### `document_checklist`
Flexible document checklist items per deal.
```sql
create table public.document_checklist (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deals(id) on delete cascade,
  doc_name   text,
  collected  boolean not null default false,
  metadata   jsonb not null default '{}'::jsonb,
  sort_order int not null default 100,
  updated_at timestamptz not null default now(),
  unique(deal_id, doc_name)
);
```

#### `deal_ca` & `ca_credentials`
Confidentiality Agreement (CA) status and platform credential vault.
```sql
create table public.ca_credentials (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null,
  username           text,
  password_encrypted bytea,
  notes              text,
  created_at         timestamptz not null default now()
);

create table public.deal_ca (
  deal_id          uuid primary key references public.deals(id) on delete cascade,
  ca_status        public.ca_status not null default 'not_required',
  ca_platform      text,
  ca_credential_id uuid references public.ca_credentials(id) on delete set null,
  updated_at       timestamptz not null default now()
);
```

#### `underwriting`
Comprehensive financial underwriting metrics and 2-tier approval workflow.
```sql
create table public.underwriting (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references public.deals(id) on delete cascade,
  underwritability_status public.underwritability,
  screened_at             timestamptz,
  screened_by             uuid references public.profiles(id),
  asking_price            numeric(15,2),
  price_per_unit          numeric(12,2),
  population_1mi          int,
  population_growth_pct   numeric(6,3),
  rent_growth_12mo_pct    numeric(6,3),
  rent_growth_forecast_pct numeric(6,3),
  vacancy_rate_pct        numeric(6,3),
  market_price_per_unit   numeric(12,2),
  delta_pct               numeric(6,3),
  cap_rate                numeric(6,3),
  sale_rent_comps         text,
  purchase_price          numeric(15,2),
  purchase_price_per_unit numeric(12,2),
  capex                   numeric(15,2),
  capex_per_unit          numeric(12,2),
  irr_pct                 numeric(6,3),
  equity_multiple         numeric(6,3),
  cash_on_cash_pct        numeric(6,3),
  profit                  numeric(15,2),
  occupancy_pct           numeric(6,3),
  uw_notes                text,
  proceed_with_loi        boolean,
  uw_analyst_id           uuid references public.profiles(id),
  uw_completion_date      date,
  reviewer_1_id           uuid references public.profiles(id),
  review_1_date           date,
  reviewer_2_id           uuid references public.profiles(id),
  review_2_date           date,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(deal_id)
);
```

#### `loi_records` & `loi_rounds`
Letter of Intent (LOI) submission tracking and multi-round negotiation counter-offers.
```sql
create table public.loi_records (
  id                        uuid primary key default gen_random_uuid(),
  deal_id                   uuid not null references public.deals(id) on delete cascade,
  submitted_at              date,
  offered_price             numeric(15,2),
  outcome                   public.loi_outcome not null default 'in_progress',
  final_price               numeric(15,2),
  close_date                date,
  fallen_through_reason     text,
  fallen_through_date       date,
  insurance_declarations    boolean not null default false,
  vendor_service_contracts boolean not null default false,
  utility_bills             boolean not null default false,
  loi_email                 text,
  last_loi_email_sent_at    timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique(deal_id)
);

create table public.loi_rounds (
  id          uuid primary key default gen_random_uuid(),
  loi_id      uuid not null references public.loi_records(id) on delete cascade,
  round_num   int not null,
  price       numeric(15,2),
  party       text check (party in ('buyer', 'seller')),
  round_date  date,
  notes       text,
  created_at  timestamptz not null default now()
);
```

#### `call_briefs`
Scheduled sponsor call queue entries and client notes.
```sql
create table public.call_briefs (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  contact_name text,
  contact_role text,
  phone_number text,
  summary_text text,
  published    boolean not null default false,
  published_at timestamptz,
  call_status  public.call_status not null default 'pending',
  completed_at timestamptz,
  client_notes text,
  flagged_by   uuid references public.profiles(id),
  flagged_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

#### `google_connections`
OAuth tokens for project-level email/drive integration and system transactional email.
```sql
create table public.google_connections (
  id              uuid primary key default gen_random_uuid(),
  google_email    text not null,
  connection_type text not null default 'project', -- 'project' or 'system'
  access_token    text not null,
  refresh_token   text,
  token_type      text,
  expiry          timestamptz,
  scopes          text[],
  last_history_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(google_email, connection_type)
);
```

#### `import_jobs`
CoStar import batch job status and mapping metadata.
```sql
create table public.import_jobs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references public.projects(id) on delete cascade,
  campaign_id    uuid references public.campaigns(id) on delete set null,
  portfolio_id   uuid references public.portfolios(id) on delete set null,
  user_id        uuid references auth.users(id) on delete set null,
  total_rows     int not null default 0,
  inserted       int not null default 0,
  skipped        int not null default 0,
  status         text not null default 'pending' check (status in ('pending', 'mapping', 'running', 'done', 'failed')),
  source_headers text[] not null default '{}',
  column_mapping jsonb not null default '{}'::jsonb,
  error_log      text[],
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

---

## 3. Security Architecture, RLS & Rate Limiting

### 3.1 Role Verification Functions
- `public.get_my_role()`: Extracts custom user role from JWT token (`app_metadata.role` or `user_metadata.role`).
- `public.is_staff()`: Evaluates to `true` if current user role is either `'internal'` or `'admin'`.

```sql
create or replace function public.is_staff()
returns boolean language sql stable security definer as $$
  select public.get_my_role() in ('internal', 'admin');
$$;
```

---

### 3.2 Access Control Matrix Summary

| Table | Admin (`admin`) | Internal Member (`internal`) | Client Sponsor (`client`) | Service Role / Unauthed |
| :--- | :--- | :--- | :--- | :--- |
| `projects` | Full Access (All Projects) | Full Access (Assigned via `project_members`) | SELECT (Sponsored via `sponsors`) | Denied |
| `project_members` | Full Access | Full Access | Denied | Denied |
| `sponsors` | Full Access | Full Access | SELECT (Own row only) | Denied |
| `deals` | Full Access | Full Access | SELECT (Non-archived deals in sponsored projects) | Denied |
| `field_definitions` | Full Access | Full Access | SELECT (Global null project OR sponsored projects) | Denied |
| `deal_fields` | Full Access | Full Access | SELECT (Visible deals in sponsored projects) | Denied |
| `contacts` | Full Access | Full Access | SELECT (Visible deals in sponsored projects) | Denied |
| `call_briefs` | Full Access | Full Access | SELECT & UPDATE notes (Published briefs for visible deals) | Denied |
| `google_connections`| Full Access | Full Access | Denied | Denied |
| `invitations` | Full Access | Full Access | Denied | Server API / Service Role |
| `password_resets` | Service Role Only | Service Role Only | Service Role Only | Server API / Service Role |

---

### 3.3 Rate Limiting & Bot Protection (`src/lib/rate-limit.ts`, `src/lib/turnstile.ts`)
- **Cloudflare Turnstile**: `verifyTurnstile(token, ip)` validates bot protection tokens on `/api/auth/login` and `/api/auth/reset-password`.
- **Upstash Redis Rate Limiters**:
  - `loginRateLimit`: 5 requests per 5 minutes per IP (`rl:login`).
  - `passwordResetRateLimit`: 3 requests per 1 minute per IP (`rl:pw-reset`).
  - `emailSendRateLimit`: 100 outreach emails per 1 day per user (`rl:email`).

---

## 4. Authentication, User Management & Email Subsystem

### 4.1 Account Lifecycle & Custom Invitations
- Standard Supabase signup is controlled via branded invitation tokens (`/invite/[token]`).
- Administrators create invitations via `/api/admin/invitations`. An invitation record is stored in `public.invitations` containing target `email`, assigned `role`, expiration timestamp, optional project assignments (`project_ids`), and a unique secure random `token`.
- An invitation email is rendered using `@react-email` and sent via the **System Gmail Connection** (`connection_type='system'`).
- The invitee accepts the invite at `/invite/[token]`, setting their `full_name` and `password`. The system creates the user in `auth.users` via Supabase Admin Client, sets `raw_app_meta_data.role`, populates `public.profiles`, and auto-creates `public.project_members` or `public.sponsors` entries.

---

### 4.2 Self-Service Password Reset
- Users request a password reset at `/forgot-password`.
- API endpoint `/api/auth/reset-password` executes `verifyUserExistsByEmail(email)` as a hard backstop.
- If verified, a token is stored in `public.password_resets` and a branded reset email containing `/reset-password/[token]` is sent via the System Gmail Connection.
- The reset token page forces `Referrer-Policy: no-referrer` to prevent token leakage.

---

## 5. Deal Pipeline Engine & Dynamic EAV Architecture

### 5.1 8-Stage Flexible State Machine
All deals move through a defined 8-stage state machine (`src/lib/stage-machine.ts`):

```
       [lead] ───► [outreach] ───► [response] ───► [underwriting] ───► [loi] ───► [closed]
         │              │               │                 │               │
         ▼              ▼               ▼                 ▼               ▼
    [archived]     [archived]      [archived]        [archived]       [failed]
```

#### Stage Transition Rules
1. **Normal Forward Flow**: `lead` -> `outreach` -> `response` -> `underwriting` -> `loi` -> `closed`.
2. **Terminal Off-Ramp (`archived`)**: Deals before the `loi` stage can be marked as `archived`.
3. **Terminal Failure (`failed`)**: `failed` is ONLY valid after reaching the `loi` stage. Deals at or past `loi` cannot be set to `archived` — they must be closed or marked as `failed`.

---

### 5.2 Dynamic Entity-Attribute-Value (EAV) Fields
To prevent rigid schema lock-in, all property-specific details (such as address, unit count, year built, property type, building class, CoStar links, custom numbers) are stored dynamically.
- `public.field_definitions` defines field keys per project (or global `project_id IS NULL`), data type (`text`, `number`, `integer`, `date`, `boolean`, `url`, `currency`), label, and grid visibility (`show_in_grid`).
- `public.deal_fields` holds the exact value as string, coerced dynamically on rendering.
- Standard required system fields (`address`, `unit_count`) are automatically seeded into `field_definitions` for new projects.

---

## 6. CoStar Import Engine & Batch Delete Utilities

### 6.1 CoStar CSV/Excel Import Wizard
The import engine (`src/components/import/CoStarImportWizard.tsx`) allows acquisition managers to upload CoStar CSV or Excel exports and map them cleanly into deals.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌────────────────┐
│ 1. Upload File  │ ──► │ 2. Select Target │ ──► │ 3. Map Columns  │ ──► │ 4. Execution   │
│ (CSV / XLSX)    │     │ Campaign/Portf.  │     │ (Fuzzy auto-map)│     │ & Job Tracking │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └────────────────┘
```

1. **Step 1: File Parsing**: Uses `papaparse` or `exceljs` to extract raw headers and preview rows.
2. **Step 2: Destination**: Select project campaign or portfolio.
3. **Step 3: Column Mapping**:
   - Compares incoming headers with existing `field_definitions` using string normalization.
   - User can map to existing dynamic fields, create new dynamic fields, designate target outreach email / unit count, or drop unneeded columns.
   - Previous header mappings are recalled per project via `import_jobs.column_mapping`.
4. **Step 4: Asynchronous Import Job**:
   - `import_jobs` status transitions: `pending` -> `mapping` -> `running` -> `done`.
   - Inserts deal rows, generates dynamic `deal_fields`, links contacts, and seeds default document checklists (`PERFORM public.seed_default_checklist(deal_id)`).

---

### 6.2 Batch Deletion Engine (`src/lib/batch-delete.ts`, `/api/deals/batch`)
- `batchDeleteDeals(ids[])`: Performs bulk deletion of specific deal UUIDs in chunked SQL calls.
- `deleteAllDeals(params)`: Executes server-side deletion of all deals matching filter criteria (`campaign_id`, `stage`, `score`, `search`, `project_id`) without client ID round-trips.

---

## 7. Google Cloud Services Integration (Gmail, Drive & People)

### 7.1 OAuth 2.0 & Token Architecture
- Connections are stored in `public.google_connections`.
- Supports multi-project connectivity: Each project links to a `google_connection_id`. Multiple projects can share a single connected Google account.
- Memory token caching in `src/lib/google/auth-cache.ts` prevents redundant DB queries during high-frequency API operations.
- Refresh token events automatically update `public.google_connections` via Supabase Service Role client.

---

### 7.2 Gmail Mail Merge & Threading Subsystem
- **Mail Merge Templates**: Custom project templates stored in `public.email_templates` support variable interpolation (`{{address}}`, `{{unit_count}}`, `{{contact_name}}`, `{{market}}`).
- **Threading & History**: Uses Gmail thread IDs (`gmail_thread_id`) to group outreach messages and replies in a full Gmail-style thread view (`EmailThreadList.tsx`, `InlineReplyBox.tsx`).
- **Snooze Management**: Supports snoozing threads until a specified date/time (`public.snoozed_threads`).
- **Real-Time Push Notifications**: Webhook integration (`/api/emails/webhook`) paired with Google Cloud Pub/Sub (`watchGmail`) and Supabase Realtime replication on `email_outreach` and `snoozed_threads`.
- **Google People API Integration (`src/lib/google/people.ts`)**: Executes `lookupNamesByEmail` against Gmail interaction history to resolve recipient display names for email autocomplete inputs (`RecipientChipsInput.tsx`).

---

### 7.3 Google Drive Workspace & Directory Traversal Subsystem
- **Project Folder**: Each project specifies a parent Google Drive folder (`google_drive_folder_id`).
- **Automatic Deal Folder Generation**: Creates deal subfolders (`createDealFolder`) and sets public view permissions (`reader: anyone`).
- **Depth-Ordered Batch Folder Trees**: Creates complex multi-level folder structures in parallel batch sessions (`batchCreateDriveFolders`).
- **Streaming Upload Engine**: Streams uploads directly from browser HTTP requests to Google Drive API (`uploadFileToDriveStream`) avoiding double-buffering in server memory.
- **Browser Directory Drag-and-Drop (`src/lib/directory-traversal.ts`)**: Implements cooperative yielding recursive directory traversal for WebKit `FileSystemEntry` API, enabling full folder structure drag-and-drop uploads directly into Google Drive file manager (`DriveFileManager.tsx`).
- **Quota & File Operations**: Lists files with pagination, handles rename, move, trash, untrash, and retrieves real-time storage quota (`getDriveStorageQuota`).

---

## 8. Financial Underwriting & LOI Counter-Offer Engine

### 8.1 Financial Underwriting Metrics & 2-Tier Approvals
The `underwriting` module (`UnderwritingSummary.tsx`, `UnderwritingForm.tsx`) tracks:
- **Price Metrics**: Asking Price, Price/Unit, Market Price/Unit, Market Delta %.
- **Demographics & Market**: 1-Mile Population, Population Growth %, 12-Month Rent Growth %, Forward Forecast Rent Growth %, Vacancy Rate %, Cap Rate %, Sale & Rent Comps summary.
- **Investment Return Metrics**: Purchase Price, Purchase Price/Unit, Total Capex, Capex/Unit, IRR %, Equity Multiple, Cash-on-Cash %, Projected Profit, Occupancy %.
- **2-Tier Review Approval Workflow**:
  - `proceed_with_loi`: Boolean decision flag.
  - `uw_analyst_id` & `uw_completion_date`: Analyst sign-off.
  - `reviewer_1_id` & `review_1_date`: Senior Reviewer 1 approval.
  - `reviewer_2_id` & `review_2_date`: Executive Reviewer 2 approval.

---

### 8.2 LOI Tracking & Negotiation Counter-Rounds
The `loi_records` and `loi_rounds` module (`LOIDetail.tsx`):
- **Submission & Due Diligence**: Tracks offer date, initial offered price, and mandatory document verification booleans (Insurance Declarations, Vendor Service Contracts, Utility Bills).
- **Multi-Round Counter-Offers**: `loi_rounds` logs sequential negotiation turns (`round_num`, `party`: `'buyer'` \| `'seller'`, `price`, `round_date`, `notes`).
- **Outcome Finalization**: Outcome set to `in_progress`, `deal_reached` (with final price & close date), or `fallen_through` (with fallout date & reason).

---

## 9. API Reference Architecture

| Endpoint Path | HTTP Methods | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/me` | `GET` | Authenticated | Returns current user profile, role, and app metadata. |
| `/api/auth/login` | `POST` | Public + Turnstile | Validates Turnstile captcha and authenticates user. |
| `/api/auth/logout` | `POST` | Authenticated | Clears session cookies and invalidates auth state. |
| `/api/auth/reset-password` | `POST` | Public + Turnstile | Initiates self-service password reset email. |
| `/api/auth/reset-password/[token]`| `GET`, `POST` | Public | Validates reset token and sets new user password. |
| `/api/invitations/[token]` | `GET` | Public | Validates invitation token for new user setup. |
| `/api/invitations/[token]/accept`| `POST` | Public | Completes account setup from invitation link. |
| `/api/projects` | `GET`, `POST` | Staff (`admin`/`internal`) | Lists accessible projects or creates a new project workspace. |
| `/api/projects/[id]` | `GET`, `PUT`, `DELETE` | Staff / Client (RLS) | Fetches project details, updates settings, or deletes project. |
| `/api/projects/[id]/members` | `GET`, `POST`, `DELETE` | Staff | Manages project team members (`project_members`). |
| `/api/projects/[id]/sponsors` | `GET`, `POST`, `DELETE` | Staff | Manages project client sponsors (`sponsors`). |
| `/api/deals` | `GET`, `POST`, `DELETE` | Staff / Client (RLS) | Paginated list of pipeline deals with filtering, creation, or delete all. |
| `/api/deals/batch` | `DELETE` | Staff | Deletes a specific list of deal UUIDs in batch. |
| `/api/deals/[id]` | `GET`, `PUT`, `DELETE` | Staff / Client (RLS) | Detailed deal fetch, stage machine transitions, or soft archive. |
| `/api/deals/[id]/fields` | `GET`, `PUT` | Staff | Retrieves or batch-updates dynamic EAV fields for a deal. |
| `/api/deals/[id]/drive/files` | `GET`, `POST`, `DELETE` | Staff | Lists, uploads (streamed), or trashes files in deal Drive folder. |
| `/api/deals/[id]/drive/folders` | `POST` | Staff | Creates subfolders inside deal Drive workspace. |
| `/api/deals/[id]/emails/threads`| `GET` | Staff / Client (RLS) | Fetches Gmail thread messages associated with deal contacts. |
| `/api/deals/[id]/emails/send` | `POST` | Staff | Sends outreach message or inline thread reply via Gmail API. |
| `/api/campaigns` | `GET`, `POST` | Staff | Retrieves or creates outreach campaigns. |
| `/api/campaigns/[id]/templates` | `GET`, `POST`, `PUT` | Staff | Manages project mail merge templates (`email_templates`). |
| `/api/underwriting/[dealId]` | `GET`, `PUT` | Staff | Fetches or updates underwriting metrics and review approvals. |
| `/api/loi/[dealId]` | `GET`, `PUT` | Staff | Manages LOI record, verifications, and counter-offer rounds. |
| `/api/calls` | `GET`, `POST`, `PUT` | Staff / Client (RLS) | Manages scheduled call briefs and client notes. |
| `/api/admin/users` | `GET`, `POST`, `DELETE` | Admin | Global user management and role assignment. |
| `/api/admin/invitations` | `GET`, `POST`, `DELETE` | Admin | Global invitation tracking and token management. |
| `/api/admin/system-email` | `GET`, `POST`, `DELETE` | Admin | Pairs system Gmail account for transactional emails. |
| `/api/turnstile` | `POST` | Public | Validates Cloudflare Turnstile token server-side. |

---

## 10. Frontend Architecture & Design System

### 10.1 CSS Variables & Design System Tokens (`globals.css`)
The application implements a sleek dark/light adaptive design system using vanilla CSS custom properties without raw utility hex codes.

```css
:root {
  --sidebar-width: 220px;
  --color-canvas: #F7F5F0;       /* Warm light canvas */
  --color-surface-0: #FFFFFF;    /* Pure white card surface */
  --color-surface-1: #ECE9E0;    /* Muted element background */
  --color-surface-2: #D8D3C5;    /* Subdued border */
  --color-surface-3: #BEB9A9;    /* Form control border */
  --accent: #1E5B3F;             /* Deep Emerald Forest */
  --color-accent-light: #C3DFC7;
  --color-accent-bg: #EDF5EE;
  --color-text-primary: #1A1814;
  --color-text-secondary: #6B6560;
  --color-text-tertiary: #9B9690;
  --color-text-inverse: #F7F5F0;
}

.dark {
  --color-canvas: #111110;       /* Deep obsidian dark background */
  --color-surface-0: #191918;    /* Dark surface card */
  --color-surface-1: #222220;
  --color-surface-2: #2C2C2A;
  --color-surface-3: #3A3A38;
  --accent: #48A375;             /* Electric Emerald Dark Accent */
  --color-accent-light: #1A3F2C;
  --color-accent-bg: #0F261B;
  --color-text-primary: #F0EDE8;
  --color-text-secondary: #9B9690;
  --color-text-tertiary: #6B6560;
  --color-text-inverse: #1A1814;
}
```

---

### 10.2 Core Reusable UI Components & State Hooks
- **`DataGrid` (`src/components/shared/DataGrid.tsx`)**: High-performance virtualized table powered by `@tanstack/react-virtual` and custom interaction hooks (`useGridInteraction.ts`, `useColumnOrder.ts`, `useColumnWidths.ts`). Supports dynamic column toggling (`show_in_grid`), keyboard navigation (Arrow keys, Tab, Enter, Escape), copy/paste, inline cell editing, bulk selection, column sorting, pagination controls, and animated cell glow highlights (`animate-cell-success`, `animate-cell-flash`).
- **`DriveFileManager` (`src/components/deals/DriveFileManager.tsx`)**: Interactive Google Drive file browser featuring folder navigation, path breadcrumbs, search, multi-file dropzone upload (`FileDropZone.tsx`), recursive folder drop traversal (`directory-traversal.ts`), rename, trash/untrash, folder creation, and storage quota progress indicators.
- **`EmailThreadList` & `InlineReplyBox` (`src/components/shared/EmailThreadList.tsx`, `src/components/deals/InlineReplyBox.tsx`)**: Rich email thread interface supporting HTML email rendering (`.email-content`), custom attachments (`email-attachments` bucket), mail merge template insertion, recipient chip inputs (`RecipientChipsInput.tsx`), and inline sending via Gmail API.
- **`Sidebar` (`src/components/shared/Sidebar.tsx`)**: Responsive, collapsible sidebar featuring brand logo (`BrandLogo.tsx`), multi-section navigation based on role (`internalNavItems`, `clientNavItems`, `adminNavItems`), project switcher dropdown, recent project shortcuts (`get_recent_projects`), and theme mode toggle.

---

## 11. Directory Structure

```
acquisition-platform/
├── docs/                      # Architectural guides & design specs
├── public/                    # Static assets & brand graphics
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth routes (login, invite, reset-password)
│   │   ├── (client)/          # Client sponsor views
│   │   ├── (internal)/        # Internal team pages (projects, deals, etc.)
│   │   ├── admin/             # Global system administration
│   │   ├── api/               # Next.js API route handlers
│   │   ├── projects/          # Projects hub page
│   │   ├── globals.css        # Design tokens, CSS variables & animations
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Root redirect logic
│   ├── components/
│   │   ├── admin/             # Admin drawers & user dialogs
│   │   ├── auth/              # Auth forms & captcha widgets
│   │   ├── campaigns/         # Campaign cards, dialogs & template manager
│   │   ├── client/            # Client-facing overview & call queues
│   │   ├── dashboard/         # Analytics charts, KPI scorecards & stats
│   │   ├── deals/             # Deal table, stage bar, UW form, LOI, Drive manager
│   │   ├── import/            # CoStar CSV import wizard & preview tables
│   │   ├── portfolios/        # Portfolio dialogs & views
│   │   ├── projects/          # Project creation & folder picker
│   │   ├── shared/            # DataGrid, Sidebar, EmailComposer, PageHeader
│   │   └── ui/                # Radix UI primitive wrappers (Button, Dialog, etc.)
│   ├── lib/
│   │   ├── email/             # React Email templates & send utilities
│   │   ├── google/            # Gmail, Drive, People API, OAuth & token cache
│   │   ├── hooks/             # Custom React hooks (useGridInteraction, etc.)
│   │   ├── import/            # Column mapping & fuzzy matching logic
│   │   ├── supabase/          # Client, server, admin & middleware clients
│   │   ├── types/             # Common grid & domain types
│   │   ├── validations/       # Zod schemas for all models
│   │   ├── batch-delete.ts    # Server-side batch deletion helpers
│   │   ├── brand.ts           # Global brand metadata constants
│   │   ├── directory-traversal.ts # Browser folder drag-and-drop traversal
│   │   ├── navigation.ts      # Sidebar navigation section configs
│   │   ├── page-headings.ts   # Page title and description dictionary
│   │   ├── rate-limit.ts      # Upstash Redis sliding window limiters
│   │   ├── stage-machine.ts   # 8-stage pipeline state machine
│   │   ├── turnstile.ts       # Cloudflare Turnstile token verifier
│   │   └── utils.ts           # Formatters (currency, date, name from email)
│   ├── proxy.ts               # Upstash Redis & external request proxy
│   └── types/                 # Database TypeScript types
├── supabase/
│   ├── migrations/            # Consolidated migration (0001_initial_schema.sql)
│   └── seed.sql               # Local development seed data
├── next.config.ts             # Next.js config, CSP headers & image patterns
├── package.json               # Dependencies & build scripts
└── SPEC.md                    # THIS SPECIFICATION DOCUMENT
```

---

## 12. Verification & Verification Commands

To verify system integrity, compile code, and run unit & property-based tests:

```bash
# 1. Type Check & Build Validation
npm run build

# 2. Execute Vitest Suite
npm run test

# 3. Regenerate Supabase TypeScript Definitions
npm run db:types
```

---

<!-- GOAL_COMPLETE -->
