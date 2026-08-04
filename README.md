# Acquire — Multifamily Property Acquisition Platform

> **Acquire** is an enterprise-grade, multi-tenant acquisition management platform built for commercial real estate acquisition teams, brokers, and investment sponsors. It streamlines the lifecycle of multifamily real estate transactions from raw lead ingestion (e.g. CoStar CSV/Excel exports) through automated Gmail outreach, underwritability evaluation, financial underwriting with multi-tier approvals, LOI negotiations, document checklist collection, and Google Drive file repository management.

---

## 🚀 Technology Stack

- **Frontend Core**: [Next.js 16.2.6](https://nextjs.org/) (App Router, Turbopack), [React 19.2.4](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
- **Database & Auth**: [Supabase PostgreSQL](https://supabase.com/) with Row-Level Security (RLS) & `@supabase/ssr`
- **Styling & UI**: [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/postcss`), Custom CSS Variables, [Radix UI](https://www.radix-ui.com/)
- **State & Data Grid**: [TanStack React Query v5](https://tanstack.com/query), [TanStack React Virtual v3](https://tanstack.com/virtual)
- **Email & Communications**: Google Gmail API v1, Google People API v1, `@react-email/components`
- **Cloud Storage**: Google Drive API v3 (Streaming Uploads & Batch Trees)
- **Security & Bot Protection**: Cloudflare Turnstile, Upstash Redis Rate Limiting (`@upstash/ratelimit`)
- **Import Engine**: PapaParse (CSV), ExcelJS (XLSX)

---

## 🌟 Core Features

### 🏢 1. Multi-Tenant Project Architecture
- Workspaces are strictly scoped to **Projects**.
- **Internal Members** and **Admins** manage multiple projects with assigned team memberships (`project_members`).
- **Client Sponsors** access read-only active deals for assigned projects (`sponsors`).

### 📊 2. Virtualized DataGrid & 8-Stage Flexible Pipeline
- **8-Stage State Machine**: `lead` ──► `outreach` ──► `response` ──► `underwriting` ──► `loi` ──► `closed` (plus off-ramps `archived` & `failed`).
- **Entity-Attribute-Value (EAV) Fields**: Dynamic custom fields per project without schema changes (`field_definitions` & `deal_fields`).
- **DataGrid**: Virtualized table rendering thousands of deals with inline editing, cell glow animations, keyboard navigation (Arrow keys, Enter, Tab, Escape), column reordering/resizing, and bulk actions.

### 📥 3. CoStar CSV/Excel Lead Ingestion
- 4-step import wizard (`CoStarImportWizard.tsx`) supporting `.csv` and `.xlsx` files.
- Fuzzy column header matching, dynamic custom field creation, target email/units selection, and previous mapping memory.
- Asynchronous job execution (`import_jobs`) with progress tracking and automatic document checklist seeding.

### ✉️ 4. Gmail Mail Merge & Threading Subsystem
- Scoped OAuth 2.0 Gmail integration with mail merge variable templates (`{{address}}`, `{{unit_count}}`, `{{market}}`).
- Full Gmail-style thread reader (`EmailThreadList.tsx`) and inline reply box (`InlineReplyBox.tsx`).
- Thread snooze management (`snoozed_threads`) and real-time push webhook notifications via Google Cloud Pub/Sub.
- Google People API autocomplete integration for email recipient display names.

### 📁 5. Google Drive & Directory Traversal Workspace
- Automatic deal workspace folder creation with public view permissions.
- Depth-ordered batch folder trees (`batchCreateDriveFolders`) for multi-level folder structures.
- Direct Web Streams HTTP upload engine (`uploadFileToDriveStream`) avoiding server double-buffering.
- Browser directory drag-and-drop traversal (`directory-traversal.ts`) using WebKit FileSystemEntry API.

### 🧮 6. Financial Underwriting & 2-Tier Review Approvals
- Financial metrics: Asking Price, Purchase Price, Total Capex, Cap Rates, Population, Rent Growth 12mo & Forecast %, Vacancy %, Comps.
- Auto-calculated return metrics: Price/Unit, Market Delta %, IRR %, Equity Multiple, Cash-on-Cash %, Projected Profit.
- 2-Tier Approval Workflow: Analyst completion sign-off, Senior Reviewer 1 approval, and Executive Reviewer 2 approval.

### 📜 7. LOI Tracking & Multi-Round Counter-Offers
- Submission tracking, offer date, and mandatory due diligence document verifications (Insurance Declarations, Vendor Contracts, Utility Bills).
- Multi-round negotiation counter-offer table (`loi_rounds`) logging buyer/seller turns, prices, and notes.
- Outcome tracking (`in_progress`, `deal_reached`, `fallen_through`).

### 💼 8. Client Sponsor Portal & Call Queue
- Filtered active deals overview for investors (RLS-protected: non-archived active deals only).
- Sponsor call queue (`/projects/[id]/calls`) displaying published call briefs.
- Interactive **Client Notes** field syncing feedback in real time between clients and acquisition managers.

### 🛡️ 9. Admin Dashboard & System Email
- System administration panel (`/admin`) for user management, role assignments (`admin`, `internal`, `client`), project memberships, and invitation tokens.
- **System Gmail Pairing**: Connects a system-wide Gmail connection (`connection_type='system'`) for branded invitation emails and password reset delivery.

---

## 📁 Repository Structure

```
acquisition-platform/
├── docs/                      # Architectural reference & developer/user guides
│   ├── architecture/          # Overview, Database, UI & Design System specs
│   └── guides/                # Developer getting started, API conventions, User workflows
├── public/                    # Brand assets & public files
├── src/
│   ├── app/
│   │   ├── (auth)/            # Auth routes (login, invite, reset-password)
│   │   ├── (client)/          # Client sponsor portal pages
│   │   ├── (internal)/        # Internal acquisition portal pages
│   │   ├── admin/             # System admin dashboard
│   │   ├── api/               # Next.js API route handlers
│   │   └── projects/          # Global projects hub page
│   ├── components/            # UI components (deals, import, dashboard, shared, etc.)
│   └── lib/                   # Integrations (google, supabase, email, hooks, validations)
├── supabase/
│   ├── migrations/            # Consolidated schema migration (0001_initial_schema.sql)
│   └── seed.sql               # Local development seed data
├── next.config.ts             # Next.js config & CSP headers
├── package.json               # Node.js dependencies & scripts
├── SPEC.md                    # Complete Master System Specification
└── README.md                  # THIS FILE
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **npm**: Included with Node.js
- **Supabase CLI**: Installed locally (`npm i -D supabase`)

### 2. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/sjnakib/acquisition-platform.git
cd acquisition-platform
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local` and populate required keys:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
SUPABASE_PROJECT_ID=[YOUR_PROJECT_REF]

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://[YOUR_UPSTASH_ENDPOINT].upstash.io
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=[YOUR_SITE_KEY]
TURNSTILE_SECRET_KEY=[YOUR_SECRET_KEY]

# Google Cloud OAuth / Gmail / Drive / People API
GOOGLE_CLIENT_ID=[YOUR_GOOGLE_CLIENT_ID]
GOOGLE_CLIENT_SECRET=[YOUR_GOOGLE_CLIENT_SECRET]
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
GOOGLE_CLOUD_PROJECT_ID=[YOUR_GCP_PROJECT_ID]

# App & Encryption
NEXT_PUBLIC_APP_URL=http://localhost:3000
DB_ENCRYPTION_KEY=[YOUR_BASE64_ENCRYPTION_KEY]
```

### 4. Database Setup & Type Generation
Push database migrations to your Supabase instance and generate TypeScript types:

```bash
# Link your remote Supabase project
npx supabase link --project-ref $SUPABASE_PROJECT_ID

# Push database migrations
npm run db:push

# Generate TypeScript database types
npm run db:types
```

### 5. Run Development Server
Start the Next.js Turbopack development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available NPM Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `next dev` | Starts Next.js development server with Turbopack |
| `npm run build` | `next build` | Compiles production web bundle |
| `npm run start` | `next start` | Starts Next.js production server |
| `npm run lint` | `eslint` | Runs ESLint code style check |
| `npm run test` | `vitest run` | Runs Vitest unit and property test suites |
| `npm run db:types` | `supabase gen types typescript ...` | Regenerates `src/lib/supabase/types.ts` |
| `npm run db:push` | `supabase db push` | Pushes migrations to remote Supabase database |
| `npm run db:reset` | `supabase db reset` | Resets local database and runs `seed.sql` |

---

## 📚 Complete Documentation Index

- [**SPEC.md**](./SPEC.md) — Master System Specification & Technical Reference
- [**Docs Directory Overview**](./docs/README.md) — Master documentation index
- [**System Architecture Overview**](./docs/architecture/overview.md) — Routing, proxy pattern, and subsystems
- [**Database & Security Reference**](./docs/architecture/database.md) — Schema, RLS policies, custom functions, and triggers
- [**UI & Design System Specifications**](./docs/architecture/ui.md) — CSS tokens, zero-FOUC theme switching, and data grid hooks
- [**Developer Getting Started Guide**](./docs/guides/developer/getting_started.md) — Setup, env variables, migrations, and CLI tools
- [**API & Security Conventions**](./docs/guides/developer/api_conventions.md) — Handler patterns, CSRF, rate limiting, and Zod schemas
- [**Platform Usage & Workflows Guide**](./docs/guides/user/platform_usage.md) — End-to-end user workflows for Internal Teams and Sponsors
