# Property Acquisition Platform — Technical PLAN.md (v2 — Redesigned)
> For use by an AI coding agent (Claude Code, OpenCode, etc.)
> Stack: Next.js 16.2.6 (App Router) · Supabase · Cloudflare Turnstile · Gmail API · Google Drive API
> **This document supersedes the previous PLAN.md.** It reflects the system redesign described in `SYSTEM_REDESIGN.md`.

---

## 0. Agent Orientation & Ground Rules

Before writing a single line of code, the agent MUST read this entire document top to bottom. The plan is sequential — each phase gates the next. Do not skip phases, do not guess at schema details, do not invent library APIs.

### 0.0 — What Changed in This Redesign (Read First)

This version of the plan is a substantial rewrite. If you have previously seen the old plan, **discard these assumptions** — they are no longer true:

1. **No separate "Leads" entity.** Every record enters the pipeline as a deal at the `lead` stage. There is one `deals` table.
2. **Simplified 8-stage lifecycle.** Stages are now `lead → outreach → response → underwriting → loi → closed`, plus terminal states `failed` and `archived`. The old intermediate stages (`document_collection`, `underwritability_review`, `scored`, `call_scheduled`) are removed.
3. **`failed` is only valid after the `loi` stage.** Any deal removed from the pipeline before LOI must be set to `archived`, not `failed`.
4. **Flexible column schema.** The `deals` table stores ONLY the fields the system itself needs (outreach email, pipeline metadata, IDs, timestamps). All other property data (address, zip, CoStar link, external property IDs, etc.) is stored dynamically. There is no fixed set of "extra" property columns.
5. **`gen_random_uuid()` is the only primary key.** Any external identifier (e.g. a CoStar `property_id`) is just a plain dynamic field — not required, and imports without one will not break.
6. **The import engine is column-agnostic.** The user maps source columns at import time: to existing system fields, to new dynamic fields, or drops them. The user also designates which column(s) are the outreach email target and which column is the unit count.
7. **New `portfolios` table.** Optional groupings of deals, with a defined deletion behaviour.
8. **New `activity_log` table.** Tracks phone calls, voicemails, and manual notes; drives a computed `last_contacted_at` on each deal.
9. **Flexible `document_checklist`.** Checklist items are rows that can be added/removed per deal, each with optional metadata — not a fixed set of boolean columns.
10. **`underwriting` table has new approval/review fields** (`proceed_with_loi`, analyst, two reviewers, and their dates).

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

### 0.4 — UI and Theming (Strict Compliance)

The application uses a strict CSS variable-based design system (defined in `globals.css` and `UI.md`).
- **NO Tailwind Color Palettes**: You must NEVER use `bg-white`, `bg-slate-*`, `text-blue-*`, `text-gray-*`, or any raw hex codes.
- **ONLY CSS Variables**: Use `var(--color-surface-0)`, `var(--color-text-primary)`, `var(--color-accent)`, etc.
- **Light Mode Default**: The app is light-themed by default. Dark mode is an explicit user opt-in (`.dark` class on `<html>`). Do not use `@media (prefers-color-scheme: dark)`. Note: `next-themes` is currently used in the root layout — this is a known violation of the UI.md spec. Do NOT add more `next-themes` usage; it will be replaced with an inline `<script>` + `localStorage` approach per UI.md §3.5.
- **Tailwind CSS v4**: The project uses Tailwind CSS v4 with `@tailwindcss/postcss`. There is NO `tailwind.config.ts` file. Theme tokens are configured via `@theme inline` in `globals.css`.
- **Sidebar Exception**: The sidebar uses CSS variables (`--color-sidebar-*`) defined in `globals.css` for both light and dark themes. In light mode the sidebar has warm surface tones; in dark mode it renders as permanently dark (`#0E0E0E`).
- **DataGrid**: Complex tables use a robust Excel-like interaction model documented in `EXCEL_TABLE.md` (multi-cell selection, F2 editing, copy/paste). The `DataGrid` component (`src/components/shared/DataGrid.tsx`, ~47KB) and `useGridInteraction` hook (~39KB) implement this. The DataGrid must support **dynamic columns** sourced at runtime (see §3 and §11) — column definitions are not statically known at build time.

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
GOOGLE_REDIRECT_URI=              # e.g. https://yourdomain.com/api/auth/callback/google
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

# Note: The project uses Tailwind CSS v4 with @tailwindcss/postcss.
# There is NO tailwind.config.ts — theme tokens are defined via @theme inline in globals.css.
# PostCSS config (postcss.config.mjs) uses only { "@tailwindcss/postcss": {} }.

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
# Choose: Default style, CSS variables: yes

# Install required shadcn components
npx shadcn@latest add button input label card table badge dialog sheet select textarea sonner switch

# Data fetching / server state
npm install @tanstack/react-query@^5

# Virtualization (for DataGrid)
npm install @tanstack/react-virtual@^3

# Immutable state (for DataGrid selection ranges)
npm install immer@^10

# Date utilities
npm install date-fns@^3

# Cloudflare Turnstile
npm install react-turnstile@^1

# File parsing (spreadsheet import) — exceljs replaces abandoned xlsx package
npm install exceljs@^4

# CSV parsing (import engine accepts CSV as well as XLSX)
npm install papaparse@^5

# Misc utilities
npm install clsx@^2 tailwind-merge@^2 lucide-react@^0.460 class-variance-authority@^0.7

# Debounce
npm install use-debounce@^10

# Tailwind animation plugin
npm install tw-animate-css@^1

# Google APIs
npm install googleapis@^140 google-auth-library@^9

# Email template rendering
npm install @react-email/components@^0.0 @react-email/render@^1

# Rate limiting
npm install @upstash/ratelimit @upstash/redis

# Theme support (KNOWN VIOLATION — see UI.md; to be replaced with inline script)
npm install next-themes@^0.4

# Sonner toast
npm install sonner@^2

# Dev
npm install -D supabase@^2   # Supabase CLI as local dev dep
npm install -D vitest@^4     # Test runner
npm install -D fast-check@^4 # Property-based testing
```

> **New in v2:** `papaparse` is added because the redesigned import engine is format-agnostic — it accepts CSV exports as well as XLSX, since the column schema is no longer tied to a fixed CoStar layout.

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
    "jsx": "react-jsx",
    "incremental": true,
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 2.5 — next.config.ts

Replace the generated `next.config.ts` content with:

```typescript
import type { NextConfig } from 'next'

const cspScriptSrc = [
  "'self'",
  "'unsafe-inline'",
  'https://challenges.cloudflare.com',
  "'unsafe-eval'",
].join(' ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'] },
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            `script-src ${cspScriptSrc}`,
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

## 3. System Architecture Overview

### 3.1 — High-Level Workflow

```
Import Deals → Campaigns → (Positive / Neutral Response) → Deals Board → Underwriting → LOI → Close / Fail
                                                                              ↓
                                                                    Portfolios (optional grouping)
```

There is **no separate "Leads" entity**. All records enter the pipeline as deals at the `lead` stage and move through the lifecycle via the `stage` column.

### 3.2 — Data Model at a Glance

| Table | Purpose | New in v2? |
|---|---|---|
| `profiles` | User accounts + role | — |
| `campaigns` | Outreach campaigns | — |
| `portfolios` | Optional groupings of deals | **NEW** |
| `deals` | Core pipeline record (system fields only) | restructured |
| `deal_fields` | Dynamic per-deal property data (key/value) | **NEW** |
| `field_definitions` | Catalogue of known dynamic field keys | **NEW** |
| `contacts` | Owner contacts per deal | — |
| `email_outreach` | Email campaign activity | restructured |
| `activity_log` | Phone calls, voicemails, manual notes | **NEW** |
| `document_checklist` | Flexible per-deal document items | restructured |
| `ca_credentials` | Encrypted confidentiality-agreement logins | — |
| `underwriting` | Screening + underwriting metrics + approvals | restructured |
| `loi_records` / `loi_rounds` | LOI + counter-offer rounds | — |
| `google_tokens` | Per-user Gmail/Drive OAuth tokens | — |
| `import_jobs` | Bulk import progress tracking | restructured |

### 3.3 — The Flexible Column Principle

The `deals` table stores **only** fields the system itself requires to function:

- Fields needed to send campaign emails (the designated outreach email address).
- Pipeline / stage metadata (`stage`, `score`, `is_archived`, etc.).
- System-managed timestamps and IDs.
- Foreign keys (`campaign_id`, `portfolio_id`).
- The designated `unit_count` (required for per-unit financial metrics).

**Every other piece of property data** — street address, city, state, zip, CoStar URL, external property IDs, building class, year built, anything else in a source file — is stored dynamically in the `deal_fields` table as key/value rows. The `field_definitions` table catalogues which dynamic keys exist, their display labels, and their data types, so the UI can render them consistently.

This means: there is no schema migration required to support a new source-file column. The import wizard creates a new `field_definitions` row on the fly.

---

## 4. Directory Structure

```
acquisition-platform/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Route group: login, signup
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── reset-password/page.tsx   # stub page (Phase 1 only)
│   │   ├── (internal)/               # Route group: internal team views
│   │   │   ├── layout.tsx            # Sidebar + main content layout
│   │   │   ├── error.tsx             # Error boundary
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── deals/
│   │   │   │   ├── page.tsx          # Deal list / pipeline view
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx      # Deal detail
│   │   │   │       └── layout.tsx
│   │   │   ├── portfolios/
│   │   │   │   ├── page.tsx          # Portfolio list
│   │   │   │   └── [id]/page.tsx     # Portfolio detail (deals in portfolio)
│   │   │   ├── campaigns/page.tsx
│   │   │   ├── import/page.tsx       # Bulk import wizard
│   │   │   ├── settings/page.tsx
│   │   │   └── client-view/          # Internal users preview client views
│   │   │       ├── overview/page.tsx
│   │   │       └── calls/page.tsx
│   │   ├── (client)/                 # Route group: client/CEO view
│   │   │   ├── layout.tsx            # Client sidebar layout (simplified nav)
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
│   │   │   │   ├── batch/route.ts       # PATCH batch update (DataGrid paste)
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── route.ts         # GET, PATCH, DELETE-guard
│   │   │   │   │   ├── fields/route.ts  # GET/PATCH dynamic field values
│   │   │   │   │   ├── documents/route.ts
│   │   │   │   │   ├── activity/route.ts  # GET list, POST log activity
│   │   │   │   │   └── drive/route.ts   # POST: create Drive folder
│   │   │   │   └── import/
│   │   │   │       ├── route.ts         # POST: parse + return column headers
│   │   │   │       └── [batchId]/
│   │   │   │           ├── mapping/route.ts   # POST: submit column mapping
│   │   │   │           ├── confirm/route.ts   # POST: trigger Edge Function import
│   │   │   │           └── status/route.ts    # GET: poll import progress
│   │   │   ├── field-definitions/
│   │   │   │   └── route.ts             # GET list, POST create dynamic field def
│   │   │   ├── portfolios/
│   │   │   │   ├── route.ts             # GET list, POST create
│   │   │   │   └── [id]/route.ts        # GET, PATCH, DELETE (with deletion-mode body)
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
│   │   │   │       └── rounds/route.ts  # GET list, POST add round
│   │   │   ├── underwriting/
│   │   │   │   └── route.ts             # PATCH update underwriting data
│   │   │   ├── ca-credentials/
│   │   │   │   └── route.ts             # POST create (encrypted)
│   │   │   ├── admin/
│   │   │   │   ├── invite/route.ts      # POST: invite user (service role)
│   │   │   │   └── users/[id]/route.ts  # PATCH role, DELETE user (service role)
│   │   │   └── turnstile/verify/route.ts
│   │   ├── not-found.tsx
│   │   ├── page.tsx                     # redirect('/login')
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # shadcn generated components
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── TurnstileWidget.tsx
│   │   ├── deals/
│   │   │   ├── CampaignEditPopover.tsx
│   │   │   ├── DealCard.tsx
│   │   │   ├── DealTable.tsx          # Wraps DataGrid; columns = system + dynamic
│   │   │   ├── DealStageBar.tsx
│   │   │   ├── DealScoreBadge.tsx
│   │   │   ├── DynamicFieldPanel.tsx  # Renders/edits deal_fields key/value pairs
│   │   │   ├── ActivityTimeline.tsx   # Phone/voicemail/note log
│   │   │   ├── DocumentChecklist.tsx  # Flexible add/remove checklist
│   │   │   ├── EmailThread.tsx
│   │   │   ├── UnderwritingForm.tsx
│   │   │   ├── ApprovalPanel.tsx      # proceed_with_loi + reviewer sign-off
│   │   │   └── LOITracker.tsx
│   │   ├── portfolios/
│   │   │   ├── PortfolioCard.tsx
│   │   │   └── DeletePortfolioDialog.tsx  # orphan vs archive choice
│   │   ├── dashboard/
│   │   │   ├── FunnelMetrics.tsx
│   │   │   ├── KPIScorecard.tsx
│   │   │   ├── PipelineTable.tsx
│   │   │   └── ConversionChart.tsx
│   │   ├── client/
│   │   │   ├── ActiveDealsTable.tsx
│   │   │   ├── CallBrief.tsx
│   │   │   ├── CallQueue.tsx
│   │   │   ├── CallQueueTable.tsx
│   │   │   └── ClientDealCard.tsx
│   │   ├── import/
│   │   │   ├── ImportWizard.tsx       # 5-step wizard (upload → map → targets → preview → run)
│   │   │   ├── ColumnMapper.tsx       # Maps each source column → field/new/drop
│   │   │   └── ImportPreviewTable.tsx
│   │   └── shared/
│   │       ├── BrandLogo.tsx
│   │       ├── DataGrid.tsx           # Excel-like virtualized table; dynamic columns
│   │       ├── EmptyState.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── PageHeader.tsx
│   │       ├── ReactQueryProvider.tsx
│   │       └── Sidebar.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── admin.ts
│   │   │   ├── middleware.ts
│   │   │   └── types.ts
│   │   ├── google/
│   │   │   ├── oauth.ts
│   │   │   ├── gmail.ts
│   │   │   └── drive.ts
│   │   ├── email/
│   │   │   └── templates/
│   │   │       ├── outreach.tsx
│   │   │       ├── thank-you.tsx
│   │   │       └── declination.tsx
│   │   ├── import/
│   │   │   ├── file-parser.ts         # Format-agnostic: XLSX (exceljs) + CSV (papaparse)
│   │   │   └── mapping.ts             # Column-mapping types + apply logic
│   │   ├── stage-machine.ts           # Stage transition rules + validation
│   │   ├── rate-limit.ts
│   │   ├── validations/
│   │   │   ├── deal.schema.ts
│   │   │   ├── portfolio.schema.ts
│   │   │   ├── activity.schema.ts
│   │   │   ├── auth.schema.ts
│   │   │   ├── contact.schema.ts
│   │   │   └── import.schema.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useCallQueue.ts
│   │   │   ├── useCampaigns.ts
│   │   │   ├── usePortfolios.ts
│   │   │   ├── useColumnWidths.ts
│   │   │   ├── useDeals.ts
│   │   │   └── useGridInteraction.ts
│   │   ├── brand.ts
│   │   ├── navigation.ts
│   │   ├── page-headings.ts
│   │   └── utils.ts                  # cn(), formatCurrency(), formatDate(), formatPercent()
│   ├── proxy.ts                       # Next.js 16 proxy: session + role routing
│   └── types/
├── supabase/
│   ├── migrations/
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_auth_roles.sql
│   │   ├── 0003_campaigns.sql
│   │   ├── 0004_portfolios.sql
│   │   ├── 0005_deals.sql
│   │   ├── 0006_deal_fields.sql
│   │   ├── 0007_contacts.sql
│   │   ├── 0008_email_outreach.sql
│   │   ├── 0009_activity_log.sql
│   │   ├── 0010_documents.sql
│   │   ├── 0011_underwriting.sql
│   │   ├── 0012_call_briefs.sql
│   │   ├── 0013_loi.sql
│   │   ├── 0014_google_tokens.sql
│   │   ├── 0015_import_jobs.sql
│   │   ├── 0016_rls_policies.sql
│   │   └── 0017_functions.sql
│   ├── seed.sql
│   └── config.toml
├── docs/
│   ├── architecture/
│   └── guides/
├── .env.local
├── .env.example
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── vitest.config.ts
└── tsconfig.json
```

