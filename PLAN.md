# Multifamily Property Acquisition Platform — Technical PLAN.md
> For use by an AI coding agent (Claude Code, OpenCode, etc.)
> Stack: Next.js 16.2.6 (App Router) · Supabase · Cloudflare Turnstile · Gmail API · Google Drive API

---

## 0. Agent Orientation & Ground Rules

Before writing a single line of code, the agent MUST read this entire document top to bottom. The plan is sequential — each phase gates the next. Do not skip phases, do not guess at schema details, do not invent library APIs.

### 0.1 — Supabase Documentation Reference

The agent MUST consult the official Supabase documentation for all Auth, RLS, and SSR patterns. Do NOT rely on training-data memory for Supabase APIs.

Key references:
- Auth helpers: https://supabase.com/docs/guides/auth/server-side/nextjs
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- CLI: https://supabase.com/docs/reference/cli/introduction
- SSR package: https://github.com/supabase/ssr

### 0.2 — Pause Points (🛑)

Wherever this document shows a 🛑 symbol, the agent MUST stop, print the required information to the user, and wait for confirmation or input before continuing. Never assume or fabricate secrets, credentials, or IDs.

### 0.3 — Never Hallucinate Dependencies

- Only use packages that exist in the exact version range specified.
- Before using any npm package, verify it exists with `npm info <package> version`.
- If a package's API is uncertain, search its README or docs before using it.

---

## 1. Prerequisites Checklist

🛑 **STOP — Print this checklist to the user and collect all answers before proceeding.**

The agent must ask the user to provide the following. Collect them into a `.env.local` file (never commit this file). Create a `.env.example` with placeholder values.

```
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only, never exposed to browser
SUPABASE_PROJECT_ID=              # for CLI migrations (project ref)

# --- Cloudflare Turnstile (CAPTCHA) ---
NEXT_PUBLIC_TURNSTILE_SITE_KEY=   # public, safe in browser
TURNSTILE_SECRET_KEY=             # server-side only

# --- Google OAuth / Gmail API ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=              # e.g. https://yourdomain.com/api/auth/google/callback
GOOGLE_CLOUD_PROJECT_ID=          # Google Cloud project ID for Pub/Sub

# --- App ---
NEXT_PUBLIC_APP_URL=              # e.g. https://yourdomain.com (no trailing slash)
DB_ENCRYPTION_KEY=                # random 32-char string for CA credential encryption

# --- Rate Limiting (Upstash Redis) ---
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# --- Google Drive (same OAuth app as Gmail) ---
# No extra keys needed — uses same GOOGLE_CLIENT_ID/SECRET
```

**Instructions to give the user:**

1. Create a Supabase project at https://supabase.com → copy URL and anon key from Project Settings → API.
2. Copy the service role key from the same page (keep secret). Copy the Project Reference ID (not the project name).
3. Create a Cloudflare Turnstile widget at https://dash.cloudflare.com → Turnstile → Add site. Use "Managed" challenge type. Copy Site Key and Secret Key.
4. Create a Google Cloud project, enable Gmail API and Google Drive API and Cloud Pub/Sub API, create OAuth 2.0 credentials (Web application type), add authorized redirect URI matching `GOOGLE_REDIRECT_URI`.
5. Create an Upstash Redis database at https://console.upstash.com and copy the REST URL and token.
6. Generate `DB_ENCRYPTION_KEY` with: `openssl rand -base64 24 | tr -d '='`
7. Return all values above.

---

## 2. Repository & Project Bootstrap

### 2.1 — Initialize Next.js

```bash
npx create-next-app@16.2.6 acquisition-platform \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd acquisition-platform
```

### 2.2 — Install Core Dependencies

```bash
# Supabase
npm install @supabase/supabase-js@^2 @supabase/ssr@^0.5

# Forms & validation
npm install react-hook-form@^7 zod@^3 @hookform/resolvers@^3

# UI primitives (shadcn/ui — run after project init)
npx shadcn@latest init
# Choose: Default style, Slate base color, CSS variables: yes

# Install required shadcn components
npx shadcn@latest add button input label card table badge dialog sheet tabs select textarea toast sonner switch

# Data fetching / server state
npm install @tanstack/react-query@^5

# Date utilities
npm install date-fns@^3

# Cloudflare Turnstile
npm install react-turnstile@^1

# File parsing (CoStar Excel import) — exceljs replaces abandoned xlsx package
npm install exceljs@^4

# Misc utilities
npm install clsx@^2 tailwind-merge@^2 lucide-react@^0.460

# Google APIs
npm install googleapis@^140 google-auth-library@^9

# Email template rendering
npm install @react-email/components@^0.0 @react-email/render@^1

# Rate limiting
npm install @upstash/ratelimit @upstash/redis

# Dev
npm install -D supabase@^2   # Supabase CLI as local dev dep
```

### 2.3 — Initialize Supabase CLI

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref $SUPABASE_PROJECT_ID
```

### 2.4 — tsconfig.json

Replace the generated `tsconfig.json` content with:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "module": "ESNext",
    "moduleDetection": "force",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 2.5 — next.config.ts

Replace the generated `next.config.ts` content with:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL!] },
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
            "frame-src https://challenges.cloudflare.com",
            "connect-src 'self' https://*.supabase.co https://www.googleapis.com https://accounts.google.com",
            "img-src 'self' data: https://lh3.googleusercontent.com",
            "style-src 'self' 'unsafe-inline'",
          ].join('; '),
        },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
}

export default nextConfig
```

---

## 3. Directory Structure

```
acquisition-platform/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Route group: login, signup
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── reset-password/page.tsx   # stub page (Phase 1 only)
│   │   ├── (internal)/               # Route group: internal team views
│   │   │   ├── layout.tsx            # Auth guard: internal role only
│   │   │   ├── error.tsx             # Error boundary
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── deals/
│   │   │   │   ├── page.tsx          # Deal list / pipeline view
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx      # Deal detail
│   │   │   │       └── layout.tsx
│   │   │   ├── campaigns/page.tsx
│   │   │   ├── import/page.tsx       # CoStar bulk import
│   │   │   └── settings/page.tsx
│   │   ├── (client)/                 # Route group: client/CEO view
│   │   │   ├── layout.tsx            # Auth guard: client role only
│   │   │   ├── error.tsx
│   │   │   ├── overview/page.tsx
│   │   │   └── calls/page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── signup/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── google/
│   │   │   │       ├── route.ts         # Initiate Google OAuth
│   │   │   │       ├── callback/route.ts
│   │   │   │       └── refresh-watch/route.ts  # Re-register Gmail watch (cron target)
│   │   │   ├── deals/
│   │   │   │   ├── route.ts             # GET list, POST create
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── route.ts         # GET, PATCH, DELETE
│   │   │   │   │   ├── documents/route.ts
│   │   │   │   │   └── drive/route.ts   # POST: create Drive folder
│   │   │   │   └── import/
│   │   │   │       ├── route.ts         # POST: parse + preview
│   │   │   │       └── [batchId]/
│   │   │   │           ├── confirm/route.ts  # POST: trigger Edge Function import
│   │   │   │           └── status/route.ts   # GET: poll import progress
│   │   │   ├── emails/
│   │   │   │   ├── [id]/route.ts        # PATCH: classify response, set flags
│   │   │   │   ├── send/route.ts        # POST: send outreach email
│   │   │   │   └── webhook/route.ts     # POST: Gmail Pub/Sub receiver
│   │   │   ├── campaigns/
│   │   │   │   ├── route.ts             # GET list, POST create
│   │   │   │   └── [id]/route.ts        # GET, PATCH, DELETE
│   │   │   ├── contacts/
│   │   │   │   ├── route.ts             # POST create
│   │   │   │   └── [id]/route.ts        # GET, PATCH, DELETE
│   │   │   ├── calls/
│   │   │   │   ├── route.ts             # GET list
│   │   │   │   └── [id]/route.ts        # GET, PATCH (client: notes+status; internal: full)
│   │   │   ├── loi/
│   │   │   │   ├── route.ts             # POST create
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts         # PATCH outcome
│   │   │   │       ├── rounds/route.ts  # GET list, POST add round
│   │   │   ├── ca-credentials/
│   │   │   │   └── route.ts             # POST create (encrypted)
│   │   │   ├── admin/
│   │   │   │   ├── invite/route.ts      # POST: invite user (service role)
│   │   │   │   └── users/[id]/route.ts  # PATCH role, DELETE user (service role)
│   │   │   └── turnstile/verify/route.ts
│   │   ├── not-found.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # shadcn generated components
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── TurnstileWidget.tsx
│   │   ├── deals/
│   │   │   ├── DealCard.tsx
│   │   │   ├── DealTable.tsx
│   │   │   ├── DealStageBar.tsx
│   │   │   ├── DealScoreBadge.tsx
│   │   │   ├── DocumentChecklist.tsx
│   │   │   ├── EmailThread.tsx
│   │   │   ├── UnderwritingForm.tsx
│   │   │   └── LOITracker.tsx
│   │   ├── dashboard/
│   │   │   ├── FunnelMetrics.tsx
│   │   │   ├── KPIScorecard.tsx
│   │   │   ├── PipelineTable.tsx
│   │   │   └── ConversionChart.tsx
│   │   ├── client/
│   │   │   ├── ClientDealCard.tsx
│   │   │   ├── CallBrief.tsx
│   │   │   └── CallQueue.tsx
│   │   ├── import/
│   │   │   └── CoStarImportWizard.tsx
│   │   └── shared/
│   │       ├── PageHeader.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── EmptyState.tsx
│   │       └── ReactQueryProvider.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client (singleton)
│   │   │   ├── server.ts             # Server Supabase client (SSR, anon key)
│   │   │   ├── admin.ts              # Server Supabase client (service role ONLY)
│   │   │   ├── middleware.ts         # Session refresh helper
│   │   │   └── types.ts             # Generated DB types (auto-generated)
│   │   ├── google/
│   │   │   ├── oauth.ts              # OAuth flow helpers + token refresh
│   │   │   ├── gmail.ts             # Gmail send/watch/list helpers
│   │   │   └── drive.ts             # Drive folder create/link helpers
│   │   ├── email/
│   │   │   └── templates/
│   │   │       ├── outreach.tsx      # React Email: outreach template
│   │   │       ├── thank-you.tsx
│   │   │       └── declination.tsx
│   │   ├── import/
│   │   │   └── costar-parser.ts      # CoStar Excel column mapping (exceljs)
│   │   ├── rate-limit.ts             # Upstash rate limit instances
│   │   ├── validations/
│   │   │   ├── deal.schema.ts        # Zod schemas for deal forms
│   │   │   ├── auth.schema.ts
│   │   │   ├── contact.schema.ts
│   │   │   └── import.schema.ts
│   │   ├── hooks/
│   │   │   ├── useDeals.ts
│   │   │   ├── useCampaigns.ts
│   │   │   ├── useCallQueue.ts
│   │   │   └── useAuth.ts
│   │   └── utils.ts                  # cn(), formatCurrency(), etc.
│   ├── middleware.ts                  # Next.js middleware: session + role routing
│   └── types/
│       ├── database.ts               # Manual type overrides if needed
│       └── global.d.ts
├── supabase/
│   ├── migrations/
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_auth_roles.sql
│   │   ├── 0003_campaigns.sql
│   │   ├── 0004_deals.sql
│   │   ├── 0005_contacts.sql
│   │   ├── 0006_email_outreach.sql
│   │   ├── 0007_documents.sql
│   │   ├── 0008_underwriting.sql
│   │   ├── 0009_call_briefs.sql
│   │   ├── 0010_loi.sql
│   │   ├── 0011_google_tokens.sql
│   │   ├── 0012_import_jobs.sql
│   │   ├── 0013_rls_policies.sql
│   │   └── 0014_functions.sql
│   ├── seed.sql
│   └── config.toml
├── .env.local                        # Never commit
├── .env.example                      # Commit with placeholders
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 4. Database Migrations

Run migrations in order after all are written:

```bash
# Local dev:
npx supabase db push --local
# Production (linked project):
npx supabase db push
# Verify (output must be empty after push):
npx supabase db diff --linked
```

Do NOT use `supabase migration up` — that is a removed CLI v1 command that no longer exists.

### Migration 0001 — Extensions

```sql
-- supabase/migrations/0001_extensions.sql
create extension if not exists pgcrypto;      -- gen_random_uuid() + pgp_sym_encrypt
create extension if not exists pg_trgm;       -- fuzzy search on deal names/addresses
create extension if not exists unaccent;      -- search normalization
```

Note: `uuid-ossp` is NOT used. All primary keys use `gen_random_uuid()` from `pgcrypto`, which requires no extension in modern Supabase (PostgreSQL 14+).

### Migration 0002 — Auth Roles & User Profiles

```sql
-- supabase/migrations/0002_auth_roles.sql

