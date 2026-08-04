# System Architecture Overview

The **Acquire Platform** is a data-dense, highly interactive Next.js 16 application engineered to manage the complete lifecycle of commercial real estate acquisitions. It replaces fragmented spreadsheets, disconnected email chains, and ad-hoc file shares with a single, secure source of truth.

---

## 1. Core Technology Stack

*   **Framework**: Next.js 16.2.6 (App Router with Turbopack) & React 19.2.4
*   **Database & Auth**: Supabase PostgreSQL, `@supabase/ssr` session management, custom JWT role claims (`admin`, `internal`, `client`).
*   **Styling & Design System**: Tailwind CSS v4 (`@tailwindcss/postcss`), vanilla CSS variables (`globals.css`), Radix UI primitives.
*   **Data Fetching & State**: TanStack React Query v5 for server state caching; TanStack React Virtual for data grid virtualization.
*   **Form Management**: React Hook Form with Zod schema validation (`@hookform/resolvers`).
*   **Integrations**:
    *   **Google Workspace**: Gmail API v1 (mail merge outreach, thread tracking, snooze), Google Drive API v3 (streaming file uploads, folder creation, quota), Google People API v1 (contact display name autocomplete).
    *   **Cloudflare Turnstile**: Bot protection on public auth endpoints (`react-turnstile`).
    *   **Upstash Redis**: Sliding window API rate limiting (`@upstash/ratelimit`, `@upstash/redis`).
    *   **Data Parsing**: PapaParse (CSV parsing), ExcelJS (CoStar XLSX export parsing).

---

## 2. Next.js Routing & Layout Architecture

The application strictly organizes its routes into three primary Next.js Route Groups and top-level pages:

```
src/app/
├── (auth)/                    # Public authentication pages (Login, Invite Accept, Password Reset)
├── (internal)/                # Internal acquisition portal (Dashboard, Deals, Campaigns, UW, LOI)
│   └── projects/[id]/         # Project-scoped internal workspace
├── (client)/                  # Client sponsor portal (Active Deals Overview, Call Queue)
│   └── projects/[id]/         # Project-scoped client view
├── admin/                     # Global system administration panel
└── projects/                  # Global Projects Hub & Project Creator
```

1.  **`(auth)`**: Public routes (`/login`, `/invite/[token]`, `/reset-password`, `/reset-password/[token]`). Styled with a glassmorphism theme layout and animated neon electric grid backdrop.
2.  **`(internal)`**: Project-scoped workspace pages (`/projects/[id]/dashboard`, `/projects/[id]/deals`, `/projects/[id]/campaigns`, `/projects/[id]/portfolios`, `/projects/[id]/import`, `/projects/[id]/settings`). Features a collapsible sidebar, project switcher, and complete pipeline management.
3.  **`(client)`**: Client sponsor workspace pages (`/projects/[id]/overview`, `/projects/[id]/calls`). Read-only active deal views and published call brief notes. Internal staff can also access a preview mode via `/projects/[id]/client-view/*`.
4.  **`admin`**: System administration dashboard (`/admin`) for managing all user accounts, project memberships, invitation links, and the System Gmail connection.

---

## 3. Session Hydration & Access Control (`src/proxy.ts`)

Instead of traditional Next.js middleware, the platform uses a **Proxy Pattern** implemented in `src/proxy.ts` (configured via `next.config.ts` headers and Supabase SSR helpers) to enforce session hydration and route protection.

### Access Control Execution Flow:
1.  **Session Refresh**: Calls `updateSession()` from `@supabase/ssr` to keep auth token cookies synchronized.
2.  **Role Extraction**: Extracts the custom user role directly from JWT app metadata (`user.app_metadata.role`), avoiding O(1) database queries on every route navigation.
3.  **Role-Based Redirection**:
    *   Unauthenticated users attempting to access `(internal)`, `(client)`, or `admin` routes are redirected to `/login`.
    *   Authenticated users attempting to access `/login` are redirected to `/projects`.
    *   Clients attempting to access `/admin` or internal-only paths are redirected to their assigned project overview (`/projects/[id]/overview`).

---

## 4. Key Subsystems & Integrations

### A. Multi-Tenant Project Architecture
All platform assets (Deals, Campaigns, Portfolios, Email Templates, Field Definitions, Snoozed Threads, Import Jobs) contain a `project_id` foreign key. Row-Level Security (RLS) ensures that internal users only see assigned projects (`public.project_members`) and clients only see sponsored projects (`public.sponsors`). Admins have global access.

### B. Dynamic EAV Fields Engine
Properties carry diverse data dependent on source exports (CoStar, CREXi, manual entry). Rather than cluttering the database with dozens of sparse columns, the platform uses an **Entity-Attribute-Value (EAV)** design:
*   `public.field_definitions`: Stores field key, label, data type (`text`, `number`, `integer`, `date`, `boolean`, `url`, `currency`), and grid visibility (`show_in_grid`).
*   `public.deal_fields`: Stores key-value pairings for specific deals.
*   System fields (`address`, `unit_count`) are auto-created on project initialization.

### C. CoStar Import Engine
*   Internal managers upload CoStar CSV or Excel files (`.xlsx`).
*   The system extracts headers, executes fuzzy header matching against `field_definitions`, and remembers column mapping presets (`import_jobs.column_mapping`).
*   Processes jobs asynchronously (`pending` -> `mapping` -> `running` -> `done`), bulk-inserting deal rows, generating dynamic fields, creating contacts, and seeding default document checklists.

### D. Google Cloud Workspace Automation
*   **Google Connections**: Supports dual connection modes (`google_connections`):
    1.  *Project Connection* (`connection_type='project'`): Scoped to a specific project for mail merge outreach, Gmail thread tracking, and project Drive folder synchronization.
    2.  *System Connection* (`connection_type='system'`): Global transactional connection for user invitations and password resets.
*   **Gmail & Pub/Sub Webhook**: Subscribes to Gmail push notifications via `gmail.users.watch()` and Google Cloud Pub/Sub. When a contact replies, Google notifies `/api/emails/webhook`, which parses thread deltas and updates `email_outreach`.
*   **Google Drive Engine**: Automatically provisions deal workspace folders (`createDealFolder`), sets public view permissions, creates depth-ordered folder trees (`batchCreateDriveFolders`), and streams file uploads directly from HTTP request bodies to Drive API (`uploadFileToDriveStream`).

### E. Rate Limiting & Bot Defense
*   **Cloudflare Turnstile**: Protects public endpoints (`/login`, `/reset-password`) against automated brute-force attacks.
*   **Upstash Redis**: Enforces sliding window rate limits via `@upstash/ratelimit` on authentication, password reset requests, and outreach email dispatch.