---

## 5. Database Migrations

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
  market                   text not null,
  listing_type             public.listing_type,
  email_template           public.email_template_key,
  email_subject_template   text,
  target_response_rate_pct numeric(5,2),
  target_loi_count         int,
  is_active                boolean not null default true,
  created_by               uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
```

### Migration 0004 — Portfolios  **(NEW)**

Portfolios are optional groupings of deals. The `deals` table gets a nullable `portfolio_id` FK in migration 0005.

```sql
-- supabase/migrations/0004_portfolios.sql

create table public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index portfolios_name_idx on public.portfolios using gin (name gin_trgm_ops);
```

> **Deletion behaviour is enforced in the API layer, not the DB.** The FK uses `on delete set null` so that a raw delete cannot orphan-with-error, but the actual `DELETE /api/portfolios/[id]` route must implement the two-option prompt (see §6 and §15). Hard deletion of *deals* is never permitted — historical data must be preserved.

### Migration 0005 — Deals (Core Table — System Fields Only)

The `deals` table holds **only** the fields the system itself needs. All other property data lives in `deal_fields` (migration 0006).

```sql
-- supabase/migrations/0005_deals.sql

-- Redesigned 8-stage lifecycle. 'failed' is a terminal state valid ONLY after 'loi'.
-- 'archived' is the terminal state for any deal removed before LOI.
create type public.deal_stage as enum (
  'lead',
  'outreach',
  'response',
  'underwriting',
  'loi',
  'closed',
  'failed',
  'archived'
);

create type public.deal_score as enum ('very_good', 'good', 'bad', 'very_bad');

create table public.deals (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid references public.campaigns(id) on delete set null,
  portfolio_id      uuid references public.portfolios(id) on delete set null,

  -- Minimal identity. deal_name is the only human label the system needs;
  -- it may be derived from a mapped source column at import time.
  deal_name         text,

  -- import_batch format: "YYYY-MM-DD_{importJobUuid}"
  import_batch      text,

  -- Outreach email target(s). The import wizard designates which source
  -- column(s) populate this. Array supports multiple recipients per deal.
  outreach_emails   text[] not null default '{}',

  -- Unit count is a SYSTEM field (not dynamic) because per-unit financial
  -- metrics depend on it. The import wizard designates its source column.
  unit_count        int,

  -- Pipeline metadata
  stage             public.deal_stage not null default 'lead',
  score             public.deal_score,
  is_archived       boolean not null default false,
  archive_reason    text,

  -- Computed by the activity_log trigger (migration 0009)
  last_contacted_at timestamptz,

  -- Google Drive
  drive_folder_url  text,

  -- Internal notes
  internal_notes    text,

  -- Audit
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index deals_campaign_idx  on public.deals(campaign_id);
create index deals_portfolio_idx on public.deals(portfolio_id);
create index deals_stage_idx     on public.deals(stage);
create index deals_search_idx    on public.deals
  using gin (to_tsvector('english', coalesce(deal_name, '')));
```

> **No `property_id` column, no fixed address columns.** Address, zip, state, CoStar link, external property IDs and everything else are dynamic fields. There is no unique constraint on any external identifier — imports without one do not break. Duplicate detection at import time is a best-effort match on dynamic fields and is advisory only (see §11).

### Migration 0006 — Dynamic Fields  **(NEW)**

This is the heart of the flexible-schema redesign. `field_definitions` catalogues every dynamic property attribute; `deal_fields` stores the per-deal values.

```sql
-- supabase/migrations/0006_deal_fields.sql

create type public.field_data_type as enum (
  'text', 'number', 'integer', 'date', 'boolean', 'url', 'currency'
);

-- Catalogue of known dynamic field keys (created by the import wizard or manually).
create table public.field_definitions (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,           -- machine key, e.g. 'street_address'
  label         text not null,                  -- display label, e.g. 'Street Address'
  data_type     public.field_data_type not null default 'text',
  -- display ordering in the dynamic field panel / grid
  sort_order    int not null default 100,
  -- whether this field shows as a column in the deal grid by default
  show_in_grid  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Per-deal dynamic values. One row per (deal, field).
create table public.deal_fields (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  field_id     uuid not null references public.field_definitions(id) on delete cascade,
  -- value stored as text; the API casts based on field_definitions.data_type
  value        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (deal_id, field_id)
);

create index deal_fields_deal_idx  on public.deal_fields(deal_id);
create index deal_fields_field_idx on public.deal_fields(field_id);
```

> **Why text values?** A single typed column would force one Postgres type. Storing `value` as text and casting per `data_type` at the API boundary keeps the schema stable while supporting numbers, dates, booleans and URLs. The Zod layer in §12 validates the cast.

### Migration 0007 — Contacts

```sql
-- supabase/migrations/0007_contacts.sql

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

create index contacts_deal_idx on public.contacts(deal_id);
```

### Migration 0008 — Email Outreach

```sql
-- supabase/migrations/0008_email_outreach.sql

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

  status                  public.email_status not null default 'not_sent',
  sent_at                 timestamptz,
  subject                 text,
  template_used           public.email_template_key,
  gmail_message_id        text,
  gmail_thread_id         text,
  error_message           text,

  -- A positive OR neutral reply moves the deal to the 'response' stage.
  response_classification public.response_classification,
  responded_at            timestamptz,

  -- Manually editable plain-text running summary. NOT auto-populated by webhook.
  conversation_log        text,

  thank_you_sent          boolean not null default false,
  thank_you_sent_at       timestamptz,
  declination_sent        boolean not null default false,
  declination_sent_at     timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index email_outreach_deal_idx   on public.email_outreach(deal_id);
create index email_outreach_thread_idx on public.email_outreach(gmail_thread_id)
  where gmail_thread_id is not null;
```

### Migration 0009 — Activity Log  **(NEW)**

Tracks phone calls, voicemails and manual notes alongside email outreach. Logging any activity updates `deals.last_contacted_at` via a trigger.

```sql
-- supabase/migrations/0009_activity_log.sql

create type public.activity_type as enum (
  'call', 'voicemail', 'note', 'meeting', 'other'
);

create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  type        public.activity_type not null,
  summary     text not null,                 -- e.g. "Left voicemail"
  logged_by   uuid references public.profiles(id),
  logged_at   timestamptz not null default now()
);

create index activity_log_deal_idx on public.activity_log(deal_id, logged_at desc);

-- Keep deals.last_contacted_at in sync with the most recent activity.
create or replace function public.touch_last_contacted()
returns trigger language plpgsql as $$
begin
  update public.deals
  set last_contacted_at = greatest(coalesce(last_contacted_at, new.logged_at), new.logged_at)
  where id = new.deal_id;
  return new;
end;
$$;

create trigger trg_activity_touches_deal
  after insert on public.activity_log
  for each row execute procedure public.touch_last_contacted();
```

> Email sends do not write to `activity_log`; `last_contacted_at` reflects manual touches and email outreach can be read from `email_outreach.sent_at` separately. If the team wants email sends to also bump `last_contacted_at`, add an equivalent trigger on `email_outreach` in a future migration — out of scope for Phase 1.

### Migration 0010 — Document Checklist & CA  **(restructured — now flexible)**

The checklist is no longer a fixed set of boolean columns. Each checklist item is a row, so documents can be added or removed per deal, each with optional metadata.

```sql
-- supabase/migrations/0010_documents.sql

create type public.ca_status as enum (
  'not_required', 'pending', 'signed', 'approved'
);

-- One row per document item per deal.
create table public.document_checklist (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  -- e.g. 'P&L', 'Rent Roll', 'OM', 'Tax Bill', 'CAPEX Schedule', 'Market Report 1'
  doc_name      text not null,
  collected     boolean not null default false,
  -- optional free-form metadata: upload date, reviewer notes, period, etc.
  metadata      jsonb not null default '{}'::jsonb,
  sort_order    int not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index document_checklist_deal_idx on public.document_checklist(deal_id);

-- Default checklist items seeded for a new deal (called from /api/deals POST
-- and from the import Edge Function). Documents can be added/removed afterwards.
create or replace function public.seed_default_checklist(p_deal_id uuid)
returns void language plpgsql as $$
declare items text[] := array[
  'P&L', 'Rent Roll', 'Offering Memorandum (OM)', 'Tax Bill',
  'CAPEX Schedule', 'Market Report 1', 'Market Report 2',
  'Market Report 3', 'Market Report 4'
];
  d text; i int := 0;
begin
  foreach d in array items loop
    insert into public.document_checklist (deal_id, doc_name, sort_order)
    values (p_deal_id, d, i);
    i := i + 10;
  end loop;
end;
$$;

-- CA credentials stored separately (sensitive — password stored encrypted).
create table public.ca_credentials (
  id                  uuid primary key default gen_random_uuid(),
  platform            text not null,
  username            text,
  password_encrypted  bytea,    -- pgp_sym_encrypt(password, DB_ENCRYPTION_KEY)
  notes               text,
  created_at          timestamptz not null default now()
);

-- CA status attached to a deal (one row per deal).
create table public.deal_ca (
  deal_id           uuid primary key references public.deals(id) on delete cascade,
  ca_status         public.ca_status not null default 'not_required',
  ca_platform       text,
  ca_credential_id  uuid references public.ca_credentials(id) on delete set null,
  updated_at        timestamptz not null default now()
);

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

### Migration 0011 — Underwriting  **(restructured — screening + metrics + approvals)**

The `underwriting` table now carries the pre-screening fields, the underwriting output fields, **and** the approval/review tracking fields. Per-unit figures are computed from `deals.unit_count`.

```sql
-- supabase/migrations/0011_underwriting.sql

create type public.underwritability as enum (
  'go', 'no_go', 'maybe'
);

create table public.underwriting (
  id                       uuid primary key default gen_random_uuid(),
  deal_id                  uuid not null references public.deals(id) on delete cascade,

  -- ── Pre-Underwriting Screening ──────────────────────────────
  asking_price             numeric(15,2),
  price_per_unit           numeric(12,2),   -- asking_price / deals.unit_count
  population_1mi           int,
  population_growth_pct    numeric(6,3),
  rent_growth_pct          numeric(6,3),
  vacancy_rate_pct         numeric(6,3),
  market_price_per_unit    numeric(12,2),
  delta_pct                numeric(6,3),    -- (price_per_unit - market_ppu) / market_ppu * 100
  cap_rate                 numeric(6,3),
  underwritability_status  public.underwritability,   -- Go / No-Go / Maybe
  screened_at              timestamptz,
  screened_by              uuid references public.profiles(id),

  -- ── Key Underwriting Output ─────────────────────────────────
  purchase_price           numeric(15,2),
  purchase_price_per_unit  numeric(12,2),   -- purchase_price / deals.unit_count
  capex                    numeric(15,2),
  capex_per_unit           numeric(12,2),   -- capex / deals.unit_count
  occupancy_pct            numeric(6,3),
  irr_pct                  numeric(6,3),
  equity_multiple          numeric(6,3),
  cash_on_cash_pct         numeric(6,3),
  profit                   numeric(15,2),
  uw_notes                 text,

  -- ── Approval & Pipeline Tracking ────────────────────────────
  proceed_with_loi         boolean,                                   -- formal go/no-go
  uw_analyst_id            uuid references public.profiles(id),       -- who underwrote
  uw_completion_date       date,
  reviewer_1_id            uuid references public.profiles(id),
  review_1_date            date,
  reviewer_2_id            uuid references public.profiles(id),
  review_2_date            date,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (deal_id)
);

create index underwriting_deal_idx on public.underwriting(deal_id);
```

> **Per-unit fields** (`price_per_unit`, `purchase_price_per_unit`, `capex_per_unit`) are auto-calculated by the API layer on every write using `deals.unit_count`. They are stored (not generated columns) so a manual override is possible; the UI labels them "(auto)" until overridden, exactly as in the old plan.

### Migration 0012 — Call Briefs

```sql
-- supabase/migrations/0012_call_briefs.sql

create type public.call_status as enum (
  'pending', 'completed', 'cancelled'
);

create table public.call_briefs (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references public.deals(id) on delete cascade,
  summary_text    text,
  published       boolean not null default false,
  published_at    timestamptz,
  call_status     public.call_status not null default 'pending',
  completed_at    timestamptz,
  client_notes    text,
  flagged_by      uuid references public.profiles(id),
  flagged_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index call_briefs_deal_idx   on public.call_briefs(deal_id);
create index call_briefs_status_idx on public.call_briefs(call_status) where published = true;
```

> Note: call briefs are no longer tied to a dedicated `call_scheduled` stage (that stage was removed). A brief can be created for any deal in the `underwriting` stage or later; publishing a brief does not change `deals.stage`.

### Migration 0013 — LOI & Negotiation

```sql
-- supabase/migrations/0013_loi.sql

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
  unique (deal_id)
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

> **Stage interaction:** issuing an LOI moves the deal to `loi`. `outcome='deal_reached'` → `stage='closed'`. `outcome='fallen_through'` → `stage='failed'` (this is the ONLY place `failed` is valid — see §6).

### Migration 0014 — Google OAuth Token Storage

```sql
-- supabase/migrations/0014_google_tokens.sql

create table public.google_tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  access_token     text not null,
  refresh_token    text,
  token_type       text,
  expiry           timestamptz,
  scopes           text[],
  last_history_id  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id)
);
```

### Migration 0015 — Import Jobs  **(restructured — stores column mapping)**

The import job now persists the user's column mapping so the confirm-step Edge Function can apply it.

```sql
-- supabase/migrations/0015_import_jobs.sql