create type public.user_role as enum ('internal', 'client');

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  role          public.user_role not null default 'internal',
  client_org    text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile on user signup AND sync role into app_metadata JWT claim
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role public.user_role;
begin
  v_role := coalesce(
    (new.raw_user_meta_data->>'role')::public.user_role,
    (new.raw_app_meta_data->>'role')::public.user_role,
    'internal'
  );

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_role
  );

  -- Sync role into app_metadata so middleware can read it from JWT (no extra DB call)
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', v_role::text)
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Migration 0003 — Campaigns

```sql
-- supabase/migrations/0003_campaigns.sql

create type public.listing_type as enum ('on_market', 'off_market');
create type public.deal_source  as enum ('direct', 'indirect');
create type public.email_template_key as enum ('outreach', 'thank_you', 'declination');

create table public.campaigns (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  market                   text not null,             -- e.g. "NJ", "NV", "AZ"
  listing_type             public.listing_type,
  email_template           public.email_template_key, -- maps to src/lib/email/templates/
  email_subject_template   text,                      -- subject line with {{variables}}
  target_response_rate_pct numeric(5,2),              -- for KPI scorecard
  target_loi_count         int,                       -- for KPI scorecard
  is_active                boolean not null default true,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Valid email_template_key values map to files:
-- 'outreach'    → src/lib/email/templates/outreach.tsx
-- 'thank_you'   → src/lib/email/templates/thank-you.tsx
-- 'declination' → src/lib/email/templates/declination.tsx
--
-- email_subject_template supports variables: {{property_address}}, {{owner_name}}, {{sender_name}}
-- Example: "Acquisition Inquiry — {{property_address}}"
```

### Migration 0004 — Deals (Core Table)

```sql
-- supabase/migrations/0004_deals.sql

create type public.deal_stage as enum (
  'lead',
  'outreach',
  'response',
  'document_collection',
  'underwritability_review',
  'underwriting',
  'scored',
  'call_scheduled',
  'loi',
  'closed',
  'archived'
);

create type public.deal_score as enum ('very_good', 'good', 'bad', 'very_bad');

create type public.property_type as enum (
  'multifamily', 'retail', 'office', 'industrial', 'mixed_use', 'other'
);

-- Standard CoStar building classes: A, B, C, D
-- 'unclassified' is used when CoStar export omits the class field
create type public.building_class as enum ('A', 'B', 'C', 'D', 'unclassified');

create table public.deals (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid references public.campaigns(id) on delete set null,

  -- Identifiers
  property_id           text,
  deal_name             text,
  -- import_batch format: "YYYY-MM-DD_{campaignUuid}"
  -- Example: "2026-05-14_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  -- Generated as: `${new Date().toISOString().slice(0, 10)}_${campaignId}`
  import_batch          text,

  -- Property Info
  source                public.deal_source not null default 'indirect',
  listing_type          public.listing_type,
  property_type         public.property_type,
  building_class        public.building_class,
  year_built            int,
  year_renovated        int,
  unit_count            int,
  property_link         text,                        -- CoStar URL

  -- Address
  address               text,
  city                  text,
  state                 text,
  zip                   text,

  -- Pipeline
  stage                 public.deal_stage not null default 'lead',
  score                 public.deal_score,
  is_archived           boolean not null default false,
  archive_reason        text,

  -- Google Drive
  drive_folder_url      text,

  -- Internal notes
  internal_notes        text,

  -- Audit
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index deals_property_id_campaign_idx
  on public.deals(property_id, campaign_id)
  where property_id is not null;

create index deals_search_idx on public.deals
  using gin(to_tsvector('english',
    coalesce(deal_name, '') || ' ' ||
    coalesce(address, '')   || ' ' ||
    coalesce(city, '')      || ' ' ||
    coalesce(state, '')
  ));
```

### Migration 0005 — Contacts

```sql
-- supabase/migrations/0005_contacts.sql

create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  name         text,
  company      text,
  title        text,
  email        text[],     -- array: supports multiple recipients
  phone_office text,
  phone_cell   text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index contacts_deal_idx on public.contacts(deal_id);
```

### Migration 0006 — Email Outreach

```sql
-- supabase/migrations/0006_email_outreach.sql

create type public.email_status as enum (
  'not_sent', 'sent', 'invalid_address', 'gmail_error', 'replied'
);

create type public.response_classification as enum (
  'positive', 'neutral', 'negative', 'no_response'
);

create table public.email_outreach (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references public.deals(id) on delete cascade,
  contact_id              uuid references public.contacts(id) on delete set null,

  -- Outbound
  status                  public.email_status not null default 'not_sent',
  sent_at                 timestamptz,
  subject                 text,
  template_used           public.email_template_key,
  gmail_message_id        text,
  gmail_thread_id         text,
  error_message           text,

  -- Response
  response_classification public.response_classification,
  responded_at            timestamptz,

  -- conversation_log is a MANUALLY EDITABLE plain-text textarea on the Outreach tab.
  -- The internal team pastes or types a running summary of email exchanges here.
  -- The Gmail webhook does NOT auto-populate this field —
  -- it only updates status and responded_at.
  conversation_log        text,

  -- Thank-you email
  thank_you_sent          boolean not null default false,
  thank_you_sent_at       timestamptz,

  -- Declination email
  declination_sent        boolean not null default false,
  declination_sent_at     timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index email_outreach_deal_idx on public.email_outreach(deal_id);
create index email_outreach_thread_idx on public.email_outreach(gmail_thread_id)
  where gmail_thread_id is not null;
```

### Migration 0007 — Document Checklist & CA

```sql
-- supabase/migrations/0007_documents.sql

create type public.ca_status as enum (
  'not_required', 'pending', 'signed', 'approved'
);

create table public.document_checklist (
  id                     uuid primary key default gen_random_uuid(),
  deal_id                uuid not null references public.deals(id) on delete cascade,

  pl_collected           boolean not null default false,
  pl_period              text,
  rent_roll_collected    boolean not null default false,
  rent_roll_as_of        date,
  om_collected           boolean not null default false,
  tax_bill_collected     boolean,
  capex_collected        boolean,
  market_report_1        boolean,
  market_report_2        boolean,
  market_report_3        boolean,
  market_report_4        boolean,

  ca_status              public.ca_status not null default 'not_required',
  ca_platform            text,
  -- UUID FK to ca_credentials; not a free-text label
  ca_credential_id       uuid references public.ca_credentials(id) on delete set null,

  updated_at             timestamptz not null default now(),
  unique(deal_id)
);

-- CA credentials stored separately (sensitive — password stored encrypted)
create table public.ca_credentials (
  id                  uuid primary key default gen_random_uuid(),
  platform            text not null,
  username            text,
  -- password stored as pgp_sym_encrypt(password, DB_ENCRYPTION_KEY) — NEVER plaintext
  password_encrypted  bytea,
  notes               text,
  created_at          timestamptz not null default now()
);

-- Secure function to insert a CA credential with encrypted password
-- Called from /api/ca-credentials/route.ts with the plaintext password
create or replace function public.store_ca_credential(
  p_platform text,
  p_username text,
  p_password text,
  p_encryption_key text
) returns uuid language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.ca_credentials (platform, username, password_encrypted)
  values (p_platform, p_username, pgp_sym_encrypt(p_password, p_encryption_key))
  returning id into v_id;
  return v_id;
end;
$$;
```

### Migration 0008 — Underwriting