create table public.import_jobs (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references public.campaigns(id) on delete set null,
  portfolio_id  uuid references public.portfolios(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,

  source_headers text[] not null default '{}',   -- raw column headers from the file
  -- The mapping the user submitted in wizard Step 2/3. Shape:
  -- { "Property Address": { action: "field", key: "street_address" },
  --   "Owner Email":      { action: "email_target" },
  --   "Units":            { action: "unit_count" },
  --   "Random Col":       { action: "drop" } }
  column_mapping jsonb not null default '{}'::jsonb,

  total_rows    int not null default 0,
  inserted      int not null default 0,
  skipped       int not null default 0,
  status        text not null default 'pending'
    check (status in ('pending', 'mapping', 'running', 'done', 'failed')),
  error_log     text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### Migration 0016 — Row-Level Security Policies

```sql
-- supabase/migrations/0016_rls_policies.sql

alter table public.profiles           enable row level security;
alter table public.campaigns          enable row level security;
alter table public.portfolios         enable row level security;
alter table public.deals              enable row level security;
alter table public.field_definitions  enable row level security;
alter table public.deal_fields        enable row level security;
alter table public.contacts           enable row level security;
alter table public.email_outreach     enable row level security;
alter table public.activity_log       enable row level security;
alter table public.document_checklist enable row level security;
alter table public.deal_ca            enable row level security;
alter table public.ca_credentials     enable row level security;
alter table public.underwriting       enable row level security;
alter table public.call_briefs        enable row level security;
alter table public.loi_records        enable row level security;
alter table public.loi_rounds         enable row level security;
alter table public.google_tokens      enable row level security;
alter table public.import_jobs        enable row level security;

-- Helper: get the calling user's custom role from app_metadata.
create or replace function public.get_my_role()
returns public.user_role language sql stable security definer as $$
  select coalesce(
    (auth.jwt()->'app_metadata'->>'role')::public.user_role,
    (auth.jwt()->'user_metadata'->>'role')::public.user_role,
    'internal'
  )
$$;

-- PROFILES
create policy "profiles: own row" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: internal sees all" on public.profiles
  for select using (public.get_my_role() = 'internal');
create policy "profiles: own update" on public.profiles
  for update using (id = auth.uid());

-- CAMPAIGNS / PORTFOLIOS — internal full access; client none
create policy "campaigns: internal all" on public.campaigns
  for all using (public.get_my_role() = 'internal');
create policy "portfolios: internal all" on public.portfolios
  for all using (public.get_my_role() = 'internal');

-- DEALS — internal full; client sees only good/very_good non-archived
create policy "deals: internal all" on public.deals
  for all using (public.get_my_role() = 'internal');
create policy "deals: client read good" on public.deals
  for select using (
    public.get_my_role() = 'client'
    and is_archived = false
    and score in ('good', 'very_good')
  );

-- DYNAMIC FIELDS — field_definitions readable by all authenticated users
-- (so the client deal cards can render labels); deal_fields gated like deals.
create policy "field_definitions: read all" on public.field_definitions
  for select using (auth.uid() is not null);
create policy "field_definitions: internal write" on public.field_definitions
  for all using (public.get_my_role() = 'internal');

create policy "deal_fields: internal all" on public.deal_fields
  for all using (public.get_my_role() = 'internal');
create policy "deal_fields: client read good" on public.deal_fields
  for select using (
    public.get_my_role() = 'client'
    and exists (
      select 1 from public.deals d
      where d.id = deal_fields.deal_id
        and d.is_archived = false
        and d.score in ('good', 'very_good')
    )
  );

-- INTERNAL-ONLY TABLES
create policy "contacts: internal all" on public.contacts
  for all using (public.get_my_role() = 'internal');
create policy "email_outreach: internal all" on public.email_outreach
  for all using (public.get_my_role() = 'internal');
create policy "activity_log: internal all" on public.activity_log
  for all using (public.get_my_role() = 'internal');
create policy "document_checklist: internal all" on public.document_checklist
  for all using (public.get_my_role() = 'internal');
create policy "deal_ca: internal all" on public.deal_ca
  for all using (public.get_my_role() = 'internal');
create policy "ca_credentials: internal all" on public.ca_credentials
  for all using (public.get_my_role() = 'internal');
create policy "underwriting: internal all" on public.underwriting
  for all using (public.get_my_role() = 'internal');
create policy "loi_records: internal all" on public.loi_records
  for all using (public.get_my_role() = 'internal');
create policy "loi_rounds: internal all" on public.loi_rounds
  for all using (public.get_my_role() = 'internal');
create policy "import_jobs: internal all" on public.import_jobs
  for all using (public.get_my_role() = 'internal');

-- CALL BRIEFS — internal full; client sees published briefs for visible deals
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
  with check (public.get_my_role() = 'client' and published = true);
-- NOTE: the /api/calls/[id] PATCH route must whitelist only
-- { call_status, client_notes } — never spread the full body.

-- GOOGLE TOKENS — own row only
create policy "google_tokens: own row" on public.google_tokens
  for all using (user_id = auth.uid());
```

### Migration 0017 — Utility Functions & Pipeline View

```sql
-- supabase/migrations/0017_functions.sql

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
    'profiles','campaigns','portfolios','deals','deal_fields',
    'email_outreach','document_checklist','deal_ca','underwriting',
    'call_briefs','loi_records','google_tokens','import_jobs'
  ] loop
    execute format('
      create trigger trg_%s_updated_at
      before update on public.%s
      for each row execute procedure public.update_updated_at();
    ', t, t);
  end loop;
end $$;

-- Dashboard pipeline summary — security definer, internal-only hard gate.
create or replace function public.get_pipeline_summary()
returns table (
  campaign_name        text,
  market               text,
  leads                bigint,
  emails_sent          bigint,
  responses_positive   bigint,
  underwritten         bigint,
  scored_good          bigint,
  loi_count            bigint,
  closed_count         bigint,
  failed_count         bigint
) language sql stable security definer as $$
  select
    c.name,
    c.market,
    count(*) filter (where d.stage = 'lead'),
    count(*) filter (where e.status = 'sent'),
    count(*) filter (where e.response_classification in ('positive','neutral')),
    count(*) filter (where d.stage in ('underwriting','loi','closed','failed')),
    count(*) filter (where d.score in ('good','very_good')),
    count(*) filter (where d.stage in ('loi','closed')),
    count(*) filter (where d.stage = 'closed'),
    count(*) filter (where d.stage = 'failed')
  from public.deals d
  join public.campaigns c on c.id = d.campaign_id
  left join public.email_outreach e on e.deal_id = d.id
  where public.get_my_role() = 'internal'
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

## 6. Deal Stages, Lifecycle & Portfolio Behaviour

This section is the single source of truth for stage rules. The agent must implement these in `src/lib/stage-machine.ts` and enforce them in every API route that writes `deals.stage`.

### 6.1 — Stage Definitions

| Stage | Description |
|---|---|
| `lead` | Freshly imported; no outreach yet |
| `outreach` | Campaign email(s) sent |
| `response` | Owner has replied (positive or neutral) |
| `underwriting` | Active financial analysis in progress |
| `loi` | Letter of Intent has been sent |
| `closed` | Deal successfully closed |
| `failed` | Deal rejected — **only valid after the `loi` stage** |
| `archived` | Removed from active pipeline for any reason prior to LOI |

### 6.2 — Stage Transition Rules

- `lead` → `outreach`: triggered when the first campaign email is sent (`POST /api/emails/send`).
- `outreach` → `response`: triggered when a **positive or neutral** reply is classified (`PATCH /api/emails/[id]`).
- `response` → `underwriting`: triggered manually when analysis begins.
- `underwriting` → `loi`: triggered when an LOI is issued (`POST /api/loi`).
- `loi` → `closed`: LOI outcome `deal_reached`.
- `loi` → `failed`: LOI outcome `fallen_through`.
- **`failed` is reachable ONLY from `loi`.** Any attempt to set `stage='failed'` on a deal whose current stage is not `loi` must be rejected with HTTP 422.
- Any deal removed from the pipeline **before** the `loi` stage must be set to `archived` (with `is_archived=true`), never `failed`.
- An optional free-text `archive_reason` may be recorded when archiving.

### 6.3 — `src/lib/stage-machine.ts`

```typescript
export const DEAL_STAGES = [
  'lead', 'outreach', 'response', 'underwriting',
  'loi', 'closed', 'failed', 'archived',
] as const
export type DealStage = (typeof DEAL_STAGES)[number]

// Linear progression path (terminal states excluded from "next").
const FORWARD: Record<DealStage, DealStage | null> = {
  lead: 'outreach',
  outreach: 'response',
  response: 'underwriting',
  underwriting: 'loi',
  loi: 'closed',       // default forward; 'failed' is an explicit branch
  closed: null,
  failed: null,
  archived: null,
}

export function nextStage(current: DealStage): DealStage | null {
  return FORWARD[current]
}

/**
 * Validates a requested stage transition.
 * Returns { ok: true } or { ok: false, reason } — callers return 422 on failure.
 */
export function canTransition(from: DealStage, to: DealStage): { ok: boolean; reason?: string } {
  if (from === to) return { ok: true }

  // 'failed' may ONLY be entered from 'loi'.
  if (to === 'failed' && from !== 'loi') {
    return { ok: false, reason: "'failed' is only valid after the LOI stage. Use 'archived' instead." }
  }

  // 'archived' is reachable from any pre-LOI stage (and underwriting),
  // but a post-LOI exit should be 'failed' or 'closed', not 'archived'.
  if (to === 'archived' && (from === 'loi' || from === 'closed' || from === 'failed')) {
    return { ok: false, reason: "Deals at or past the LOI stage cannot be archived; set 'closed' or 'failed'." }
  }

  return { ok: true }
}
```

> Every `PATCH /api/deals/[id]` that includes a `stage` field MUST call `canTransition(currentStage, newStage)` and return `{ error: reason }` with status 422 on failure. Do not rely on the UI alone.

### 6.4 — Portfolios

Portfolios are optional groupings, one `portfolio_id` FK per deal. A deal may belong to zero or one portfolio.

#### Portfolio Deletion Behaviour

`DELETE /api/portfolios/[id]` MUST accept a body specifying one of two modes. The route prompts the user via `DeletePortfolioDialog.tsx` before sending:

1. **Orphan the deals** (`mode: 'orphan'`) — set every member deal's `portfolio_id` to `null`. Deals remain active on the main board.
2. **Archive the deals** (`mode: 'archive'`) — set every member deal's `stage='archived'`, `is_archived=true`, `archive_reason='Portfolio Deleted'`. (Deals already at/past LOI are left untouched — see §6.3; surface a notice listing them.)

```typescript
// DELETE /api/portfolios/[id] — pseudocode
const { mode } = await req.json()   // 'orphan' | 'archive'
if (mode === 'orphan') {
  await supabase.from('deals').update({ portfolio_id: null }).eq('portfolio_id', id)
} else if (mode === 'archive') {
  await supabase.from('deals')
    .update({ stage: 'archived', is_archived: true, archive_reason: 'Portfolio Deleted' })
    .eq('portfolio_id', id)
    .not('stage', 'in', '(loi,closed,failed)')
}
await supabase.from('portfolios').delete().eq('id', id)
```

**Hard deletion of deals is never permitted.** Historical data must always be preserved — only the portfolio row itself is deleted.

---

## 7. Supabase Type Generation

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

Note: the flag is `--project-ref`, not `--project-id`. Using `--project-id` throws an unknown-flag error in Supabase CLI v2.

---

## 8. Supabase Client Setup

### `src/lib/supabase/client.ts` (browser)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### `src/lib/supabase/server.ts` (server components / API routes — anon key)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
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

export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client cannot be used in browser context')
  }
  return createSupabaseClient(
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
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
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

### `src/proxy.ts` (Next.js 16 Proxy Pattern — replaces `middleware.ts`)

In Next.js 16, session and role routing uses the **proxy pattern**. The file is `src/proxy.ts`; the function is exported as `proxy()`, not `middleware()`.

```typescript
import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { User } from '@supabase/supabase-js'

type UserWithRole = User & {
  app_metadata: { role: 'internal' | 'client' | undefined }
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const role = (user as UserWithRole)?.app_metadata?.role

  const path = request.nextUrl.pathname
  const isAuthRoute     = path.startsWith('/login') || path.startsWith('/signup')
  const isInternalRoute = path.startsWith('/dashboard') || path.startsWith('/deals') ||
                          path.startsWith('/portfolios') || path.startsWith('/campaigns') ||
                          path.startsWith('/import') || path.startsWith('/settings') ||
                          path.startsWith('/client-view')
  const isClientRoute   = path.startsWith('/overview') || path.startsWith('/calls')

  if (!user && (isInternalRoute || isClientRoute)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isAuthRoute) {
    const dest = role === 'client' ? '/overview' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }
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

> The `isInternalRoute` matcher now also covers `/portfolios`.

---

## 9. Shared Components

### `src/components/shared/ReactQueryProvider.tsx`

```typescript
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

Add to `src/app/layout.tsx`:

```typescript
import ReactQueryProvider from '@/components/shared/ReactQueryProvider'
// ...
<ReactQueryProvider>{children}</ReactQueryProvider>
```

### `src/components/shared/LoadingSpinner.tsx`

```typescript
interface LoadingSpinnerProps { size?: 'sm' | 'md' | 'lg' | 'page' }

const sizeMap: Record<string, string> = {
  sm: 'h-3.5 w-3.5 border-[1.5px]',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
  page: 'h-12 w-12 border-4',
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full ${sizeMap[size]}`}
      style={{ borderColor: 'var(--color-surface-3)', borderTopColor: 'var(--accent)' }}
    />
  )
}
```

### `src/components/shared/EmptyState.tsx`

```typescript
// Props: icon?: LucideIcon; title: string; description?: string;
//        action?: { label: string; onClick: () => void }
// Centered column: icon 40px var(--color-text-tertiary); title text-[17px]
// font-medium var(--color-text-secondary); description text-[13px]
// var(--color-text-tertiary) max-w-[320px]; action → Button variant="secondary" size="sm".
```

### `src/app/not-found.tsx`, `(internal)/error.tsx`, `(client)/error.tsx`

Same as previous plan: a centered 404 page and a `'use client'` error boundary with a "Try again" button using `var(--accent)`. Use CSS variable tokens only.

### DataGrid — Dynamic Columns

`DataGrid.tsx` (~47KB, virtualized via `@tanstack/react-virtual`) and `useGridInteraction.ts` (~39KB, `useReducer`-based) implement the Excel-like interaction model in `EXCEL_TABLE.md` (focus cell, range selection, multi-range, F2 edit, copy/paste, fill down/right, resize/autofit).

**Redesign requirement:** the grid must accept a **runtime-generated column array**. The deal grid's columns are the fixed system columns plus one column per `field_definitions` row where `show_in_grid = true`. `DealTable.tsx` builds the column list by merging static system column defs with dynamic defs fetched from `GET /api/field-definitions`. A dynamic column's `accessor` reads from the deal's joined `deal_fields` map; its editor casts on save per `data_type`.

### Other Shared Components

- **`BrandLogo.tsx`**: SVG building icon + wordmark (`icon` / `wordmark` / `full` variants); uses `BRAND` const from `src/lib/brand.ts`.
- **`Sidebar.tsx`** (~13KB): collapsible desktop sidebar (52px/220px) + mobile Sheet drawer. Uses `--color-sidebar-*` tokens.
- **`PageHeader.tsx`**: title + description + breadcrumb + action buttons.

---

## 10. Rate Limiting

### `src/lib/rate-limit.ts`

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// 5 login attempts per 5 minutes per IP
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
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
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
const { success } = await loginRateLimit.limit(ip)
if (!success) return NextResponse.json({ error: 'Too many attempts. Try again in 5 minutes.' }, { status: 429 })
```

---

## 11. Authentication — Cloudflare Turnstile

### 11.1 — CSRF Check Helper

Add to all state-changing API routes (POST, PATCH, DELETE):

```typescript
const origin = req.headers.get('origin')
if (origin !== process.env.NEXT_PUBLIC_APP_URL) {
  return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
}
```

### 11.2 — Verify Endpoint

```typescript
// src/app/api/turnstile/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const { token } = await req.json()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           ?? req.headers.get('x-real-ip') ?? undefined

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
      ...(ip && { remoteip: ip }),
    }),
  })

  const data = await res.json()
  if (!data.success) return NextResponse.json({ success: false }, { status: 400 })
  return NextResponse.json({ success: true })
}
```

### 11.3 — Login API Route

```typescript
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginRateLimit } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validations/auth.schema'

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { success: rateLimitOk } = await loginRateLimit.limit(ip)
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 5 minutes.' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { email, password, turnstileToken } = parsed.data

  const turnstileRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/turnstile/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'origin': process.env.NEXT_PUBLIC_APP_URL! },
    body: JSON.stringify({ token: turnstileToken }),
  })
  if (!turnstileRes.ok) {
    return NextResponse.json({ error: 'Bot verification failed. Please try again.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  return NextResponse.json({ role: data.user.app_metadata?.role })
}
```

Apply the same Turnstile + rate-limit gate to `/api/auth/signup/route.ts`.

### 11.4 — Login Page UI

```
LOGIN PAGE FULL SPEC:
Route: /login
Layout: centered card (max-w-[380px]) on var(--color-canvas) full-screen background

Card (var(--color-surface-0) rounded-[14px] p-8, border 1px solid var(--color-surface-2),
      shadow var(--shadow-md)) contains:
  - BrandLogo variant="full" centered, mb-10
  - H1 "Welcome back" — text-[20px] font-medium var(--color-text-primary), centered mb-6
  - Email input: type="email", uppercase label, placeholder "you@company.com",
      h-[34px] rounded-md px-3 text-[13px], bg var(--color-surface-0), border var(--color-surface-3)
  - Password input: type="password" with show/hide Eye toggle
  - Turnstile widget: centered below password; submit disabled until onVerify fires
  - Submit button: full-width h-10 rounded-md text-[14px] font-medium,
      bg var(--accent), color #FFFFFF, active:scale-[0.98]
      "Sign in" idle | spinner + "Signing in..." submitting
  - Error alert: bg var(--color-danger-bg), border var(--color-danger-border),
      color var(--color-danger-text); 401 → "Invalid email or password.",
      400 → "Bot verification failed.", 429 → "Too many attempts. Try again in 5 minutes."
  - "Forgot password?" link → /reset-password (stub)

On success: role 'client' → /overview; else → /dashboard
Mobile (< 640px): no shadow, no border, p-4
```

---

## 12. Gmail & Google Drive Integration

### 12.1 — OAuth Flow

```
User clicks "Connect Gmail" →
  GET /api/auth/google → redirect to Google consent →
  Google redirects to /api/auth/callback/google →
    Exchange code for tokens → upsert into public.google_tokens →
    Call gmail.users.watch() → store historyId in google_tokens.last_history_id →
  Redirect to /settings?gmail=connected
```

### 12.2 — `src/lib/google/oauth.ts`

```typescript
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

// gmail.modify (not gmail.readonly) — required for push notifications.
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

export async function getAuthedClient(userId: string) {
  const supabase = await createClient()
  const { data: tokenRow, error } = await supabase
    .from('google_tokens').select('*').eq('user_id', userId).single()

  if (error || !tokenRow) {
    throw new Error('Google account not connected. Visit /settings to connect Gmail.')
  }

  const oauthClient = getOAuthClient()
  oauthClient.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token ?? undefined,
    expiry_date: tokenRow.expiry ? new Date(tokenRow.expiry).getTime() : undefined,
  })

  oauthClient.on('tokens', async (tokens) => {
    await supabase.from('google_tokens').update({
      access_token: tokens.access_token ?? tokenRow.access_token,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : tokenRow.expiry,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  })

  return oauthClient
}
```

### 12.3 — Callback registers Gmail watch

```typescript
// After upserting tokens in /api/auth/callback/google/route.ts:
const gmail = google.gmail({ version: 'v1', auth })
const watchRes = await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
    labelIds: ['INBOX'],
  },
})
await supabase.from('google_tokens')
  .update({ last_history_id: watchRes.data.historyId ?? null })
  .eq('user_id', userId)
```

### 12.4 — Gmail Push Notification Setup (One-Time)

🛑 **STOP — Complete these steps in Google Cloud Console before deploying.**

```
1. Pub/Sub → Create Topic: gmail-notifications
2. Add Publisher permission on the topic:
   Principal: gmail-api-push@system.gserviceaccount.com  Role: Pub/Sub Publisher
3. Create Push Subscription: gmail-notifications-sub
   Delivery: Push   Endpoint: https://yourdomain.com/api/emails/webhook
   Audience (JWT): https://yourdomain.com/api/emails/webhook
4. Gmail watch expires after 7 days — add a Vercel cron (see §20).
```

### 12.5 — Gmail Webhook with Authentication

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
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  try {
    const ticket = await pubsubClient.verifyIdToken({
      idToken: token,
      audience: `${process.env.NEXT_PUBLIC_APP_URL}/api/emails/webhook`,
    })
    if (ticket.getPayload()?.email !== 'gmail-api-push@system.gserviceaccount.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // 2. Parse Pub/Sub message
  const body = await req.json()
  const notification = JSON.parse(
    Buffer.from(body.message.data, 'base64').toString()
  ) as { emailAddress: string; historyId: string }

  // 3. Find user, fetch new Gmail history
  const supabase = createAdminClient()
  const { data: authUser } = await supabase
    .from('google_tokens').select('user_id, last_history_id')
    .eq('user_id', notification.emailAddress).single()
  if (!authUser) return NextResponse.json({ ok: true })

  const auth = await getAuthedClient(authUser.user_id)
  const gmail = google.gmail({ version: 'v1', auth })
  const historyRes = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: authUser.last_history_id ?? notification.historyId,
    historyTypes: ['messageAdded'],
    labelId: 'INBOX',
  })

  // 4. Match new messages to email_outreach by gmail_thread_id
  for (const h of historyRes.data.history ?? []) {
    for (const msg of h.messagesAdded ?? []) {
      const threadId = msg.message?.threadId
      if (!threadId) continue
      const { data: outreach } = await supabase
        .from('email_outreach').select('id, status')
        .eq('gmail_thread_id', threadId).single()
      if (outreach && outreach.status === 'sent') {
        // Only status/responded_at are set. Classification (and the
        // resulting stage move to 'response') is done by the internal team.
        await supabase.from('email_outreach').update({
          status: 'replied',
          responded_at: new Date().toISOString(),
        }).eq('id', outreach.id)
      }
    }
  }

  // 5. Update stored historyId
  await supabase.from('google_tokens')
    .update({ last_history_id: notification.historyId })
    .eq('user_id', authUser.user_id)

  return NextResponse.json({ ok: true })
}
```