```sql
-- supabase/migrations/0008_underwriting.sql

create type public.underwritability as enum (
  'underwritable', 'not_underwritable', 'maybe'
);

create table public.underwriting (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references public.deals(id) on delete cascade,

  underwritability        public.underwritability,
  screened_at             timestamptz,
  screened_by             uuid references public.profiles(id),

  -- Market Research
  asking_price            numeric(15,2),
  asking_price_per_unit   numeric(12,2),
  population_1mi          int,
  population_growth_pct   numeric(6,3),
  rent_growth_t12_pct     numeric(6,3),
  rent_growth_fwd_pct     numeric(6,3),
  vacancy_rate_pct        numeric(6,3),
  market_price_per_unit   numeric(12,2),
  market_delta_pct        numeric(6,3),   -- auto-calculated: ((asking_ppu - market_ppu) / market_ppu) * 100
  cap_rate                numeric(6,3),
  sale_comps_available    boolean,
  rent_comps_available    boolean,

  -- Underwriting Summary
  purchase_price          numeric(15,2),
  purchase_price_per_unit numeric(12,2),   -- auto-calculated: purchase_price / unit_count
  capex_estimate          numeric(15,2),
  irr_pct                 numeric(6,3),
  equity_multiple         numeric(6,3),
  cash_on_cash_pct        numeric(6,3),
  projected_profit        numeric(15,2),
  occupancy_pct           numeric(6,3),
  uw_notes                text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(deal_id)
);
```

### Migration 0009 — Call Briefs

```sql
-- supabase/migrations/0009_call_briefs.sql

create type public.call_status as enum (
  'pending', 'completed', 'cancelled'
);

create table public.call_briefs (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references public.deals(id) on delete cascade,

  -- Brief content (drafted by internal team)
  summary_text    text,
  published       boolean not null default false,
  published_at    timestamptz,

  -- Call tracking
  call_status     public.call_status not null default 'pending',
  completed_at    timestamptz,
  client_notes    text,            -- written by CEO/client after reviewing

  -- Scheduling
  flagged_by      uuid references public.profiles(id),
  flagged_at      timestamptz not null default now(),

  updated_at      timestamptz not null default now()
);

create index call_briefs_deal_idx on public.call_briefs(deal_id);
create index call_briefs_status_idx on public.call_briefs(call_status) where published = true;
```

### Migration 0010 — LOI & Negotiation

```sql
-- supabase/migrations/0010_loi.sql

create type public.loi_outcome as enum (
  'in_progress', 'deal_reached', 'fallen_through'
);

create table public.loi_records (
  id                    uuid primary key default gen_random_uuid(),
  deal_id               uuid not null references public.deals(id) on delete cascade,

  submitted_at          date,
  offered_price         numeric(15,2),
  outcome               public.loi_outcome not null default 'in_progress',
  final_price           numeric(15,2),
  close_date            date,
  fallen_through_reason text,
  fallen_through_date   date,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
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

create index loi_rounds_loi_idx on public.loi_rounds(loi_id);
```

### Migration 0011 — Google OAuth Token Storage

```sql
-- supabase/migrations/0011_google_tokens.sql

create table public.google_tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  access_token     text not null,
  refresh_token    text,
  token_type       text,
  expiry           timestamptz,
  scopes           text[],
  last_history_id  text,   -- Gmail historyId for push notification processing
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id)
);
```

### Migration 0012 — Import Jobs

```sql
-- supabase/migrations/0012_import_jobs.sql

create table public.import_jobs (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  total_rows  int not null default 0,
  inserted    int not null default 0,
  skipped     int not null default 0,
  status      text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  error_log   text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

### Migration 0013 — Row-Level Security Policies

```sql
-- supabase/migrations/0013_rls_policies.sql

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

-- Helper: get the calling user's role from JWT (no DB round-trip)
create or replace function public.get_my_role()
returns public.user_role language sql stable security definer as $$
  select (auth.jwt()->>'role')::public.user_role
$$;

-- PROFILES
create policy "profiles: own row" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: internal sees all" on public.profiles
  for select using (public.get_my_role() = 'internal');

create policy "profiles: own update" on public.profiles
  for update using (id = auth.uid());

-- CAMPAIGNS: internal full access; client no access
create policy "campaigns: internal all" on public.campaigns
  for all using (public.get_my_role() = 'internal');

-- DEALS: internal full; client sees only good/very_good non-archived
create policy "deals: internal all" on public.deals
  for all using (public.get_my_role() = 'internal');

create policy "deals: client read good" on public.deals
  for select using (
    public.get_my_role() = 'client'
    and is_archived = false
    and score in ('good', 'very_good')
  );

-- CONTACTS: internal only
create policy "contacts: internal all" on public.contacts
  for all using (public.get_my_role() = 'internal');

-- EMAIL OUTREACH: internal only
create policy "email_outreach: internal all" on public.email_outreach
  for all using (public.get_my_role() = 'internal');

-- DOCUMENT CHECKLIST: internal only
create policy "document_checklist: internal all" on public.document_checklist
  for all using (public.get_my_role() = 'internal');

-- CA CREDENTIALS: internal only
create policy "ca_credentials: internal all" on public.ca_credentials
  for all using (public.get_my_role() = 'internal');

-- UNDERWRITING: internal only
create policy "underwriting: internal all" on public.underwriting
  for all using (public.get_my_role() = 'internal');

-- CALL BRIEFS: internal full; client sees published briefs for deals they can access
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

-- Client can ONLY update call_status and client_notes; cannot un-publish
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
    and published = true  -- client cannot flip published to false
  );
-- NOTE: In the /api/calls/[id] PATCH route, explicitly whitelist updatable fields:
--   const { call_status, client_notes } = await req.json()
--   Only pass { call_status, client_notes } to the Supabase update — never spread the full body.

-- LOI: internal only
create policy "loi_records: internal all" on public.loi_records
  for all using (public.get_my_role() = 'internal');

create policy "loi_rounds: internal all" on public.loi_rounds
  for all using (public.get_my_role() = 'internal');

-- GOOGLE TOKENS: own row only
create policy "google_tokens: own row" on public.google_tokens
  for all using (user_id = auth.uid());

-- IMPORT JOBS: internal only
create policy "import_jobs: internal all" on public.import_jobs
  for all using (public.get_my_role() = 'internal');
```

### Migration 0014 — Utility Functions & Pipeline View

```sql
-- supabase/migrations/0014_functions.sql

-- updated_at auto-update trigger
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare t text;
begin
  foreach t in array array[
    'profiles','campaigns','deals','email_outreach',
    'document_checklist','underwriting','call_briefs',
    'loi_records','google_tokens','import_jobs'
  ] loop
    execute format('
      create trigger trg_%s_updated_at
      before update on public.%s
      for each row execute procedure public.update_updated_at();
    ', t, t);
  end loop;
end $$;

-- Dashboard pipeline summary — security definer function (enforces internal-only access)
-- Returns no rows for non-internal callers
create or replace function public.get_pipeline_summary()
returns table (
  campaign_name          text,
  market                 text,
  leads                  bigint,
  emails_sent            bigint,
  responses_positive     bigint,
  underwritten           bigint,
  scored_good            bigint,
  loi_count              bigint,
  closed_count           bigint
) language sql stable security definer as $$
  select
    c.name,
    c.market,
    count(*) filter (where d.stage = 'lead'),
    count(*) filter (where e.status = 'sent'),
    count(*) filter (where e.response_classification = 'positive'),
    count(*) filter (where d.stage in ('underwriting','scored','call_scheduled','loi','closed')),
    count(*) filter (where d.score in ('good','very_good')),
    count(*) filter (where d.stage in ('loi','closed')),
    count(*) filter (where d.stage = 'closed')
  from public.deals d
  join public.campaigns c on c.id = d.campaign_id
  left join public.email_outreach e on e.deal_id = d.id
  where public.get_my_role() = 'internal'   -- hard gate: returns empty for client role
  group by c.id, c.name, c.market
$$;
```

### Run All Migrations

```bash
npx supabase db push
# Verify — output must be empty:
npx supabase db diff --linked
```

---

## 5. Supabase Type Generation

```bash
npx supabase gen types typescript \
  --project-ref $SUPABASE_PROJECT_ID \
  --schema public \
  > src/lib/supabase/types.ts
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --project-ref $SUPABASE_PROJECT_ID --schema public > src/lib/supabase/types.ts",
    "db:push": "supabase db push",
    "db:push:local": "supabase db push --local",
    "db:reset": "supabase db reset"
  }
}
```

Note: the flag is `--project-ref`, not `--project-id`. Using `--project-id` will throw an unknown flag error in Supabase CLI v2.

---

## 6. Supabase Client Setup

### `src/lib/supabase/client.ts` (browser)

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `src/lib/supabase/server.ts` (server components / API routes — anon key)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### `src/lib/supabase/admin.ts` (service role — SERVER ONLY)

```typescript
// CRITICAL: Never import this file in any component or client-side code.
// Only import in: /api/emails/webhook, /api/admin/*, and background job files.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client cannot be used in browser context')
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

### `src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  return { supabaseResponse, user }
}
```

### `src/middleware.ts`

```typescript
import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  // Read role from JWT app_metadata — no extra DB round-trip
  // Role is written to app_metadata by handle_new_user trigger and role-change API
  const role = (user as any)?.app_metadata?.role as 'internal' | 'client' | undefined

  const path = request.nextUrl.pathname
  const isAuthRoute     = path.startsWith('/login') || path.startsWith('/signup')
  const isInternalRoute = path.startsWith('/dashboard') || path.startsWith('/deals') ||
                          path.startsWith('/campaigns') || path.startsWith('/import') ||
                          path.startsWith('/settings')
  const isClientRoute   = path.startsWith('/overview') || path.startsWith('/calls')

  // Unauthenticated user → redirect to login
  if (!user && (isInternalRoute || isClientRoute)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated user on auth route → redirect to their dashboard
  if (user && isAuthRoute) {
    const dest = role === 'client' ? '/overview' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Wrong-role route enforcement
  if (user && isClientRoute && role !== 'client') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (user && isInternalRoute && role !== 'internal') {
    return NextResponse.redirect(new URL('/overview', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

---

## 7. Shared Components

### `src/components/shared/ReactQueryProvider.tsx`

```typescript
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

Add to `src/app/layout.tsx`:

```typescript
import { ReactQueryProvider } from '@/components/shared/ReactQueryProvider'
// ...
<ReactQueryProvider>{children}</ReactQueryProvider>
```

### `src/components/shared/LoadingSpinner.tsx`

```typescript
// Props: size?: 'sm' | 'md' | 'lg' (default 'md')
// Sizes: sm=16px border-2, md=24px border-[3px], lg=40px border-4
// Implementation: Tailwind animate-spin, border-t-blue-600, rounded-full
// Use size='sm' inside buttons; size='lg' centered in page-level loading containers
```

Full implementation:

```typescript
interface LoadingSpinnerProps { size?: 'sm' | 'md' | 'lg' }

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-[3px]',
  lg: 'h-10 w-10 border-4',
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className={`animate-spin rounded-full border-slate-200 border-t-blue-600 ${sizeMap[size]}`} />
  )
}
```

### `src/components/shared/EmptyState.tsx`

```typescript
// Props:
//   icon?: LucideIcon
//   title: string
//   description?: string
//   action?: { label: string; onClick: () => void }
// Layout: centered column, icon 48px text-slate-400, title text-slate-600 text-lg font-medium,
//         description text-slate-400 text-sm max-w-xs text-center,
//         action renders a Button if provided
```

### `src/app/not-found.tsx`

```typescript
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
      <h1 className="text-6xl font-bold text-slate-200">404</h1>
      <p className="text-slate-600 text-lg">This page doesn't exist.</p>
      <a href="/dashboard" className="text-blue-600 hover:underline text-sm">Go to Dashboard</a>
    </div>
  )
}
```

### `src/app/(internal)/error.tsx` and `src/app/(client)/error.tsx`

```typescript
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-semibold text-slate-800">Something went wrong</h2>
      <p className="text-slate-500 text-sm max-w-sm text-center">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  )
}
```

---

## 8. Rate Limiting

### `src/lib/rate-limit.ts`

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// 5 login attempts per 15 minutes per IP
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:login',
})

// 100 outreach emails per day per user
export const emailSendRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 d'),
  prefix: 'rl:email',
})
```