### 12.6 — `src/lib/google/drive.ts`

```typescript
import { google } from 'googleapis'
import { getAuthedClient } from './oauth'

export async function createDealFolder(
  userId: string, dealName: string, parentFolderId?: string
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

  await drive.permissions.create({
    fileId: folder.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  return { folderId: folder.data.id!, folderUrl: folder.data.webViewLink! }
}
```

Drive folder API route (`POST /api/deals/[id]/drive`): authenticate, confirm Drive connected (400 if not), call `createDealFolder`, PATCH `deals.drive_folder_url`, return `{ drive_folder_url }`.

---

## 13. The Import Engine  **(fully redesigned — column-agnostic)**

The import engine no longer assumes a fixed CoStar layout. It accepts any tabular file (XLSX or CSV), reads its headers, and lets the user decide what each column becomes. There is **no hardcoded `COLUMN_MAP`**.

### 13.1 — Import Flow Overview

```
Step 1  Upload         → user picks a campaign (and optional portfolio) + uploads a file
Step 2  Parse headers  → server parses the file, returns the raw column headers + a few sample rows
Step 3  Map columns    → for EACH header the user chooses an action:
                           • map to an existing system field (deal_name)
                           • mark as the outreach email target  (one or more columns)
                           • mark as the unit count column        (exactly one column)
                           • map to an existing dynamic field     (field_definitions.key)
                           • create a NEW dynamic field           (new field_definitions row)
                           • drop the column                      (not imported)
Step 4  Preview        → server shows what will be inserted, with advisory duplicate flags
Step 5  Run            → Edge Function applies the mapping row-by-row, updates progress
```

### 13.2 — `src/lib/import/file-parser.ts` (format-agnostic)

```typescript
import ExcelJS from 'exceljs'
import Papa from 'papaparse'

export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]   // each row keyed by header
}

export async function parseFile(buffer: ArrayBuffer, filename: string): Promise<ParsedFile> {
  const isCsv = filename.toLowerCase().endsWith('.csv')
  return isCsv ? parseCsv(buffer) : parseXlsx(buffer)
}

function parseCsv(buffer: ArrayBuffer): ParsedFile {
  const text = new TextDecoder().decode(buffer)
  const result = Papa.parse<Record<string, string>>(text, {
    header: true, skipEmptyLines: true,
  })
  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  }
}

async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedFile> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const sheet = wb.worksheets[0]
  if (!sheet) throw new Error('No worksheet found in file')

  const headers: string[] = []
  const rows: Record<string, string>[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => headers.push(String(cell.value ?? '').trim()))
      return
    }
    const obj: Record<string, string> = {}
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (header) obj[header] = cell.value == null ? '' : String(cell.value)
    })
    rows.push(obj)
  })

  return { headers, rows }
}
```

### 13.3 — `src/lib/import/mapping.ts` (mapping types)

```typescript
// One decision per source column. Stored on import_jobs.column_mapping.
export type ColumnAction =
  | { action: 'system'; field: 'deal_name' }   // map to a deals system column
  | { action: 'email_target' }                 // contributes to deals.outreach_emails[]
  | { action: 'unit_count' }                    // populates deals.unit_count (max ONE column)
  | { action: 'field'; key: string }            // existing field_definitions.key
  | { action: 'new_field'; key: string; label: string; dataType: string }  // create def
  | { action: 'drop' }                          // ignore

export type ColumnMapping = Record<string, ColumnAction>   // keyed by source header

/** Validates a mapping before the confirm step. */
export function validateMapping(headers: string[], mapping: ColumnMapping): string[] {
  const errors: string[] = []
  const unitCols = headers.filter(h => mapping[h]?.action === 'unit_count')
  if (unitCols.length > 1) errors.push('Only one column may be designated as Unit Count.')
  const emailCols = headers.filter(h => mapping[h]?.action === 'email_target')
  if (emailCols.length === 0) errors.push('At least one column must be the outreach email target.')
  // deal_name is recommended but not strictly required
  return errors
}
```

> **Email target selection** is not hardcoded — any column (or several) can be designated. Multiple email-target columns are concatenated into the `deals.outreach_emails` text array.
> **Unit count designation** is required-ish: it powers all per-unit financial metrics. Exactly one column may carry it. If the user designates none, `deals.unit_count` is left null and per-unit metrics simply show "—" until set manually on the underwriting tab.

### 13.4 — Import API Routes

**`POST /api/deals/import`** — upload + parse headers.

```typescript
// Validates: file present, campaign_id present, size <= 10MB,
// magic bytes (XLSX = PK\x03\x04 ZIP header; CSV = any text).
// Parses with parseFile(); creates an import_jobs row with status='mapping',
// source_headers = parsed headers, total_rows = parsed rows length.
// Returns: { batchId, headers, sampleRows: rows.slice(0,5) }
```

```typescript
// src/app/api/deals/import/route.ts (essentials)
export async function POST(req: NextRequest) {
  // CSRF + auth checks first

  const form = await req.formData()
  const file = form.get('file') as File | null
  const campaignId = form.get('campaign_id') as string | null
  const portfolioId = form.get('portfolio_id') as string | null   // optional

  if (!file || !campaignId) {
    return NextResponse.json({ error: 'file and campaign_id required' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 413 })
  }

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const isXlsx = file.name.toLowerCase().endsWith('.xlsx')
  if (isXlsx) {
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B &&
                  bytes[2] === 0x03 && bytes[3] === 0x04
    if (!isZip) return NextResponse.json({ error: 'File must be a valid .xlsx file' }, { status: 415 })
  }

  let parsed
  try {
    parsed = await parseFile(buffer, file.name)
  } catch {
    return NextResponse.json({ error: 'Could not parse file.' }, { status: 422 })
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found in file' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: job } = await supabase.from('import_jobs').insert({
    campaign_id: campaignId,
    portfolio_id: portfolioId,
    user_id: user.id,
    source_headers: parsed.headers,
    total_rows: parsed.rows.length,
    status: 'mapping',
  }).select('id').single()

  // NOTE: the parsed rows themselves are re-uploaded with the confirm call,
  // or cached server-side keyed by batchId — do not store full file contents
  // in import_jobs. Keep only headers + the mapping there.

  return NextResponse.json({
    batchId: job!.id,
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 5),
  })
}
```

**`POST /api/deals/import/[batchId]/mapping`** — persist the column mapping.

```typescript
// Body: { mapping: ColumnMapping }
// 1. Run validateMapping(headers, mapping); return 422 with errors if any.
// 2. For every { action: 'new_field' } entry, INSERT a field_definitions row
//    (key, label, data_type) if the key does not already exist.
// 3. Save mapping onto import_jobs.column_mapping.
// 4. Return a preview: applied rows, plus advisory duplicate flags.
//    Duplicate detection is BEST-EFFORT only: if any mapped dynamic field
//    looks like an external id (e.g. key 'property_id'), flag rows whose
//    value already exists for a deal in the same campaign. Never block.
```

**`POST /api/deals/import/[batchId]/confirm`** — triggers a Supabase Edge Function for bulk insert (avoids Vercel's 60s timeout). For each data row the Edge Function:

1. Inserts a `deals` row — `deal_name` from the mapped system column, `unit_count` from the mapped unit column, `outreach_emails` from the mapped email-target column(s), `campaign_id`, `portfolio_id`, `import_batch = "YYYY-MM-DD_{batchId}"`, `stage='lead'`.
2. For every `{ action: 'field' | 'new_field' }` column, inserts a `deal_fields` row `(deal_id, field_id, value)`.
3. Calls `seed_default_checklist(deal_id)`.
4. Updates `import_jobs.inserted` / `import_jobs.status` as it progresses.

The client polls **`GET /api/deals/import/[batchId]/status`** every 2 seconds.

> **No row is rejected for a missing external identifier.** A row is "Invalid" only if it has no value at all in any mapped column (a fully blank row). Duplicate rows are flagged but still importable — the user decides.

---

## 14. Dynamic Fields API

### `GET /api/field-definitions`

Returns all `field_definitions` rows ordered by `sort_order`. Used by `DealTable.tsx` to build dynamic grid columns and by `DynamicFieldPanel.tsx` to render the deal detail.

### `POST /api/field-definitions`

Body: `{ key, label, data_type, show_in_grid? }`. Internal only. Creates a new dynamic field definition (the import wizard also does this implicitly via `new_field` mappings).

### `GET /api/deals/[id]/fields`

Returns the deal's dynamic values as `{ [fieldKey]: { value, label, data_type } }`, joining `deal_fields` to `field_definitions`.

### `PATCH /api/deals/[id]/fields`

Body: `{ [fieldKey]: value }`. For each pair: look up the `field_definitions` row by key, validate/cast `value` against `data_type` (see §15 Zod), then upsert the `deal_fields` row (`unique (deal_id, field_id)`). Internal only.

---

## 15. Zod Validation Schemas

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

// deals now holds only system fields.
export const createDealSchema = z.object({
  campaign_id: z.string().uuid(),
  portfolio_id: z.string().uuid().optional().nullable(),
  deal_name: z.string().min(1).max(255),
  outreach_emails: z.array(z.string().email()).default([]),
  unit_count: z.number().int().min(1).optional().nullable(),
})

export const patchDealSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  portfolio_id: z.string().uuid().optional().nullable(),
  deal_name: z.string().min(1).max(255).optional(),
  outreach_emails: z.array(z.string().email()).optional(),
  unit_count: z.number().int().min(1).optional().nullable(),
  stage: z.enum([
    'lead','outreach','response','underwriting','loi','closed','failed','archived',
  ]).optional(),
  score: z.enum(['very_good','good','bad','very_bad']).optional().nullable(),
  is_archived: z.boolean().optional(),
  archive_reason: z.string().max(500).optional().nullable(),
  internal_notes: z.string().max(10000).optional().nullable(),
  drive_folder_url: z.string().url().optional().nullable(),
})

// Dynamic field write: value is validated/cast per data_type at runtime.
export const dynamicFieldPatchSchema = z.record(z.string(), z.union([
  z.string(), z.number(), z.boolean(), z.null(),
]))
```

### `src/lib/validations/portfolio.schema.ts`

```typescript
import { z } from 'zod'

export const createPortfolioSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
})

export const deletePortfolioSchema = z.object({
  mode: z.enum(['orphan', 'archive']),
})
```

### `src/lib/validations/activity.schema.ts`

```typescript
import { z } from 'zod'