Apply in API routes:

```typescript
// Example usage in /api/auth/login/route.ts:
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
const { success } = await loginRateLimit.limit(ip)
if (!success) return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
```

---

## 9. Authentication — Cloudflare Turnstile

### 9.1 — CSRF Check Helper

Add to all state-changing API routes (POST, PATCH, DELETE):

```typescript
// Helper to add at the top of each state-changing API route handler:
const origin = req.headers.get('origin')
if (origin !== process.env.NEXT_PUBLIC_APP_URL) {
  return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
}
```

### 9.2 — Verify Endpoint

```typescript
// src/app/api/turnstile/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { token } = await req.json()

  // Read IP from headers — NextRequest.ip was removed in Next.js 13+
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           ?? req.headers.get('x-real-ip')
           ?? undefined

  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        ...(ip && { remoteip: ip }),
      }),
    }
  )

  const data = await res.json()
  if (!data.success) {
    return NextResponse.json({ success: false }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
```

### 9.3 — Login API Route

```typescript
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginRateLimit } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validations/auth.schema'

export async function POST(req: NextRequest) {
  // CSRF
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { success: rateLimitOk } = await loginRateLimit.limit(ip)
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
  }

  // Validate input
  const body = await req.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { email, password, turnstileToken } = parsed.data

  // Verify Turnstile server-side
  const turnstileRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/turnstile/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'origin': process.env.NEXT_PUBLIC_APP_URL! },
    body: JSON.stringify({ token: turnstileToken }),
  })
  if (!turnstileRes.ok) {
    return NextResponse.json({ error: 'Bot verification failed. Please try again.' }, { status: 400 })
  }

  // Authenticate
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  return NextResponse.json({ role: data.user.app_metadata?.role })
}
```

Apply the same Turnstile + rate limit gate to `/api/auth/signup/route.ts`.

### 9.4 — Login Page UI

```
LOGIN PAGE FULL SPEC:
Route: /login
Layout: centered card (max-w-sm mx-auto) on a dark slate-900 full-screen background

Card (bg-white rounded-xl shadow-lg p-8) contains:
  - App wordmark/logo (SVG or text) centered at top, mb-6
  - H1: "Sign in" — text-xl font-semibold text-slate-900, mb-1
  - Subtitle: "Acquisition Platform" — text-sm text-slate-500, mb-6
  - Email input:
      type="email", label="Email address" (above input, text-sm font-medium text-slate-700)
      placeholder="you@company.com", autocomplete="email"
      Full-width, border-slate-300, rounded-md, focus:ring-blue-500
  - Password input:
      type="password" (toggle show/hide via eye icon button, right-side inset)
      label="Password", autocomplete="current-password"
  - Turnstile widget: rendered below password, centered, theme="light"
      Submit button is disabled until Turnstile fires onVerify callback
  - Submit button:
      Full-width, bg-blue-600 hover:bg-blue-700 text-white, rounded-md, h-10
      Text: "Sign in" (idle) | <LoadingSpinner size="sm" /> (submitting)
      Disabled when: isSubmitting=true OR Turnstile not yet verified
  - Error display (below submit, only when error exists):
      Red alert box (bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm)
      "Invalid email or password." — on 401
      "Bot verification failed. Please try again." — on Turnstile fail
      "Too many attempts. Try again in 15 minutes." — on 429
  - "Forgot password?" link: text-sm text-blue-600 underline, href="/reset-password"
    (stub page in Phase 1, shows "Feature coming soon" message)

Behavior on success:
  - Read role from response JSON
  - If role === 'client' → router.push('/overview')
  - If role === 'internal' (or any other) → router.push('/dashboard')

Mobile (< 640px): full-screen card, no border-radius, no shadow, p-6
```

---

## 10. Gmail & Google Drive Integration

### 10.1 — OAuth Flow

```
User clicks "Connect Gmail" →
  GET /api/auth/google →
    Redirect to Google OAuth consent screen →
  Google redirects to /api/auth/google/callback →
    Exchange code for tokens →
    Upsert tokens into public.google_tokens →
    Call gmail.users.watch() to register push notifications →
    Store returned historyId in google_tokens.last_history_id →
  Redirect to /settings?gmail=connected
```

### 10.2 — `src/lib/google/oauth.ts`

```typescript
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

// Use gmail.modify (not gmail.readonly) — required for push notifications;
// gmail.readonly would trigger Google's sensitive-scope verification delay
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.file',
]

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

export function getAuthUrl() {
  return getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export async function exchangeCode(code: string) {
  const { tokens } = await getOAuthClient().getToken(code)
  return tokens
}

// Returns an authenticated OAuth2 client with auto-refresh wired to DB
export async function getAuthedClient(userId: string) {
  const supabase = await createClient()

  const { data: tokenRow, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokenRow) {
    throw new Error('Google account not connected. Visit /settings to connect Gmail.')
  }

  const oauthClient = getOAuthClient()
  oauthClient.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token ?? undefined,
    expiry_date: tokenRow.expiry ? new Date(tokenRow.expiry).getTime() : undefined,
  })

  // Persist refreshed tokens back to DB automatically
  oauthClient.on('tokens', async (tokens) => {
    await supabase.from('google_tokens').update({
      access_token: tokens.access_token ?? tokenRow.access_token,
      expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : tokenRow.expiry,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  })

  return oauthClient
}
```

### 10.3 — `/api/auth/google/callback/route.ts`

After storing tokens, immediately register Gmail push notifications:

```typescript
// After upserting tokens:
const gmail = google.gmail({ version: 'v1', auth })
const watchRes = await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
    labelIds: ['INBOX'],
  },
})
// Store historyId for incremental push processing
await supabase.from('google_tokens').update({
  last_history_id: watchRes.data.historyId ?? null,
}).eq('user_id', userId)
```

### 10.4 — Gmail Push Notification Setup (One-Time Deployment Step)

🛑 **STOP — Complete these steps in Google Cloud Console before deploying.**

```
1. Google Cloud Console → Pub/Sub → Create Topic
   Topic ID: gmail-notifications

2. Add Publisher permission on the topic:
   Principal: gmail-api-push@system.gserviceaccount.com
   Role: Pub/Sub Publisher

3. Create Push Subscription on the topic:
   Subscription ID: gmail-notifications-sub
   Delivery type: Push
   Endpoint URL: https://yourdomain.com/api/emails/webhook
   Audience (for JWT verification): https://yourdomain.com/api/emails/webhook

4. Gmail watch expires after 7 days. Add a Vercel Cron Job:
   In vercel.json:
   {
     "crons": [{
       "path": "/api/auth/google/refresh-watch",
       "schedule": "0 12 */6 * *"   // every 6 days at noon UTC
     }]
   }
   The refresh-watch route calls gmail.users.watch() for all users with google_tokens.
```

### 10.5 — Gmail Webhook with Authentication

```typescript
// src/app/api/emails/webhook/route.ts
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedClient } from '@/lib/google/oauth'
import { NextRequest, NextResponse } from 'next/server'

const pubsubClient = new OAuth2Client()

export async function POST(req: NextRequest) {
  // 1. Verify the Bearer JWT from Google Pub/Sub
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  try {
    const ticket = await pubsubClient.verifyIdToken({
      idToken: token,
      audience: `${process.env.NEXT_PUBLIC_APP_URL}/api/emails/webhook`,
    })
    const payload = ticket.getPayload()
    if (payload?.email !== 'gmail-api-push@system.gserviceaccount.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // 2. Parse Pub/Sub message (base64-encoded)
  const body = await req.json()
  const messageData = Buffer.from(body.message.data, 'base64').toString()
  const notification = JSON.parse(messageData) as { emailAddress: string; historyId: string }

  // 3. Find user by email, fetch new Gmail history since last historyId
  const supabase = createAdminClient()
  const { data: authUser } = await supabase
    .from('google_tokens')
    .select('user_id, last_history_id')
    .eq('user_id', /* lookup by emailAddress */ notification.emailAddress)
    .single()

  if (!authUser) return NextResponse.json({ ok: true }) // unknown user, ignore

  const auth = await getAuthedClient(authUser.user_id)
  const gmail = google.gmail({ version: 'v1', auth })

  const historyRes = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: authUser.last_history_id ?? notification.historyId,
    historyTypes: ['messageAdded'],
    labelId: 'INBOX',
  })

  // 4. Match new messages to email_outreach by gmail_thread_id
  for (const historyItem of historyRes.data.history ?? []) {
    for (const msg of historyItem.messagesAdded ?? []) {
      const threadId = msg.message?.threadId
      if (!threadId) continue

      const { data: outreach } = await supabase
        .from('email_outreach')
        .select('id, status')
        .eq('gmail_thread_id', threadId)
        .single()

      if (outreach && outreach.status === 'sent') {
        await supabase.from('email_outreach').update({
          status: 'replied',
          responded_at: new Date().toISOString(),
          // response_classification left null — internal team must classify on Outreach tab
        }).eq('id', outreach.id)
      }
    }
  }

  // 5. Update stored historyId
  await supabase.from('google_tokens').update({
    last_history_id: notification.historyId,
  }).eq('user_id', authUser.user_id)

  return NextResponse.json({ ok: true })
}
```