export const createActivitySchema = z.object({
  deal_id: z.string().uuid(),
  type: z.enum(['call', 'voicemail', 'note', 'meeting', 'other']),
  summary: z.string().min(1).max(2000),
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

### `src/lib/validations/import.schema.ts`

```typescript
import { z } from 'zod'

const columnActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('system'), field: z.literal('deal_name') }),
  z.object({ action: z.literal('email_target') }),
  z.object({ action: z.literal('unit_count') }),
  z.object({ action: z.literal('field'), key: z.string().min(1) }),
  z.object({
    action: z.literal('new_field'),
    key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'lowercase, digits, underscores only'),
    label: z.string().min(1),
    dataType: z.enum(['text','number','integer','date','boolean','url','currency']),
  }),
  z.object({ action: z.literal('drop') }),
])

export const mappingSchema = z.object({
  mapping: z.record(z.string(), columnActionSchema),
})
```

---

## 16. Email Templates

```typescript
// src/lib/email/templates/outreach.tsx
import { Html, Body, Container, Text, Heading } from '@react-email/components'

interface OutreachEmailProps {
  ownerName: string
  propertyLabel: string     // deal_name or a mapped address dynamic field
  senderName: string
  customParagraph?: string
}

export default function OutreachEmail({
  ownerName, propertyLabel, senderName, customParagraph,
}: OutreachEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading style={{ fontSize: '18px' }}>Regarding {propertyLabel}</Heading>
          <Text>Dear {ownerName},</Text>
          <Text>{customParagraph ?? 'I am reaching out regarding your property. We are active acquirers in this market and would love to connect.'}</Text>
          <Text>Best regards,<br />{senderName}</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

Render to HTML (note: `render()` is async in `@react-email/render` v1+):

```typescript
import { render } from '@react-email/render'
const html = await render(<OutreachEmail {...props} />)
```

> `propertyLabel` is `deal_name` if set, otherwise a mapped address dynamic field, otherwise a generic phrase — the system no longer assumes a `property_address` column exists.

---

## 17. API Route Patterns

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
      campaigns(name, market),
      portfolios(id, name),
      contacts(*),
      underwriting(underwritability_status, asking_price, proceed_with_loi),
      deal_fields(value, field_definitions(key, label, data_type)),
      call_briefs(id, call_status, published)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### Deal Stage Updates

```
PATCH /api/deals/[id]
  If body includes `stage`:
    1. Fetch the deal's current stage.
    2. Call canTransition(current, requested) from src/lib/stage-machine.ts.
    3. If !ok → return 422 { error: reason }.
    4. If requested === 'failed' and current !== 'loi' → 422 (covered by canTransition).
  If body includes `unit_count`: also recompute per-unit fields on the
    underwriting row (price_per_unit, purchase_price_per_unit, capex_per_unit).
  Auth: internal only.
```

### Portfolio API Routes

```
POST /api/portfolios
  Body: { name, description? }   → insert; auth internal only

PATCH /api/portfolios/[id]
  Body: { name?, description? }  → update; auth internal only

GET /api/portfolios/[id]
  Returns the portfolio plus its member deals (join on portfolio_id).

DELETE /api/portfolios/[id]
  Body: { mode: 'orphan' | 'archive' }   (validated by deletePortfolioSchema)
  See §6.4. Hard-deletes only the portfolio row; deals are orphaned or archived.
  Auth: internal only.
```

### Activity Log API Routes

```
GET /api/deals/[id]/activity
  Returns activity_log rows for the deal, newest first.

POST /api/deals/[id]/activity
  Body: { type, summary }   (validated by createActivitySchema)
  Inserts an activity_log row; logged_by = current user.
  The touch_last_contacted trigger updates deals.last_contacted_at automatically.
  Auth: internal only.
```

### LOI API Routes

```
POST /api/loi
  Body: { deal_id, submitted_at, offered_price }
  1. Validate with Zod.  2. Upsert loi_records (unique on deal_id).
  3. Advance deals.stage to 'loi' (via canTransition).
  Auth: internal only.

PATCH /api/loi/[id]
  Body: { outcome?, final_price?, close_date?, fallen_through_reason?, fallen_through_date? }
  1. Update loi_records.
  2. outcome='deal_reached' → deal.stage = 'closed'.
  3. outcome='fallen_through' → deal.stage = 'failed'
     (this is the ONLY transition that produces 'failed'; do NOT also set
      is_archived — 'failed' is a distinct terminal state, not an archive).
  Auth: internal only.

POST /api/loi/[id]/rounds
  Body: { price, party ('buyer'|'seller'), round_date, notes? }
  round_num = SELECT COALESCE(MAX(round_num),0)+1 FROM loi_rounds WHERE loi_id=$1
  Auth: internal only.

GET /api/loi/[id]/rounds
  Returns all rounds ordered by round_num ASC.  Auth: internal only.
```

### Contact API Routes

```
POST /api/contacts     Body: contact fields; at least one email; primary handling.
PATCH /api/contacts/[id]   Partial fields; same is_primary logic.
DELETE /api/contacts/[id]  409 if deleting the only primary with others existing.
  All: auth internal only.
```

### Response Classification Flow

```
POST /api/emails/send
  Body: { deal_id, contact_id }
  1. CSRF + rate limit (emailSendRateLimit.limit(userId)).
  2. Load contact / outreach emails; load campaign email template.
  3. Render React Email template to HTML.
  4. Send via Gmail API.
  5. Insert email_outreach: { status:'sent', sent_at, gmail_message_id, gmail_thread_id }.
  6. If deal.stage === 'lead' → advance to 'outreach'.
  Auth: internal only; return 400 if Gmail not connected.

PATCH /api/emails/[id]
  Allowed body fields:
    response_classification: 'positive'|'neutral'|'negative'|'no_response'
      → if 'positive' OR 'neutral' AND deal.stage === 'outreach':
          advance deal.stage to 'response'.
    thank_you_sent: true       (sends thank-you email; records thank_you_sent_at)
    declination_sent: true     (sends declination email; records declination_sent_at)
    conversation_log: string   (plain text, max 5000 chars)
  Auth: internal only.
```

> **Behaviour change:** a **neutral** reply now also advances the deal to `response` (per the redesign — the pipeline accepts positive *or* neutral responses). The old plan advanced only on positive.

**Never use the service role key in any API route that serves user requests.** Use `createAdminClient()` only in: the Gmail webhook and `/api/admin/*` routes.

---

## 18. Building the UI — Phase Order

Build and verify each phase before moving to the next.

### Phase A — Auth Shell

1. Build the login page per §11.4.
2. Build the signup page (same Turnstile + Zod gate).
3. Build the `/reset-password` stub: centered card "Password reset is coming soon."
4. Test: unauthenticated visit to `/dashboard` redirects to `/login`.

### Phase B — Internal Layout & Navigation

```
INTERNAL SIDEBAR SPEC (Ref: UI.md §4.1):
- Fixed left sidebar: 220px expanded / 52px collapsed on desktop.
- Background var(--color-sidebar-bg), border-right var(--color-sidebar-border).
  Light mode: warm surface tones; dark mode: permanently dark (#0E0E0E).
- Top: BrandLogo variant="wordmark".
- Nav items (lucide-react icons, h-4 w-4):
    Dashboard    — LayoutDashboard  — /dashboard
    Deals        — Building2        — /deals
    Portfolios   — FolderKanban     — /portfolios          (NEW)
    Campaigns    — Megaphone        — /campaigns
    Import       — Upload           — /import
    Settings     — Settings         — /settings
    Client View  — Eye              — /client-view/overview
- Active item: bg var(--color-sidebar-active), text var(--color-sidebar-text), 500 weight.
- Inactive: no bg, text var(--color-sidebar-text-muted), hover transitions.
- Bottom: user avatar + full_name + role badge ("Internal" / "Client").
- Theme toggle (KNOWN VIOLATION — to be replaced per UI.md §3.5).
- Mobile (< 1024px): sidebar → Sheet drawer; hamburger in a top header bar.
```

### Phase C — Deal List & Pipeline View (Dynamic Columns)

```
DEAL TABLE SPEC (Ref: EXCEL_TABLE.md & UI.md):
Component: src/components/deals/DealTable.tsx — built on the DataGrid.

Columns are SYSTEM columns + DYNAMIC columns:
  System (fixed):
    1. Checkbox            — row selection (fixed left)
    2. Deal Name           — editable (F2)
    3. Units               — editable number
    4. Stage               — <DealStageBar inline pill /> (read-only)
    5. Score               — <DealScoreBadge /> (read-only)
    6. Campaign            — campaign.name (F2 popover)
    7. Portfolio           — portfolio.name or "—" (F2 popover select)
    8. Last Contacted      — deals.last_contacted_at (read-only, relative date)
    9. Date Added          — created_at (read-only)
   10. Actions             — kebab menu (fixed right)
  Dynamic (runtime):
    One column per field_definitions row where show_in_grid = true.
    Built by DealTable from GET /api/field-definitions; each column's
    accessor reads the deal's joined deal_fields map and its editor casts
    on save per data_type. Users toggle column visibility via the gear popover.

Interaction (Excel-like): focus cell (arrows/Tab/Enter), range selection
  (Shift+Arrow / Shift+Click / drag), multi-range (Ctrl+Click), F2 edit,
  Ctrl+C / Ctrl+V batch patch, Ctrl+D / Ctrl+R fill, drag-resize / dbl-click autofit.

Filters (top bar): Stage, Score, Campaign, Portfolio, import_batch.

Colors (UI.md): row hover var(--color-accent-bg); selected range
  color-mix(in srgb, var(--color-accent) 15%, var(--color-surface-0));
  focus border 2px solid var(--color-accent) inset.

DealScoreBadge: very_good/good/bad/very_bad → var(--color-score-*); null → neutral.
```

### Phase D — Deal Detail Page (Core UI)

Tabbed interface. The redesigned tab set:

```
TABS: [Overview] [Contacts] [Outreach] [Activity] [Documents] [Underwriting] [LOI] [Call Brief]
```

#### Overview Tab

```
- Deal name (H1, text-2xl). Property attributes are rendered by
  <DynamicFieldPanel /> — it lists every field_definitions row with this
  deal's value (from deal_fields), each editable inline, auto-saving via
  PATCH /api/deals/[id]/fields. There are NO hardcoded address/zip inputs.
- Unit count: editable system field (PATCH /api/deals/[id]).
- Stage progress bar (DealStageBar — see below).
- Score badge (DealScoreBadge).
- Portfolio: select to assign/clear portfolio_id.
- Drive folder: "Open Drive Folder" if set, else "Create Drive Folder".
- Source + campaign name.
- Internal notes: textarea, auto-saves on blur (500ms debounce, max 10000 chars).

DEAL STAGE BAR SPEC (DealStageBar.tsx, Ref: UI.md §6.2):
- Horizontal stepper for the 6 progression stages:
    Lead → Outreach → Response → Underwriting → LOI → Closed
- Terminal states render distinctly:
    'failed'   → after the LOI step, a red terminal node "Failed"
    'archived' → stepper hidden; show a danger badge "Archived" + archive_reason
- Completed steps: bg var(--color-success-solid), <Check> icon.
- Active step: bg var(--color-primary).
- Future steps: transparent bg, 2px solid var(--color-surface-3).
- Stage controls (internal only, below the bar):
    "Move to Next Stage" — advances one step via nextStage(); PATCH /api/deals/[id].
    "Set Stage" <Select> — jump to any stage; the API still validates via
       canTransition(), so an invalid jump (e.g. → 'failed' pre-LOI) shows a toast error.
- Mobile (< 640px): collapse to "Stage 4 of 6: Underwriting" text + progress bar.
```

#### Contacts Tab

```
- List of contacts; each row: Name, Company/Title, Email(s), Phone, Primary badge.
- "Add Contact" → Dialog (Name, Company, Title, Email TagInput, phones, Primary switch)
  → POST /api/contacts.
- Edit (pencil) → prefilled Dialog → PATCH /api/contacts/[id].
- Delete (trash) → confirm Dialog → DELETE /api/contacts/[id]
  (blocked if deleting the only primary contact with others existing).
- Empty: EmptyState "No contacts yet" + "Add Contact" CTA.
```

#### Outreach Tab

```
Top — Email Status badge: Not Sent / Sent / Replied / Gmail Error / Invalid Address.
  If sent: "Sent [date]" + "To: [outreach email]".

Send Outreach Email button:
  Disabled if: no outreach email on file, or status not 'not_sent'.
  If Gmail not connected: disabled + inline alert linking to /settings.
  If connected: confirmation Dialog (subject + first 200 chars of body)
    → POST /api/emails/send → status 'sent'; deal 'lead' → 'outreach'.

Response Classification (visible when status === 'replied'):
  <Select>: Positive | Neutral | Negative | No Response → PATCH /api/emails/[id].
  If Positive OR Neutral:
    → deal auto-advances to 'response' (handled server-side).
    → show "Begin Underwriting" button (PATCH deal.stage → 'underwriting').
    → show "Send Thank-You Email" button.
  If Negative:
    → show "Send Declination Email" button.
    → show "Archive Deal" button (PATCH { stage:'archived', is_archived:true }).

Conversation Log: textarea, manually edited (NOT webhook-populated),
  auto-saves on blur, char count "0 / 5000".

Email Thread: "View Full Thread in Gmail" link if gmail_thread_id set.
```

#### Activity Tab  **(NEW)**

```
ACTIVITY TAB SPEC (ActivityTimeline.tsx):
- "Log Activity" button → inline form (no Dialog):
    Type <Select>: Call | Voicemail | Note | Meeting | Other
    Summary: text input (e.g. "Left voicemail re: pricing")
    → POST /api/deals/[id]/activity
- Timeline list below, newest first: each entry shows a type icon,
  the summary, the logger's name, and a relative timestamp.
- A small caption at the top shows "Last contacted: [relative date]"
  sourced from deals.last_contacted_at.
- Empty: EmptyState "No activity logged yet".
```

#### Documents Tab  **(redesigned — flexible checklist)**

```
DOCUMENT CHECKLIST TAB SPEC (DocumentChecklist.tsx):
Layout: two columns on desktop, single column on mobile.

Left column — Document Collection:
  A list of document_checklist rows for this deal. Each row:
    [Checkbox: collected] [doc_name] [optional metadata fields] [remove ✕]
  Default rows are seeded by seed_default_checklist() (P&L, Rent Roll, OM,
    Tax Bill, CAPEX Schedule, Market Report 1-4) but the list is EDITABLE:
    "+ Add Document" → input for doc_name → POST a new document_checklist row.
    Each row's ✕ removes that row (DELETE).
  Optional metadata (stored in the row's `metadata` jsonb) — e.g. an
    "Uploaded" date picker or a "Reviewer notes" text field — rendered when
    the document type calls for it. Auto-saves on change (500ms debounce).
  Saved via PATCH /api/deals/[id]/documents.

Right column — Confidentiality Agreement (deal_ca row):
  CA Status <Select>: Not Required / Pending / Signed / Approved.
  If Pending or Signed:
    Platform text input.
    CA Credential <Select> populated from ca_credentials ("[platform] — [username]",
      NEVER the password). "+ Add New Credential" → Dialog (Platform, Username,
      Password, Notes) → POST /api/ca-credentials (server encrypts via
      store_ca_credential) → refresh the select.

Drive Folder: "Open" if drive_folder_url set, else "Create Drive Folder".
```

#### Underwriting Tab  **(redesigned — screening + metrics + approvals)**

```
UNDERWRITING FORM TAB SPEC (UnderwritingForm.tsx + ApprovalPanel.tsx):
Cards stacked vertically.

Card 1 — Pre-Underwriting Screening:
  Determines whether the deal is worth underwriting. Fields:
    Asking Price ($), Price/Unit ($ — auto = asking_price / unit_count, "(auto)"),
    Population 1mi (int), Population Growth %, Rent Growth %, Vacancy Rate %,
    Market Price/Unit ($), Delta % (auto = (price_per_unit - market_ppu) /
      market_ppu × 100; colored: success if < 0, danger if > 0), Cap Rate %.
  Underwritability Status <Select>: Go | No-Go | Maybe.
    First save sets screened_at = now(), screened_by = current user.
    "No-Go" → warning banner with "Archive this deal?"
      → Dialog with archive_reason → PATCH { stage:'archived', is_archived:true }.

Card 2 — Underwriting Summary (3-col grid desktop, 1-col mobile):
  Purchase Price ($), Purchase Price/Unit ($ — auto), CapEx ($),
  CapEx/Unit ($ — auto), Occupancy %, IRR %, Equity Multiple (shown "2.3×"),
  Cash-on-Cash %, Projected Profit ($), Notes (textarea).
  Per-unit "(auto)" fields recompute from deals.unit_count; manual override allowed.

Card 3 — Deal Score:
  Four radio buttons: Very Good / Good / Bad / Very Bad → var(--color-score-*).
  "Flag for Client Call" button (visible when score is good/very_good):
    creates a call_brief (POST /api/calls) and shows a success toast.
    NOTE: this no longer changes deals.stage (the 'call_scheduled' stage was removed).

Card 4 — Approval & Review Tracking (ApprovalPanel.tsx):
  proceed_with_loi: a clear Yes/No control — the formal go/no-go to issue an LOI.
  UW Analyst <Select> (profiles, internal) + UW Completion Date (date).
  Reviewer 1 <Select> + Review 1 Date.
  Reviewer 2 <Select> + Review 2 Date.
  When proceed_with_loi = Yes, surface a "Create LOI" shortcut to the LOI tab.

Save: single "Save Underwriting" button. Validates percentages 0-100,
  prices > 0. Field-level inline errors; success toast.
  Writes go to PATCH /api/underwriting (+ PATCH /api/deals/[id] for stage/score).
```

#### LOI Tab

```
LOI TAB SPEC:
No LOI yet → EmptyState "No LOI submitted" + "Create LOI".

Create LOI Dialog: Submitted Date, Offered Price ($) → POST /api/loi
  (advances deal to 'loi').

LOI Record Display:
  Submitted date, Offered price.
  Outcome <Select>: In Progress | Deal Reached | Fallen Through.
    "Deal Reached" → Final Price + Close Date → PATCH /api/loi/[id]
       → deal.stage = 'closed'.
    "Fallen Through" → Reason textarea + Date → PATCH /api/loi/[id]
       → deal.stage = 'failed'  (the only path to 'failed').

Counter-Offer Rounds (below): table Round # | Party | Price | Date | Notes.
  "Add Round" → inline form (Party select, Price, Date, Notes) → POST /api/loi/[id]/rounds.
```

#### Call Brief Tab

```
CALL BRIEF TAB SPEC (internal view):
No brief → EmptyState "No brief created" + "Create Brief"
  → POST /api/calls { deal_id } (published=false, call_status='pending').

Once it exists:
  Summary Text: large textarea (min-h-[200px]), auto-saves on blur.
  Published toggle (<Switch>): OFF "Draft — not visible to client";
    ON "Published" — toggling ON shows a confirm Dialog
    → PATCH /api/calls/[id] { published:true, published_at: now() }.
  Call Status badge (read-only): Pending / Completed / Cancelled.
  Client Notes (read-only): client's text or "No notes yet".
```

### Phase E — Import Wizard  **(redesigned — 5 steps)**

```
IMPORT WIZARD SPEC (ImportWizard.tsx, route /import):
Stepper: 5 steps shown as a horizontal progress bar.

Step 1 — Upload:
  Campaign <Select> (required, from GET /api/campaigns).
  Portfolio <Select> (optional, from GET /api/portfolios).
  File input: drag-and-drop zone, ".xlsx or .csv".
  "Parse File" → POST /api/deals/import → returns { batchId, headers, sampleRows }.

Step 2 — Map Columns (ColumnMapper.tsx):
  A row per source header. Each row shows the header, a sample value, and an
  action <Select>:
    • Deal Name (system)
    • Email Target  (may be chosen on multiple columns)
    • Unit Count    (may be chosen on exactly one column)
    • Existing Field → secondary <Select> of field_definitions
    • New Field     → inline inputs: label, key (auto-slugged), data type
    • Drop
  Live validation banner (validateMapping): warns if 0 email-target columns
  or >1 unit-count column. "Continue" disabled while errors exist.

Step 3 — Confirm Targets:
  A read-only summary: which column is Deal Name, which column(s) are Email
  Targets, which column is Unit Count, the list of dynamic fields that will be
  created or populated, and which columns are dropped. "Looks good" →
  POST /api/deals/import/[batchId]/mapping (creates new field_definitions,
  saves the mapping, returns preview).

Step 4 — Preview:
  Table of rows to be inserted, columns reflecting the mapping. Status column:
    "New" (success badge) — will be inserted.
    "Duplicate" (warning badge) — advisory only; an external-id-like field
       value already exists in this campaign. STILL importable — a checkbox
       lets the user include or exclude duplicates.
    "Empty" (danger badge) — a fully blank row; auto-excluded.
  Summary bar: "142 rows · 130 new · 8 duplicates · 4 empty".
  "Import [N] Rows" → POST /api/deals/import/[batchId]/confirm.

Step 5 — Importing → Success:
  Progress bar polls GET /api/deals/import/[batchId]/status every 2s
  ("Importing... 45 of 130"); beforeunload warning while running.
  On done: "Import complete. 130 deals added to [Campaign Name]."
    "View Deals" → /deals?import_batch=[batchTag]
    "Import Another File" → resets to Step 1.
```

### Phase F — Portfolios  **(NEW)**

```
PORTFOLIOS PAGE SPEC (/portfolios):
Page title "Portfolios", subtitle "Optional groupings of deals".

"New Portfolio" → Dialog (Name required, Description optional) → POST /api/portfolios.

Portfolio cards grid (PortfolioCard.tsx): each card shows name, description,
  deal count, and a kebab menu (Edit / Delete).
  Card click → /portfolios/[id].

PORTFOLIO DETAIL (/portfolios/[id]):
  Header: portfolio name + edit pencil.
  A DealTable filtered to portfolio_id = this portfolio (reuses Phase C grid).
  "Add Deals" → multi-select dialog of unassigned deals → PATCH portfolio_id.

DELETE PORTFOLIO (DeletePortfolioDialog.tsx):
  Triggered from the kebab "Delete". The dialog REQUIRES the user to choose:
    ◉ Orphan the deals — "Deals stay on the board, ungrouped."
    ○ Archive the deals — "Deals are archived with reason 'Portfolio Deleted'."
  A notice lists any member deals at/past LOI that will be left untouched.
  Confirm → DELETE /api/portfolios/[id] { mode }.
```

### Phase G — Internal Dashboard

```
DASHBOARD PAGE SPEC (/dashboard):
Server component. Fetches get_pipeline_summary() + recent deal counts.
Header "Dashboard" + current-date subtitle.

FunnelMetrics: vertical SVG funnel, 7 stages:
  Leads → Emails Sent → Responses → Underwritten → Scored Good → LOI → Closed.
  Each stage: trapezoid width proportional to count; name, count, conversion %
  from the prior stage. Click a segment → /deals?stage=[stage]. No animation in Phase 1.

KPIScorecard (3×2 grid): 6 cards, each with metric name, value, target,
  delta vs target, 7-day sparkline (recharts LineChart, no axes):
    1. Total Leads        2. Emails Sent        3. Response Rate (target: campaign)
    4. Underwritten       5. Good Deals         6. LOIs Submitted (target: campaign)
  Card border: green if value ≥ target, red if below, grey if no target.

PipelineTable: campaign rows × stage columns; cell = deal count. Source:
  get_pipeline_summary() — which now also returns failed_count, so the table
  may show a "Failed" column alongside "Closed".
```

### Phase H — Client Dashboard

```
CLIENT OVERVIEW (/overview):
Title "Active Deals", subtitle "Properties your team is actively pursuing".
Funnel summary strip (3 numbers): Deals Reviewed | Currently Active | LOIs Submitted.
Deal cards grid (ClientDealCard.tsx): Deal name, key dynamic fields (e.g. address —
  read from deal_fields via the client-readable RLS policy), Score badge
  (Good/Very Good only), unit count, simplified stage badge
  ("In Underwriting", "Offer Submitted"). Not clickable in Phase 1.
Empty: "No active deals yet. Your team will notify you when deals are ready."

CLIENT CALLS (/calls):
Title "Call Queue", subtitle "Review these deals before your call with the team".
Active briefs (published=true, call_status='pending', flagged_at DESC): each card
  shows property name, score, full summary, a Call Status dropdown
  (Pending → Completed | Cancelled), a Client Notes textarea (auto-saves on blur),
  and a "Mark as Done" button → PATCH /api/calls/[id] { call_status, client_notes }.
Completed Calls: collapsible accordion at the bottom, read-only.
Empty: "No calls queued yet. Your team will notify you."
```

### Phase I — Settings Page

```
SETTINGS PAGE SPEC:

Section 1 — Gmail Connection: Connect / Disconnect Gmail (per §12).

Section 2 — Campaign Management (internal only):
  Table: Name | Market | Listing Type | Email Template | Status | Actions.
  "New Campaign" → Dialog → POST /api/campaigns; Edit → PATCH; Deactivate toggle.

Section 3 — Email Template Editor (internal only):
  Campaign selector + template-key selector ('outreach' editable in Phase 1).
  Subject line input + body textarea with variables:
    {{owner_name}}, {{property_label}}, {{sender_name}}, {{custom_paragraph}}.
  (Note: {{property_label}} replaces the old {{property_address}} — the system
   no longer assumes an address column exists.)
  "Preview" Dialog with sample data; "Save Template" → PATCH /api/campaigns/[id].

Section 4 — Field Definitions (internal only)  **(NEW)**:
  Table of all field_definitions: Label | Key | Data Type | Show in Grid | Actions.
  Lets the team rename labels, change data types, and toggle show_in_grid
  without re-importing. "New Field" → Dialog → POST /api/field-definitions.

Section 5 — User Management (internal only):
  Table: Name | Email | Role | Status | Actions.
  "Invite User" → Dialog (Email, Full Name, Role; Organization if Client)
    → POST /api/admin/invite (supabase.auth.admin.inviteUserByEmail via service role).
  Remove → DELETE /api/admin/users/[id]; Role change → PATCH /api/admin/users/[id]
    (updates BOTH profiles.role AND auth.users.raw_app_meta_data.role).
```

---

## 19. Database Seed

```sql
-- supabase/seed.sql — run with: npx supabase db reset (local only)

-- Admin test user: test-admin@example.com / Password123!
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000000',
  'test-admin@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(), '{"role": "admin"}',
  '{"full_name": "Admin Tester", "role": "admin"}'
);

-- Internal test user: test-internal@example.com / Password123!
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'test-internal@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(), '{"role": "internal"}',
  '{"full_name": "Internal Tester", "role": "internal"}'
);

-- Client test user: test-client@example.com / Password123!
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'test-client@example.com',
  crypt('Password123!'::text, gen_salt('bf'::text)),
  now(), '{"role": "client"}',
  '{"full_name": "CEO Client", "role": "client"}'
);

-- Seed campaign
insert into public.campaigns (id, name, market, listing_type, email_template,
  email_subject_template, is_active)
values (
  'cccccccc-0000-0000-0000-000000000001',
  'NJ Multifamily Q1 2026', 'NJ', 'off_market', 'outreach',
  'Acquisition Inquiry -- {{property_label}}', true
);

-- Seed portfolio
insert into public.portfolios (id, name, description)
values (
  'eeeeeeee-0000-0000-0000-000000000001',
  'Northern NJ Value-Add', 'Pilot grouping for value-add multifamily.'
);

-- Seed dynamic field definitions
insert into public.field_definitions (id, key, label, data_type, show_in_grid, sort_order)
values
  ('ffff0001-0000-0000-0000-000000000001', 'street_address', 'Street Address', 'text', true, 10),
  ('ffff0002-0000-0000-0000-000000000001', 'city',           'City',           'text', true, 20),
  ('ffff0003-0000-0000-0000-000000000001', 'state',          'State',          'text', true, 30),
  ('ffff0004-0000-0000-0000-000000000001', 'zip',            'Zip',            'text', false, 40),
  ('ffff0005-0000-0000-0000-000000000001', 'costar_url',     'CoStar URL',     'url',  false, 50),
  ('ffff0006-0000-0000-0000-000000000001', 'property_id',    'CoStar Property ID', 'text', false, 60);

-- Seed deals (system fields only) spread across the new lifecycle
insert into public.deals (id, campaign_id, portfolio_id, deal_name,
  outreach_emails, unit_count, stage, score, created_by)
values
  ('dddddddd-0001-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001', 'Oak Park Apartments',
   '{"owner1@example.com"}', 48, 'underwriting', 'good',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0002-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001', 'Riverside Heights',
   '{"owner2@example.com"}', 72, 'loi', 'very_good',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0003-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   null, 'Maple Court',
   '{"owner3@example.com"}', 24, 'lead', null,
   'aaaaaaaa-0000-0000-0000-000000000001');

-- Seed dynamic field values for the deals
insert into public.deal_fields (deal_id, field_id, value)
values
  ('dddddddd-0001-0000-0000-000000000001', 'ffff0001-0000-0000-0000-000000000001', '123 Oak St'),
  ('dddddddd-0001-0000-0000-000000000001', 'ffff0002-0000-0000-0000-000000000001', 'Newark'),
  ('dddddddd-0001-0000-0000-000000000001', 'ffff0003-0000-0000-0000-000000000001', 'NJ'),
  ('dddddddd-0002-0000-0000-000000000001', 'ffff0001-0000-0000-0000-000000000001', '456 River Rd'),
  ('dddddddd-0002-0000-0000-000000000001', 'ffff0002-0000-0000-0000-000000000001', 'Jersey City'),
  ('dddddddd-0002-0000-0000-000000000001', 'ffff0003-0000-0000-0000-000000000001', 'NJ'),
  ('dddddddd-0003-0000-0000-000000000001', 'ffff0001-0000-0000-0000-000000000001', '789 Maple Ave'),
  ('dddddddd-0003-0000-0000-000000000001', 'ffff0002-0000-0000-0000-000000000001', 'Trenton'),
  ('dddddddd-0003-0000-0000-000000000001', 'ffff0003-0000-0000-0000-000000000001', 'NJ');

-- Seed default checklists
select public.seed_default_checklist('dddddddd-0001-0000-0000-000000000001');
select public.seed_default_checklist('dddddddd-0002-0000-0000-000000000001');
select public.seed_default_checklist('dddddddd-0003-0000-0000-000000000001');
```

---

## 20. Error Handling & Observability

- Wrap all API routes in try/catch; return `{ error: string }` with an appropriate status.
- Client-side: use `sonner` toast for errors and success.
- Log Gmail errors to `email_outreach.error_message`.
- `console.error` in development; wire `pino` in production.
- Invalid stage transitions return 422 with the `canTransition` reason.
- Import jobs that fail write details to `import_jobs.error_log`.

---

## 21. Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` imported ONLY in `src/lib/supabase/admin.ts`.
- [ ] `createAdminClient()` used ONLY in `/api/emails/webhook` and `/api/admin/*`.
- [ ] All user-facing queries use `createClient()` (anon key) — RLS scopes data.
- [ ] CSRF origin check in all POST/PATCH/DELETE routes.
- [ ] Turnstile verified server-side before auth operations.
- [ ] Rate limiting on login (5/5min/IP) and email send (100/day/user).
- [ ] Google tokens stored in DB, never localStorage/cookies.
- [ ] CA passwords stored as `pgp_sym_encrypt` ciphertext — never plaintext.
- [ ] `ca_credentials` never queried in a client-facing route.
- [ ] `.env.local` in `.gitignore`; all secrets server-only (no `NEXT_PUBLIC_`).
- [ ] All routes validate input with Zod before touching the DB.
- [ ] Dynamic field writes cast `value` per `data_type` — never trust raw input.
- [ ] Stage writes always pass through `canTransition()` server-side.
- [ ] `'failed'` is rejected server-side unless the current stage is `loi`.
- [ ] Portfolio DELETE never hard-deletes deals — only orphans or archives.
- [ ] File uploads: magic bytes checked (XLSX), size capped at 10MB.
- [ ] CSP headers configured in `next.config.ts`.
- [ ] Gmail webhook verifies the Google Pub/Sub JWT.
- [ ] `get_pipeline_summary` is a security-definer function with an internal-role gate.
- [ ] Client `call_briefs` PATCH whitelists only `call_status` and `client_notes`.
- [ ] User role change updates BOTH `profiles.role` AND `auth.users.raw_app_meta_data.role`.

---

## 22. Testing Checklist (manual, per phase)

**Auth:**
- [ ] Wrong credentials → 401; missing/invalid Turnstile → 400; 6th login in 5 min → 429.
- [ ] Client cannot reach `/dashboard`; internal cannot reach `/overview`.

**Deals & Stages:**
- [ ] Import creates deals with the correct `import_batch` tag.
- [ ] Setting `stage='failed'` on a non-`loi` deal returns 422.
- [ ] LOI outcome `fallen_through` sets `stage='failed'` (not archived).
- [ ] LOI outcome `deal_reached` sets `stage='closed'`.
- [ ] Archiving a pre-LOI deal sets `stage='archived'`, `is_archived=true`.
- [ ] A neutral email reply advances the deal to `response`.

**Flexible Schema / Import:**
- [ ] A file with no external ID column imports successfully.
- [ ] A brand-new source column can be mapped to a new dynamic field; a
      `field_definitions` row is created and the value lands in `deal_fields`.
- [ ] Designating two columns as Unit Count is blocked at validation.
- [ ] Designating zero email-target columns is blocked at validation.
- [ ] A CSV file imports as readily as an XLSX file.
- [ ] Duplicate rows are flagged but still importable when the user opts in.

**Portfolios:**
- [ ] Deleting a portfolio with "Orphan" sets member deals' `portfolio_id` to null.
- [ ] Deleting with "Archive" sets pre-LOI member deals to `archived` with
      reason "Portfolio Deleted"; at/past-LOI deals are left untouched.
- [ ] No portfolio deletion ever hard-deletes a deal row.

**Activity:**
- [ ] Logging a call updates `deals.last_contacted_at`.

**Client Dashboard:**
- [ ] Client sees only Good/Very Good non-archived deals and their dynamic fields.
- [ ] Client can mark a call complete and leave notes; internal sees notes read-only.

**Security:**
- [ ] Cross-origin POST to `/api/emails/send` returns 403.
- [ ] `GET` of pipeline summary as a client returns empty.

---

## 23. Deployment Notes

### Vercel

```bash
npm i -g vercel
vercel
```

Set all env vars in Vercel → Project → Settings → Environment Variables.

`vercel.json` for the Gmail watch cron:

```json
{
  "crons": [
    { "path": "/api/auth/google/refresh-watch", "schedule": "0 12 */6 * *" }
  ]
}
```

### Supabase Production

- Enable Point-in-Time Recovery.
- Complete the Gmail Pub/Sub setup per §12.4 before the first Gmail connection.
- The bulk-import Edge Function must be deployed (`npx supabase functions deploy`).

### Post-deploy

```bash
npx supabase db push     # apply migrations
npm run db:types          # regenerate types
```

---

## 24. Future Expansion Points

Do not build these in Phase 1. The architecture supports them cleanly:

- **Email open tracking** — add `opened_at` to `email_outreach`, tracking pixel.
- **Automated follow-up sequences** — `follow_up_sequences` table + Supabase pg_cron.
- **Typed dynamic-field storage** — add typed value columns to `deal_fields` if
  query performance on casts becomes a concern.
- **Per-portfolio analytics** — roll up `get_pipeline_summary()` by `portfolio_id`.
- **DocuSign CA signing** — extend `ca_credentials` with a DocuSign envelope ID.
- **Multi-tenant** — add `organization_id` FK to campaigns + deals; update RLS.
- **Mobile app** — Supabase Realtime + the same API routes.
- **Full Gmail thread inline rendering** — fetch the thread body in the Outreach tab.
- **Password reset flow** — Supabase `resetPasswordForEmail` on `/reset-password`.

---

## 25. Final Agent Instructions

1. Read this entire PLAN.md, UI.md, and EXCEL_TABLE.md before writing any code.
2. Collect all `.env.local` values from the user via 🛑 stop points.
3. Run `npx supabase db push` and verify with `npx supabase db diff --linked` (must output nothing).
4. Generate types with `npm run db:types` immediately after migrations.
5. Build and test each Phase (A→I) before moving to the next.
6. There is ONE `deals` table and NO separate "Leads" entity — every record starts at `stage='lead'`.
7. The `deals` table holds ONLY system fields. All other property data goes in `deal_fields`; never add ad-hoc property columns to `deals`.
8. The deal lifecycle has 8 stages: `lead, outreach, response, underwriting, loi, closed, failed, archived`. The old intermediate stages are gone.
9. `'failed'` is valid ONLY as a transition from `'loi'`. Enforce this server-side via `canTransition()`; return 422 otherwise.
10. Any deal removed from the pipeline before LOI must be `archived`, never `failed`.
11. The import engine is column-agnostic — NO hardcoded column map. The user maps every source column at import time.
12. `gen_random_uuid()` is the only primary key. External identifiers (e.g. `property_id`) are plain dynamic fields and are never required; imports without one must not break.
13. Exactly ONE column may be designated Unit Count; at least one column must be the email target. Validate before confirm.
14. Portfolio deletion must prompt orphan-vs-archive and NEVER hard-delete deals.
15. Logging an `activity_log` row updates `deals.last_contacted_at` via trigger — do not set it manually.
16. The `document_checklist` is flexible: rows can be added/removed per deal.
17. The `underwriting` table carries screening fields, output fields, AND approval fields (`proceed_with_loi`, analyst, two reviewers + dates).
18. A positive OR neutral email reply advances the deal to `'response'`.
19. Never use `createAdminClient()` in any user-facing route — only the webhook and admin routes.
20. Never use `req.ip` — read IP from `x-forwarded-for`.
21. `render()` from `@react-email/render` is async — always `await` it.
22. `supabase gen types` uses `--project-ref`, not `--project-id`.
23. Do NOT use `supabase migration up` — use `supabase db push` only.
24. `import_batch` format is `YYYY-MM-DD_{importJobUuid}`.
25. There is NO `src/middleware.ts`. Use `src/proxy.ts` (Next.js 16 proxy); the function is exported as `proxy()`, not `middleware()`.
26. Do NOT add more `next-themes` usage — the current root-layout usage is a known UI.md violation, to be replaced with an inline `<script>` + `localStorage`.
27. NEVER use Tailwind palette colors. ONLY `var(--color-*)` tokens from `globals.css`.
28. Tailwind CSS v4 with `@tailwindcss/postcss`. There is NO `tailwind.config.ts`; tokens live in `@theme inline` in `globals.css`.
29. The DataGrid must support runtime-generated dynamic columns sourced from `field_definitions`.
30. The sidebar uses `--color-sidebar-*` CSS variables — warm tones in light mode, permanently dark in dark mode.