### 10.6 — `src/lib/google/drive.ts`

```typescript
import { google } from 'googleapis'
import { getAuthedClient } from './oauth'

export async function createDealFolder(
  userId: string,
  dealName: string,
  parentFolderId?: string
): Promise<{ folderId: string; folderUrl: string }> {
  const auth = await getAuthedClient(userId)
  const drive = google.drive({ version: 'v3', auth })

  const folder = await drive.files.create({
    requestBody: {
      name: dealName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: 'id, webViewLink',
  })

  // Set anyone-with-link viewer access
  await drive.permissions.create({
    fileId: folder.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  return {
    folderId: folder.data.id!,
    folderUrl: folder.data.webViewLink!,
  }
}
```

Drive folder API route (`POST /api/deals/[id]/drive`):
1. Authenticate user; confirm Gmail/Drive is connected (return 400 if not).
2. Call `createDealFolder(userId, deal.deal_name)`.
3. PATCH `deals.drive_folder_url` with the returned URL.
4. Return `{ drive_folder_url }` to client.

---

## 11. CoStar Import Parser

```typescript
// src/lib/import/costar-parser.ts
import ExcelJS from 'exceljs'

const COLUMN_MAP: Record<string, string> = {
  'Property Address':    'address',
  'City':               'city',
  'State':              'state',
  'Zip':                'zip',
  'Property Name':      'deal_name',
  'Property ID':        'property_id',
  'Building Class':     'building_class',
  'Year Built':         'year_built',
  'Number of Units':    'unit_count',
  'Property Type':      'property_type',
  'For Sale Price':     'asking_price',  // written to underwriting table
  'CoStar Property URL': 'property_link',
}

export interface ParsedDeal {
  address?: string; city?: string; state?: string; zip?: string
  deal_name?: string; property_id?: string
  building_class?: string; year_built?: number; unit_count?: number
  property_type?: string; asking_price?: number; property_link?: string
}

export async function parseCoStarFile(buffer: ArrayBuffer): Promise<ParsedDeal[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const sheet = wb.worksheets[0]
  if (!sheet) throw new Error('No worksheet found in file')

  const headers: string[] = []
  const deals: ParsedDeal[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => headers.push(String(cell.value ?? '')))
      return
    }
    const obj: Record<string, unknown> = {}
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      const mappedKey = COLUMN_MAP[header]
      if (mappedKey) obj[mappedKey] = cell.value
    })
    deals.push(obj as ParsedDeal)
  })

  return deals
}
```

### Import API Route — File Validation

```typescript
// src/app/api/deals/import/route.ts
export async function POST(req: NextRequest) {
  // CSRF + auth checks first (see Section 11 API Route Patterns)

  const form = await req.formData()
  const file = form.get('file') as File | null
  const campaignId = form.get('campaign_id') as string | null

  if (!file || !campaignId) {
    return NextResponse.json({ error: 'file and campaign_id required' }, { status: 400 })
  }

  // Size check
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 413 })
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Magic bytes check: xlsx (ZIP) starts with PK\x03\x04
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B &&
                bytes[2] === 0x03 && bytes[3] === 0x04
  if (!isZip) {
    return NextResponse.json({ error: 'File must be a valid .xlsx file' }, { status: 415 })
  }

  let deals: ParsedDeal[]
  try {
    deals = await parseCoStarFile(buffer)
  } catch {
    return NextResponse.json({ error: 'Could not parse file. Ensure it is a valid CoStar export.' }, { status: 422 })
  }

  if (deals.length === 0) {
    return NextResponse.json({ error: 'No data rows found in file' }, { status: 422 })
  }

  // Create import job, store parsed rows for confirmation step
  const supabase = await createClient()
  const { data: job } = await supabase.from('import_jobs').insert({
    campaign_id: campaignId,
    user_id: user.id,
    total_rows: deals.length,
    status: 'pending',
  }).select('id').single()

  // Check duplicates and invalids, return preview
  // import_batch format: "YYYY-MM-DD_{campaignUuid}"
  const batchTag = `${new Date().toISOString().slice(0, 10)}_${campaignId}`

  // ... duplicate detection, preview generation ...

  return NextResponse.json({ batchId: job!.id, preview: /* ... */ , batchTag })
}
```

Confirm route (`POST /api/deals/import/[batchId]/confirm`) triggers a Supabase Edge Function for bulk insert to avoid Vercel's 60s timeout. The Edge Function updates `import_jobs.inserted` + `import_jobs.status` as it processes rows. The client polls `GET /api/deals/import/[batchId]/status` every 2 seconds.

---

## 12. Zod Validation Schemas

### `src/lib/validations/auth.schema.ts`

```typescript
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  turnstileToken: z.string().min(1, 'Please complete the bot check'),
})

export const signupSchema = loginSchema.extend({
  fullName: z.string().min(2).max(100),
  role: z.enum(['internal', 'client']).default('internal'),
})
```

### `src/lib/validations/deal.schema.ts`

```typescript
import { z } from 'zod'

const CURRENT_YEAR = new Date().getFullYear()

export const createDealSchema = z.object({
  campaign_id: z.string().uuid(),
  deal_name: z.string().min(1).max(255),
  source: z.enum(['direct', 'indirect']),
  listing_type: z.enum(['on_market', 'off_market']).optional(),
  property_type: z.enum(['multifamily','retail','office','industrial','mixed_use','other']).optional(),
  building_class: z.enum(['A','B','C','D','unclassified']).optional(),
  year_built: z.number().int().min(1800).max(CURRENT_YEAR).optional().nullable(),
  unit_count: z.number().int().min(1).optional().nullable(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).toUpperCase().optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
})

export const patchDealSchema = createDealSchema.partial().extend({
  stage: z.enum([
    'lead','outreach','response','document_collection',
    'underwritability_review','underwriting','scored','call_scheduled',
    'loi','closed','archived'
  ]).optional(),
  score: z.enum(['very_good','good','bad','very_bad']).optional().nullable(),
  is_archived: z.boolean().optional(),
  archive_reason: z.string().max(500).optional().nullable(),
  internal_notes: z.string().max(10000).optional().nullable(),
  drive_folder_url: z.string().url().optional().nullable(),
})
```

### `src/lib/validations/contact.schema.ts`

```typescript
import { z } from 'zod'

export const createContactSchema = z.object({
  deal_id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  email: z.array(z.string().email()).min(1, 'At least one email required'),
  phone_office: z.string().max(30).optional(),
  phone_cell: z.string().max(30).optional(),
  is_primary: z.boolean().default(false),
})

export const patchContactSchema = createContactSchema.partial().omit({ deal_id: true })
```

---

## 13. Email Templates

```typescript
// src/lib/email/templates/outreach.tsx
import { Html, Body, Container, Text, Heading } from '@react-email/components'

interface OutreachEmailProps {
  ownerName: string
  propertyAddress: string
  senderName: string
  customParagraph?: string
}

export default function OutreachEmail({ ownerName, propertyAddress, senderName, customParagraph }: OutreachEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading style={{ fontSize: '18px' }}>Regarding {propertyAddress}</Heading>
          <Text>Dear {ownerName},</Text>
          <Text>{customParagraph ?? 'I am reaching out regarding your property. We are active acquirers in this market and would love to connect.'}</Text>
          <Text>Best regards,<br />{senderName}</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

Render to HTML string for Gmail:

```typescript
// render() is async in @react-email/render v1+
import { render } from '@react-email/render'
const html = await render(<OutreachEmail {...props} />)
```

---

## 14. API Route Patterns

All API routes follow this standard pattern:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. (For state-changing methods) CSRF check
  // if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
  //   return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  // }

  // 3. Query — RLS handles data scoping automatically
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      contacts(*),
      campaigns(name, market),
      underwriting(underwritability, asking_price),
      call_briefs(id, call_status, published)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### LOI API Routes

```
POST /api/loi
  Body: { deal_id, submitted_at, offered_price }
  Actions:
    1. Validate with Zod (deal_id uuid, offered_price positive number)
    2. Upsert loi_records (unique on deal_id)
    3. Advance deals.stage to 'loi'
  Auth: internal only

PATCH /api/loi/[id]
  Body: { outcome?, final_price?, close_date?, fallen_through_reason?, fallen_through_date? }
  Actions:
    1. Update loi_records
    2. If outcome='deal_reached': advance deal.stage to 'closed'
    3. If outcome='fallen_through': set deal.is_archived=true,
       deal.archive_reason='LOI fallen through'
  Auth: internal only

POST /api/loi/[id]/rounds
  Body: { price, party ('buyer'|'seller'), round_date, notes? }
  Actions:
    1. Compute next round_num:
       SELECT COALESCE(MAX(round_num), 0) + 1 FROM loi_rounds WHERE loi_id = $1
    2. Insert into loi_rounds
  Auth: internal only

GET /api/loi/[id]/rounds
  Returns: all rounds ordered by round_num ASC
  Auth: internal only
```

### Contact API Routes

```
POST /api/contacts
  Body: { deal_id, name?, company?, title?, email[], phone_office?, phone_cell?, is_primary }
  Validation: at least one email; if is_primary=true, unset existing primary for same deal first
  Auth: internal only

PATCH /api/contacts/[id]
  Body: partial contact fields; same is_primary logic
  Auth: internal only

DELETE /api/contacts/[id]
  Guard: cannot delete if is_primary=true AND other contacts exist for same deal
  Return 409: "Cannot delete primary contact. Reassign primary contact first."
  Auth: internal only
```

### Response Classification Flow

```
POST /api/emails/send
  Body: { deal_id, contact_id }
  Actions:
    1. CSRF + rate limit check (emailSendRateLimit.limit(userId))
    2. Load contact, load email template for campaign
    3. Render React Email template to HTML
    4. Send via Gmail API
    5. Insert email_outreach record: { status:'sent', sent_at, gmail_message_id, gmail_thread_id }
    6. If deal.stage === 'lead': advance to 'outreach'
  Auth: internal only; return 400 if Gmail not connected

PATCH /api/emails/[id]
  Allowed body fields:
    response_classification: 'positive'|'neutral'|'negative'|'no_response'
    thank_you_sent: true  (triggers sending thank-you email and records thank_you_sent_at)
    declination_sent: true  (triggers sending declination email and records declination_sent_at)
    conversation_log: string  (plain text, max 5000 chars)
  Auth: internal only
```

**Never use the service role key in any API routes that serve user requests.** Use `createAdminClient()` only in: Gmail webhook, `/api/admin/*` routes.

---

## 15. Building the UI — Phase Order

Build and verify each phase before moving to the next.

### Phase A — Auth Shell

1. Build login page per full spec in Section 9.4.
2. Build signup page (same Turnstile + Zod gate).
3. Build `/reset-password` stub page: centered card with "Password reset is coming soon."
4. Test: unauthenticated visit to `/dashboard` redirects to `/login`.

### Phase B — Internal Layout & Navigation

```
INTERNAL SIDEBAR SPEC:
- Fixed left sidebar, 240px wide on desktop (≥ 1024px)
- Collapsible to 60px icon-only rail at < 1024px; chevron toggle at bottom
- Background: bg-slate-900, border-r border-slate-700
- Top: app logo (SVG wordmark) + "Acquisition Platform" text (hidden in icon-only mode)
- Nav items (in order, with lucide-react icons):
    Dashboard     — LayoutDashboard  — href: /dashboard
    Deals         — Building2        — href: /deals
    Campaigns     — Megaphone        — href: /campaigns
    Import        — Upload           — href: /import
    Settings      — Settings         — href: /settings
- Active item: bg-slate-700 rounded-md, left border 2px solid blue-500, text-white
- Inactive item: text-slate-400, hover:bg-slate-800 hover:text-slate-200
- Bottom: user avatar (initials fallback circle) + full_name + role badge
    Role badge: "Internal" (blue-600) | "Client" (purple-600)
    Clicking → dropdown with "Profile" and "Sign out" (POST /api/auth/logout)
- Mobile (< 1024px): sidebar becomes a Sheet (shadcn) slide-in drawer;
    hamburger icon in a top header bar (h-14, bg-white, border-b border-slate-200)
    triggers the Sheet
- error.tsx: per Section 7
```

### Phase C — Deal List & Pipeline View

```
DEAL TABLE SPEC:
Component: src/components/deals/DealTable.tsx

Columns (default visible; user can toggle via gear icon popover top-right):
  1. Property Name (deal_name) — clickable → /deals/[id]; max-w-xs truncate
  2. Address (address, city, state) — single line, text-sm text-slate-500
  3. Units (unit_count) — right-aligned integer; "—" if null
  4. Stage — <DealStageBar inline pill /> showing stage name in a colored badge
  5. Score — <DealScoreBadge /> (see spec below)
  6. Campaign — campaign.name, text-slate-600
  7. Date Added (created_at) — "May 14, 2026" format via date-fns
  8. Actions — kebab menu (MoreHorizontal icon):
       View → /deals/[id]
       Archive → confirmation Dialog → PATCH { is_archived: true, archive_reason }
       Delete → confirmation Dialog → DELETE /api/deals/[id] (permanent)

Column toggle: gear (Settings) icon button, top-right of table, opens Popover with
  checkboxes for each column; state persisted in localStorage key 'dealTableColumns'

Sorting: click column header; ↑↓ icon indicates direction; default: created_at DESC

Filter bar (above table, flex-wrap gap-2):
  Campaign:     multi-select <Select>; default "All campaigns"
  Stage:        multi-select; default "All stages"
  Score:        multi-select; default "All scores"
  Listing Type: single select; "All" | "On Market" | "Off Market"
  State:        multi-select; populated from distinct(state) query
  Search:       text input with Search icon; 300ms debounce;
                calls Supabase .textSearch() with type:'websearch' on the FTS index

Pagination: 50 rows per page; "Showing 1–50 of 234 deals"; Prev/Next buttons

Empty state: <EmptyState icon={Building2} title="No deals found"
  description="Import properties from CoStar to get started"
  action={{ label: "Import from CoStar", onClick: () => router.push('/import') }} />

Loading state: 5 skeleton rows, full-width shimmer (animate-pulse bg-slate-100)

Row click: navigate to /deals/[id]; entire row clickable except Actions column

Bulk select: leftmost checkbox column; when 1+ selected, a fixed bottom bar appears:
  "N selected — [Archive Selected] [Clear]"

DealScoreBadge colors:
  very_good → bg-green-100 text-green-800 border-green-200 "Very Good"
  good      → bg-teal-100 text-teal-800 border-teal-200 "Good"
  bad       → bg-orange-100 text-orange-800 border-orange-200 "Bad"
  very_bad  → bg-red-100 text-red-800 border-red-200 "Very Bad"
  null      → bg-slate-100 text-slate-500 "Unscored"
```

### Phase D — Deal Detail Page (Core UI)

Tabbed interface with 7 tabs. Each tab loads its data independently.

```
TABS: [Overview] [Contacts] [Outreach] [Documents] [Underwriting] [LOI] [Call Brief]
```

#### Overview Tab

```
- Property info: deal_name (H1, text-2xl), address block, unit_count, year_built,
  building_class badge, property_type badge, listing_type badge
- Stage progress bar (DealStageBar — full spec below)
- Score badge (DealScoreBadge)
- Drive folder: if drive_folder_url set → "Open Drive Folder" button (ExternalLink icon)
  if not set → "Create Drive Folder" button → POST /api/deals/[id]/drive
- Source + campaign name
- Internal notes: textarea, auto-saves on blur, 500ms debounce, max 10000 chars

DEAL STAGE BAR SPEC (DealStageBar.tsx):
- Horizontal stepper, all 11 stages as labeled steps:
  Lead → Outreach → Response → Documents → UW Review →
  Underwriting → Scored → Call Scheduled → LOI → Closed | Archived
- Completed stages: filled circle bg-green-500, checkmark icon inside, muted label
- Active stage: filled circle bg-blue-600, bold label below
- Future stages: empty circle border-slate-300, muted text-slate-400 label
- Archived: if is_archived=true, hide stepper, show red badge "Archived" + archive_reason
- Stage controls (below bar, internal users only):
    "Move to Next Stage" button — advances one step, PATCH /api/deals/[id]
    "Set Stage" <Select> — jump to any stage (for corrections)
    Stage change triggers PATCH and optimistic UI update
- Mobile (< 640px): collapse to "Stage 4 of 11: Documents" text + plain progress bar
```

#### Contacts Tab

```
CONTACTS TAB SPEC:
- List of contacts for this deal; each row shows:
    Name, Company/Title, Email(s) (comma-separated), Phone, Primary badge
- "Add Contact" button → opens Dialog:
    Name (text), Company (text), Title (text),
    Email(s): TagInput — type email, press Enter to add multiple
    Phone Office (text), Phone Cell (text)
    Primary Contact: Switch toggle
    Save → POST /api/contacts; refresh list
- Edit: pencil icon per row → same Dialog pre-filled → PATCH /api/contacts/[id]
- Delete: trash icon per row → confirm Dialog → DELETE /api/contacts/[id]
    (blocks if deleting the only primary contact with others existing)
- If no contacts: EmptyState "No contacts yet" with "Add Contact" CTA
```

#### Outreach Tab

```
OUTREACH TAB SPEC:
Top section — Email Status:
  Status badge: Not Sent (grey) | Sent (blue) | Replied (green) |
                Gmail Error (red) | Invalid Address (orange)
  If sent or later: "Sent [date]" and "To: [primary contact email]"

Send Outreach Email button:
  Disabled if: no primary contact with email, or status is not 'not_sent'
  If Gmail not connected: button disabled, tooltip "Connect Gmail in Settings first"
    + inline alert: "Gmail not connected. [Connect Gmail →]" (links to /settings)
  If Gmail connected: opens confirmation Dialog:
    "Send outreach email to [contact name] at [email]?"
    Shows subject line + first 200 chars of rendered template body
    Confirm → POST /api/emails/send → status set to 'sent'
    If deal.stage === 'lead', advances to 'outreach' automatically

Response Classification (visible only when status === 'replied'):
  "Classify this response:" <Select>:
    Positive | Neutral | Negative | No Response
    → PATCH /api/emails/[id] { response_classification }
  If Positive:
    → Show "Advance to Document Collection" button (PATCH deal.stage)
    → Show "Send Thank-You Email" button (PATCH { thank_you_sent: true })
  If Negative:
    → Show "Send Declination Email" button (PATCH { declination_sent: true })

Conversation Log:
  Textarea, placeholder: "Paste or summarize the email conversation here..."
  Manually edited by internal team — NOT auto-populated by webhook
  Auto-saves on blur; character count bottom-right "0 / 5000"

Email Thread panel (below):
  If gmail_thread_id set: "View Full Thread in Gmail" link-button (opens Gmail URL in new tab)
  No inline thread rendering in Phase 1
```

#### Documents Tab

```
DOCUMENT CHECKLIST TAB SPEC:
Layout: two-column on desktop (lg:grid-cols-2), single column on mobile

Left column — Document Collection:
  Each row: [Checkbox] [Label] [Optional field]   Auto-saves on change (500ms debounce)
  Documents:
  1. P&L Collected — checkbox + "Period" text input (e.g. "T12 Jan 2025")
  2. Rent Roll Collected — checkbox + date picker (type="date", label "As of")
  3. Offering Memorandum — checkbox only
  4. Tax Bill — checkbox only
  5. CapEx Schedule — checkbox only
  6. Market Report 1–4 — four checkboxes labeled "Market Report 1" through "Market Report 4"
  Saved via PATCH /api/deals/[id]/documents

Right column — Confidentiality Agreement:
  CA Status <Select>:
    Not Required (default, grey badge)
    Pending (yellow badge)
    Signed (blue badge)
    Approved (green badge)
  
  If status is Pending or Signed, show additional fields:
    Platform: text input (e.g. "Buildout", "CoStar", "CBRE")
    CA Credential: <Select> populated from ca_credentials table
      Displays: "[platform] — [username]" — NEVER shows password
    "+ Add New Credential" button → Dialog:
      Platform (text, required), Username (text, required),
      Password (type="password", required), Notes (textarea)
      Save → POST /api/ca-credentials (server encrypts via store_ca_credential function)
      On success: refresh the CA Credential <Select>

Drive Folder:
  If drive_folder_url set: "Open Drive Folder" button (ExternalLink icon)
  If not set: "Create Drive Folder" button → POST /api/deals/[id]/drive → refresh
```

#### Underwriting Tab

```
UNDERWRITING FORM TAB SPEC:
Three cards stacked vertically.

Card 1 — Underwritability Screening:
  Underwritability <Select>: "Underwritable" | "Not Underwritable" | "Maybe"
  On first save: screened_at = now(), screened_by = current user
  If "Not Underwritable": show warning banner with "Archive this deal?" button
    → Dialog with archive_reason textarea → PATCH { is_archived: true, archive_reason, stage: 'archived' }
  Saved via PATCH /api/deals/[id] + PATCH /api/underwriting (two separate calls)

Card 2 — Market Research (3-col grid on desktop, 1-col on mobile):
  All numeric inputs, formatted with commas on blur
  - Asking Price ($): currency format
  - Asking Price/Unit ($): auto-calculated from asking_price ÷ unit_count; shows "(auto)" label
    Manual override is allowed; removes "(auto)" label
  - Population 1mi: integer
  - Population Growth %: decimal (e.g. 3.2)
  - Rent Growth T12 %: decimal
  - Rent Growth Forward %: decimal
  - Vacancy Rate %: decimal
  - Market Price/Unit ($): currency
  - Market Delta %: auto-calculated: ((asking_price_per_unit - market_price_per_unit) /
      market_price_per_unit) × 100; read-only display; colored:
      green text if value < 0 (below market = good)
      red text if value > 0 (above market = bad)
  - Cap Rate %: decimal
  - Sale Comps Available: Yes/No toggle (Switch)
  - Rent Comps Available: Yes/No toggle (Switch)

Card 3 — Underwriting Summary:
  - Purchase Price ($): currency
  - Purchase Price/Unit ($): auto-calculated; purchase_price ÷ unit_count
  - CapEx Estimate ($): currency
  - IRR %: decimal
  - Equity Multiple: decimal (e.g. 2.3, displayed as "2.3×")
  - Cash-on-Cash %: decimal
  - Projected Profit ($): currency
  - Occupancy %: decimal
  - Notes: textarea, 5 rows min

Card 4 — Deal Score:
  Four large radio buttons with colored labels:
    ◉ Very Good (green-600)  ○ Good (teal-600)  ○ Bad (orange-600)  ○ Very Bad (red-600)
  Selecting a score: if deal.stage is currently 'underwriting', auto-advances to 'scored'
  "Flag for Client Call" button: visible only when score is 'good' or 'very_good'
    Clicking: creates a call_brief record (POST /api/calls with deal_id)
              advances deal.stage to 'call_scheduled'
              shows success toast "Deal flagged for client call"

Save behavior:
  Single "Save Underwriting" button at bottom of form
  Validates: percentages 0–100, prices > 0
  Shows field-level errors inline; success toast on save
```

#### LOI Tab

```
LOI TAB SPEC:
If no LOI record yet: EmptyState "No LOI submitted" + "Create LOI" button

Create LOI Dialog:
  Submitted Date: date picker
  Offered Price ($): currency input
  Submit → POST /api/loi

LOI Record Display:
  Submitted date, Offered price
  Outcome <Select>: In Progress | Deal Reached | Fallen Through
  If "Deal Reached": show Final Price ($) + Close Date fields
    → PATCH /api/loi/[id] { outcome, final_price, close_date }
    → deal.stage advances to 'closed'
  If "Fallen Through": show Reason textarea + Date
    → PATCH /api/loi/[id] { outcome, fallen_through_reason, fallen_through_date }
    → deal.is_archived = true, archive_reason = 'LOI fallen through'

Counter-Offer Rounds section (below main LOI card):
  Table: Round # | Party | Price | Date | Notes
  "Add Round" button → inline form (no Dialog):
    Party: <Select> "Buyer" | "Seller"
    Price ($), Date, Notes
    → POST /api/loi/[id]/rounds
    → refresh rounds table
```

#### Call Brief Tab

```
CALL BRIEF TAB SPEC (internal view):
If no call_brief record: EmptyState "No brief created" + "Create Brief" button
  → POST /api/calls { deal_id } → creates record with published=false, call_status='pending'

Once brief exists:
  Summary Text: large textarea, min-h-[200px]
    placeholder: "Write a plain-English summary of this deal for the client call..."
    auto-saves on blur

  Published toggle (<Switch>):
    OFF: grey label "Draft — not visible to client"
    ON: green label "Published — client can see this"
    Toggling ON: shows confirmation Dialog:
      "Publish this brief? The client will see it immediately."
      Confirm → PATCH /api/calls/[id] { published: true, published_at: now() }

  Call Status badge (read-only for internal):
    Pending (yellow) | Completed (green) | Cancelled (red)

  Client Notes (read-only for internal):
    Shows text entered by client, or "No notes yet" in muted text
```

### Phase E — Import Wizard

```
COSTAR IMPORT WIZARD SPEC:
Component: src/components/import/CoStarImportWizard.tsx
Route: /import
Stepper: 4 steps (Step 1 → 2 → 3 → 4), shown as horizontal progress bar at top

Step 1 — Upload:
  Campaign <Select>: required; loads from GET /api/campaigns
  File input: drag-and-drop zone (dashed border, Upload icon, "Drop .xlsx file or click to browse")
  Shows selected filename + size after selection
  "Preview Import" button → disabled until both campaign and file selected
  → POST /api/deals/import (multipart/form-data)

Step 2 — Preview:
  Table columns: Property Name | Address | City | State | Units | Building Class | Year Built | Status
  Status column values:
    "New" — bg-green-100 text-green-800 badge — will be inserted
    "Duplicate" — bg-yellow-100 text-yellow-800 badge — property_id already in this campaign; will be SKIPPED
    "Invalid" — bg-red-100 text-red-800 badge — missing required fields; will be skipped;
      tooltip on badge shows which fields are missing
  Summary bar above table:
    "142 properties parsed: 128 new · 10 duplicates · 4 invalid"
  Table is read-only (no editing)
  Pagination: 25 rows per page (reuse DealTable pagination component)
  "Import [N] New Properties" button (N = new count only)
    → disabled if new count is 0

Step 3 — Importing (loading):
  Progress bar: updated by polling GET /api/deals/import/[batchId]/status every 2s
  "Importing... 45 of 128"
  Cannot navigate away (browser beforeunload warning)

Step 4 — Success:
  "Import complete. 128 deals added to [Campaign Name]."
  Two buttons:
    "View Deals" → /deals?import_batch=[batchTag]  (pre-filtered)
    "Import Another File" → resets wizard to Step 1
```

### Phase F — Internal Dashboard

```
DASHBOARD PAGE SPEC:
Server component. Fetches: get_pipeline_summary() + recent deal counts.

Layout: page header "Dashboard" + subtitle current date

FunnelMetrics component:
  Vertical SVG funnel, 7 stages:
    Leads → Emails Sent → Responses → Underwritten → Scored Good → LOI → Closed
  Each stage: trapezoid width proportional to count (max width at Leads = 100%)
  Stage shows: name, absolute count, conversion % from prior stage
    e.g. "Responses: 47 (31% of Emails Sent)"
  Colors: gradient from blue-600 (top) to green-600 (bottom)
  Click a stage segment → navigate to /deals?stage=[stageName]
  Tooltip on hover: exact numbers + conversion vs. prior stage + conversion vs. Leads
  No animation in Phase 1
  Props: <FunnelMetrics data={pipelineSummary} /> — data fetched in server component

KPIScorecard component (3×2 grid, 2×3 on mobile):
  6 cards; each card: metric name, current value (large, font-bold), target (small, below),
  delta vs. target (green ↑ or red ↓), 7-day sparkline (recharts LineChart, no axes)
  KPIs:
    1. Total Leads       count(deals)                             Target: — (no target)
    2. Emails Sent       count(email_outreach status='sent')      Target: — (no target)
    3. Response Rate     replied / sent × 100%                    Target: campaigns.target_response_rate_pct
    4. Underwritten      count(stage ≥ underwriting)              Target: — (no target)
    5. Good Deals        count(score in good,very_good)           Target: — (no target)
    6. LOIs Submitted    count(stage in loi,closed)               Target: campaigns.target_loi_count
  Card border: green if value ≥ target; red if value < target; grey if no target
  Sparkline data: daily counts from a query grouping by created_at::date for last 7 days

PipelineTable component:
  Table showing campaign rows × stage columns; cell = count of deals in that stage
  Source: get_pipeline_summary() data
  Row click: filters deal list to that campaign
```

### Phase G — Client Dashboard

```
CLIENT OVERVIEW PAGE SPEC (/overview):
Page title: "Active Deals"
Subtitle: "Properties your team is actively pursuing"

Funnel summary strip (read-only, 3 numbers in a horizontal bar):
  Deals Reviewed | Currently Active | LOIs Submitted
  Source: aggregated from call_briefs + deals (client-visible only)

Deal cards grid (2-col desktop, 1-col mobile):
  Each card: <ClientDealCard />
    Property Name (bold)
    Address (text-sm text-slate-500)
    Score badge (Good / Very Good only)
    Unit count + year built
    Stage badge (simplified: "In Underwriting", "Offer Submitted", "Call Scheduled")
    Card is not clickable (no detail page for clients in Phase 1)

Empty state: "No active deals yet. Your team will notify you when deals are ready."

CLIENT CALLS PAGE SPEC (/calls):
Page title: "Call Queue"
Subtitle: "Review these deals before your call with the team"

Active briefs list (published=true, call_status='pending', ordered by flagged_at DESC):
  Each card:
    Property name (bold) + address
    Score badge
    Summary text (full text, not truncated)
    Call Status dropdown: Pending → Completed | Cancelled
      → PATCH /api/calls/[id] { call_status } (client_notes + call_status only)
    Client Notes: textarea, auto-saves on blur
    "Mark as Done" button: sets call_status='completed'

Completed calls section (call_status='completed' or 'cancelled'):
  Collapsible accordion at bottom of page, default collapsed
  Title: "Completed Calls ([N])"
  Same card layout but read-only

Empty state: "No calls queued yet. Your team will notify you."
```

### Phase H — Settings Page

```
SETTINGS PAGE SPEC:

Section 1 — Gmail Connection:
  If not connected:
    Alert: "Gmail not connected" (yellow) + "Connect Gmail" button → GET /api/auth/google
  If connected:
    Green badge "Gmail Connected" + email address
    "Disconnect" button → DELETE google_tokens row for current user

Section 2 — Campaign Management (internal only):
  Table: Campaign Name | Market | Listing Type | Email Template | Status | Actions
  "New Campaign" button → Dialog:
    Name (text, required), Market/State (text), Listing Type (select),
    Email Template (select: Outreach | Thank You | Declination),
    Subject Template (text, with variable hint)
    → POST /api/campaigns
  Edit (pencil) → same Dialog prefilled → PATCH /api/campaigns/[id]
  Deactivate toggle → PATCH { is_active: false }

Section 3 — Email Template Editor (internal only):
  Campaign selector: <Select> which campaign to edit
  Template key selector: <Select> — only 'outreach' is editable in Phase 1
  Subject line input: "Acquisition Inquiry — {{property_address}}"
  Body textarea: plain text with variable placeholders:
    {{owner_name}}, {{property_address}}, {{sender_name}}, {{custom_paragraph}}
  Variable reference panel (right side on desktop):
    {{owner_name}}         — Primary contact name
    {{property_address}}   — Full address
    {{sender_name}}        — Logged-in user's full_name
    {{custom_paragraph}}   — Custom body text for this campaign
  "Preview" button → Dialog showing rendered email with sample data
  "Save Template" button → PATCH /api/campaigns/[id] { email_template, email_subject_template }
  Note: React Email .tsx files provide the HTML wrapper;
        DB stores only the customizable subject and body paragraph

Section 4 — User Management (internal only):
  Table: Name | Email | Role | Status | Actions
  Status: "Active" (green) | "Invited" (yellow, awaiting signup)
  Actions: "Change Role" (select) | "Remove" (danger)
  "Invite User" button → Dialog:
    Email (required), Full Name (required)
    Role: <Select> Internal | Client
    If Client: "Organization" text input → saved to profiles.client_org
    "Send Invite" → POST /api/admin/invite
      (calls supabase.auth.admin.inviteUserByEmail() via SUPABASE_SERVICE_ROLE_KEY — server only)
      Invited user receives Supabase magic-link email; sets password on first login
  Remove → DELETE /api/admin/users/[id] (calls supabase.auth.admin.deleteUser())
  Role change → PATCH /api/admin/users/[id]:
    Updates profiles.role AND auth.users.raw_app_meta_data.role (keeps JWT in sync)
```

---

## 16. Database Seed

```sql
-- supabase/seed.sql
-- Run with: npx supabase db reset  (local only)

-- Internal test user: test-internal@example.com / Password123!
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'test-internal@example.com',
  crypt('Password123!', gen_salt('bf')),
  now(),
  '{"role": "internal"}',
  '{"full_name": "Internal Tester", "role": "internal"}'
);

-- Client test user: test-client@example.com / Password123!
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'test-client@example.com',
  crypt('Password123!', gen_salt('bf')),
  now(),
  '{"role": "client"}',
  '{"full_name": "CEO Client", "role": "client"}'
);

-- Seed campaign
insert into public.campaigns (id, name, market, listing_type, email_template,
  email_subject_template, is_active)
values (
  'cccccccc-0000-0000-0000-000000000001',
  'NJ Multifamily Q1 2026',
  'NJ',
  'off_market',
  'outreach',
  'Acquisition Inquiry — {{property_address}}',
  true
);

-- Seed 3 sample deals (spread across stages for UI testing)
insert into public.deals (id, campaign_id, deal_name, address, city, state, zip,
  unit_count, building_class, stage, score, property_type, source, created_by)
values
  ('dddddddd-0001-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'Oak Park Apartments', '123 Oak St', 'Newark', 'NJ', '07102',
   48, 'B', 'underwriting', 'good', 'multifamily', 'indirect',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0002-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'Riverside Heights', '456 River Rd', 'Jersey City', 'NJ', '07305',
   72, 'A', 'call_scheduled', 'very_good', 'multifamily', 'indirect',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0003-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001',
   'Maple Court', '789 Maple Ave', 'Trenton', 'NJ', '08608',
   24, 'C', 'lead', null, 'multifamily', 'indirect',
   'aaaaaaaa-0000-0000-0000-000000000001');
```

---

## 17. Error Handling & Observability

- Wrap all API routes in try/catch; return `{ error: string }` with appropriate HTTP status.
- Client-side: use `sonner` toast for user-facing errors and success messages.
- Log Gmail errors (invalid address, API quota exceeded) to `email_outreach.error_message`.
- Use `console.error` in development; wire `pino` logger in production.
- Database constraint violations (duplicate property_id) return 409 Conflict.
- Import jobs that fail write error details to `import_jobs.error_log` array.

---

## 18. Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` imported ONLY in `src/lib/supabase/admin.ts`; never in any component or user-facing API route
- [ ] `createAdminClient()` used ONLY in: `/api/emails/webhook`, `/api/admin/*`
- [ ] All user-facing queries use `createClient()` (anon key) — RLS handles scoping automatically
- [ ] CSRF origin check in all POST/PATCH/DELETE API routes
- [ ] Turnstile verified server-side (not just client-side) before auth operations
- [ ] Rate limiting applied to login (5/15min/IP) and email send (100/day/user)
- [ ] Google tokens stored in DB, never in localStorage or cookies
- [ ] CA credential passwords stored as `pgp_sym_encrypt` ciphertext — never plaintext
- [ ] CA credentials table never queried in any client-facing API route
- [ ] `.env.local` in `.gitignore`
- [ ] `GOOGLE_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY`, `DB_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — all server-only (no `NEXT_PUBLIC_` prefix)
- [ ] All API routes validate input with Zod before touching the database
- [ ] File uploads: magic bytes checked (not just Content-Type header), size capped at 10MB
- [ ] CSP headers configured in `next.config.ts`
- [ ] Gmail webhook verifies Google Pub/Sub JWT before processing
- [ ] `pipeline_summary` is a security-definer function with internal-role gate — not an unprotected view
- [ ] Client role update on `call_briefs` whitelists only `call_status` and `client_notes` at API layer
- [ ] User role change via `/api/admin/users/[id]` updates BOTH `profiles.role` AND `auth.users.raw_app_meta_data.role`

---

## 19. Testing Checklist (manual, per phase)

**Auth:**
- [ ] Login with wrong credentials returns 401 error message
- [ ] Login with missing/invalid Turnstile token blocked server-side (return 400)
- [ ] Login rate limit: 6th attempt within 15 min returns 429
- [ ] Logged-in client cannot access `/dashboard` (redirected to `/overview`)
- [ ] Logged-in internal user cannot access `/overview` (redirected to `/dashboard`)

**Deals:**
- [ ] CoStar import creates deal records with correct import_batch tag (`YYYY-MM-DD_{uuid}`)
- [ ] Duplicate Property ID in same campaign is flagged as "Duplicate", not inserted
- [ ] Stage progression saves correctly and optimistically updates UI
- [ ] Deal score "Good" → deal appears in client `/overview` page
- [ ] Archiving a deal removes it from client view

**Client Dashboard:**
- [ ] Client sees only Good/Very Good non-archived deals
- [ ] Client cannot access `/deals`, `/import`, `/campaigns`, `/dashboard` (redirected)
- [ ] Client can mark a call as complete and leave notes; internal user sees notes as read-only
- [ ] Client PATCH to call_brief cannot set `published=false`

**Gmail:**
- [ ] Connect Gmail → tokens saved to `google_tokens`; Gmail watch registered
- [ ] Send outreach email → `email_outreach.status='sent'`, `gmail_message_id` stored
- [ ] Webhook fires on reply → `status` updated to `'replied'`, `responded_at` set
- [ ] Webhook with invalid JWT returns 401

**Security:**
- [ ] Direct POST to `/api/emails/send` from different origin returns 403 (CSRF)
- [ ] `GET /api/pipeline-summary` as client user returns empty (role gate)
- [ ] `GET /api/ca-credentials` is not accessible (internal-only RLS)

---

## 20. Deployment Notes

### Vercel (recommended)

```bash
npm i -g vercel
vercel
```

Set all env vars in Vercel Dashboard → Project → Settings → Environment Variables.

Add `vercel.json` for Gmail watch cron:

```json
{
  "crons": [
    {
      "path": "/api/auth/google/refresh-watch",
      "schedule": "0 12 */6 * *"
    }
  ]
}
```

### Supabase Production

- Enable Point-in-Time Recovery in Supabase project settings.
- Complete the Gmail Pub/Sub setup per Section 10.4 before first Gmail connection.

### Post-deploy

```bash
npx supabase db push            # apply migrations to production
npm run db:types                 # regenerate types against production schema
```

---

## 21. Future Expansion Points

Do not build these in Phase 1. The architecture supports them cleanly:

- **Email open tracking** — add `opened_at` to `email_outreach`, use tracking pixel via API route
- **Automated follow-up sequences** — `follow_up_sequences` table + Supabase pg_cron
- **DocuSign CA signing** — extend `ca_credentials` with DocuSign envelope ID
- **Financial projections PDF** — export button on underwriting tab, Puppeteer Edge Function
- **Multi-tenant / multi-client** — add `organization_id` FK to campaigns + deals; update RLS
- **Mobile app** — Supabase Realtime + same API routes work for React Native
- **Full Gmail thread inline rendering** — fetch thread body in outreach tab (currently just link)
- **Password reset flow** — Supabase `resetPasswordForEmail` on `/reset-password` page

---

## 22. Final Agent Instructions

1. Read this entire PLAN.md before writing any code.
2. Collect all `.env.local` values from the user via 🛑 stop points.
3. Run `npx supabase db push` and verify with `npx supabase db diff --linked` (must output nothing).
4. Generate types with `npm run db:types` immediately after migrations.
5. Build and test each Phase (A→H) before moving to the next.
6. Never use `createAdminClient()` in any user-facing route — only in webhook and admin routes.
7. Never use `req.ip` — read IP from `x-forwarded-for` header instead.
8. Do not invent npm package APIs — check the README if uncertain.
9. Do not skip Turnstile server-side verification on login/signup.
10. All state-changing API routes (POST/PATCH/DELETE) must include the CSRF origin check.
11. The `render()` function from `@react-email/render` is async — always `await` it.
12. `supabase gen types` uses `--project-ref`, not `--project-id`.
13. Do NOT use `supabase migration up` — use `supabase db push` only.
14. import_batch format is `YYYY-MM-DD_{campaignUuid}` — generate with `new Date().toISOString().slice(0, 10) + '_' + campaignId`.
15. building_class enum values are `A, B, C, D, unclassified` — NOT A, B, C, F.
