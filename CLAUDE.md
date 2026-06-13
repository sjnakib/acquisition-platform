# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md — full architecture docs. Read that first for anything beyond what's here.

## Quick start

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest (node env, globals on, @ alias configured)
npm run test:watch   # Vitest watch mode
npm run test -- -t "name"  # run single test matching "name"
npx tsc --noEmit      # type check (no typecheck script in package.json)
npm run db:types     # regenerate Supabase types (--project-ref, not --project-id)
npm run db:push      # push migrations to linked Supabase project
npm run db:push:local
npm run db:reset     # reset + re-seed local DB
```

**Seed users** (after `db:reset`):
- `test-internal@example.com` / `Password123!` (internal role)
- `test-client@example.com` / `Password123!` (client role)
- `test-client2@example.com` / `Password123!` (client role)
- No seeded admin — promote an internal user via SQL: `UPDATE public.profiles SET role = 'admin' WHERE id = '<user-id>';` then update `auth.users.app_metadata.role` to `'admin'`.

## Architecture (60-second version)

- **Next.js 16.2.6 App Router** — `src/` directory, `@/*` alias
- **Tailwind CSS v4** (`@tailwindcss/postcss`, no `tailwind.config.ts`)
- **`noUncheckedIndexedAccess: true`** — use `!` or `?.` on array/record access
- **`src/proxy.ts`** handles auth routing. Reads role from JWT `app_metadata` (no DB round-trip). Legacy routes (`/dashboard`, `/deals`, `/overview`, etc.) redirect → `/projects`. `/invite` routes treated as public auth pages. Matcher explicitly excludes `api` routes — each API route does its own auth. NO `src/middleware.ts` — don't create one.
- **API route pattern:** auth check → CSRF origin check (mutations) → Zod validation → Supabase anon-key (RLS)
- **17 API route domains, 67 route files** — admin, attachments, auth, ca-credentials, calls, campaigns, contacts, deals (incl. import, batch), emails, field-definitions, invitations, loi, portfolios, projects (incl. sponsors, duplicate), templates, turnstile, underwriting
- **Three user roles:** `admin | internal | client`. Admin = super-admin: sees all projects, manages users via `/admin` panel, can create/delete accounts. Internal = team member scoped to assigned projects via `project_members` table (migration 0045). Client = sponsor scoped to projects via `sponsors` table.
- **RLS helper `is_staff()`** returns true for admin OR internal. All internal-only policies use this instead of `get_my_role() = 'internal'` (migration 0045). `createAdminClient()` (service role) bypasses RLS — ONLY for Gmail webhook + `/api/admin/*`.
- **Supabase client layer (5 files):** `client.ts` (browser), `server.ts` (server/API), `middleware.ts` (proxy helper), `admin.ts` (service role), `types.ts` (manual placeholder)
- **Data fetching: TanStack Query** (`@tanstack/react-query` v5). All hooks use `useQuery`/`useMutation` with `queryClient.invalidateQueries()` for cache invalidation. Query keys follow `['resource', id]` pattern. Mutations invalidate related queries (e.g. creating a portfolio invalidates both `['portfolios']` and `['deals']` since portfolios create linked deals). `ReactQueryProvider` is default-exported with module-level `new QueryClient()` (NOT wrapped in `useState`).
- **Components** in `src/components/` by domain: `ui/`, `shared/`, `auth/`, `dashboard/`, `deals/`, `client/`, `import/`, `campaigns/`, `portfolios/`, `projects/`
- **Hooks** in `src/lib/hooks/` (NOT `src/hooks/`). shadcn config aliases `@/hooks` but actual imports use `@/lib/hooks/`. Files: `useAuth`, `useCallQueue`, `useCampaigns`, `useColumnOrder`, `useColumnWidths`, `useDeal`, `useDeals`, `useGridInteraction`, `usePortfolios`, `useSidebarCollapsed`.
- **Other lib files:** `batch-delete.ts`, `directory-traversal.ts`, `navigation.ts` (sidebar nav item definitions), `stage-machine.ts`, `rate-limit.ts`, `brand.ts`, `page-headings.ts`, `turnstile.ts`, `utils.ts`.
- **`src/lib/validations/`** — 11 Zod schemas: `auth`, `call`, `campaign`, `contact`, `deal`, `import`, `invitation`, `password-reset`, `portfolio`, `project`, `template`. API routes import from here for request body validation.
- **`src/lib/import/`** — `file-parser.ts` (ExcelJS CoStar .xlsx parsing), `mapping.ts` (field mapping logic).
- **`/projects`** is primary route. `src/app/projects/page.tsx` is shared entry for both roles (outside route groups). Internal → `/projects/[id]/dashboard`; client → `/projects/[id]/overview`. Workspace sub-routes: `dashboard`, `deals`, `campaigns`, `portfolios`, `import`, `settings`, `client-view`. Profile at `(internal)/profile` (standalone, not under projects).
- **Multi-project:** All core data project-scoped via `project_id` FK + RLS policies (migrations 0019-0041). `ProjectProvider` + `useProjectContext` (from `src/components/shared/ProjectContext.tsx`) wraps project pages. Every data query/API call must be scoped to current project. `projects` and `sponsors` tables added in 0019-0020; `google_connections` (per-Google-email, multi-project Gmail) in 0030. API routes at `/api/projects/*`.
- **Portfolios as deals** (migration 0043): Portfolios link to a deal record via `portfolio_deal_id` FK. The linked deal has `is_portfolio = true` and carries all deal behaviors (stage, emails, underwriting, LOI, calls, drive folders). Portfolio creation auto-creates the linked deal. Portfolio deletion offers `orphan` (keep deal, unlink) or `archive` (archive the linked deal too). Portfolio pages have `by-deal/` sub-routes that show portfolio-scoped deal views.
- **Admin panel** at `/admin` (migration 0045): Admin-only route with user management. Create users via email invite, change roles inline, delete accounts. Invitation system (migration 0050) — branded email invites with token, role, project assignments, expiry. `project_members` table scopes internal users to specific projects (admins see all). Admin sidebar item appears in global nav when role is `admin`. Admin API routes (`/api/admin/*`) require `requireAdmin()` guard.
- **Google integration:** `src/lib/google/gmail.ts`, `drive.ts`, `oauth.ts`, `people.ts` — Gmail API (push notifications via `gmail.users.watch()`, Pub/Sub webhook at `/api/emails/webhook`, snoozed threads via migration 0035), Drive API (linked deal rooms — folder provisioning per deal via `drive_folders` table, migration 0041; `DriveFileManager` component for browsing/uploading), People API (contact lookups), OAuth (offline refresh tokens stored in `google_connections` keyed by Google email, not user). Multi-project: each project can connect to any Google account via `google_connection_id` FK; OAuth state encodes `projectId` for per-project connect flow. System Gmail (migration 0051): `google_connections.connection_type` distinguishes `project` vs `system` connections for transactional emails (invitations). API routes: `auth/google/callback`, `auth/google/refresh-watch`, `projects/[id]/google/disconnect`, `deals/[id]/drive/files`. Email templates: `email_templates` table (migration 0032) — project-scoped custom templates for outreach emails; `custom` enum value added in 0033. Email attachments stored via migration 0037. `src/lib/email/send.ts` handles sending via React Email + Resend; templates in `src/lib/email/templates/` (declination, invitation, outreach, password-reset, thank-you).
- **CoStar import pipeline:** ExcelJS parses `.xlsx` in-memory → cross-references `property_id` against DB to prevent duplicates → background polling tracks progress (bypasses Vercel 60s timeout).
- **Shared components:** `DataGrid` (virtualized Excel-like table), `ProjectContext` (project state provider — wraps children with current project), `Sidebar`, `Breadcrumb`, `PageHeader`, `InlineDropdownEditor` (inline select for DataGrid enum columns: stage, score, portfolio, response classification), `EmailComposer` (shared email composition, used by both internal and client), `PaginationControls`, `LoadingSpinner`, `EmptyState`, `BrandLogo`. `DealDetailView` for consistent deal detail rendering; `CampaignCard` for campaign list items.

## Key design rules

- **Theme:** CSS var tokens only (`var(--color-*)`). No raw hex, no Tailwind palette colors, no `prefers-color-scheme`. Do NOT use `next-themes` despite package.json — inline `<script>` + `localStorage` key `acq_theme` reads theme before paint. `<html>` has `suppressHydrationWarning` because of this. Full spec: `docs/architecture/ui.md`.
- **Address is the required deal field** (not `deal_name`). Migration 0034 migrated all `deal_name` keys → `address`. Import pipeline, deal creation, and validation all require `address`. Deal cards/displays use address as the primary identifier.
- **Deal stages:** `src/lib/stage-machine.ts` — `canTransition()` is source of truth. `failed` only valid after `loi`; `archived` not allowed at/past `loi`/`closed`/`failed`. Used by 4 API routes.
- **Deals API:** response includes `deal_fields` with nested `field_definitions` join. New code touching deals must include this join for property data.
- **DataGrid** renders ALL `field_definitions` columns (not just `show_in_grid`). Inline editing via F2 (text) or `InlineDropdownEditor` (enum/dropdown columns like stage/score).
- **Follow-up calling:** `call_briefs` table has `contact_name`, `contact_role`, `phone_number` (migration 0027). Calls API at `/api/calls` — GET filters by `project_id`/`deal_id`, POST creates call brief. Client call queue at `(client)/projects/[id]/calls` (published + pending only). `useCallQueue` hook queries published pending briefs.
- **System-assisted deal flow:** Dashboard guides new projects through import → campaign → pipeline. Empty states for each step surface next action.
- **Drive-linked deal rooms:** Each deal can link a Google Drive folder (`drive_folders` table, migration 0041). `DriveFileManager` component provides file browsing, upload, and breadcrumb navigation within the deal detail view. API: `/api/deals/[id]/drive/files`.
- **Dashboard analytics:** `KPIScorecard`, `ConversionChart`, `FunnelMetrics`, `PipelineTable`, plus newer `CallStatistics`, `PipelineAnalytics`, `TopOpportunities` (per-project pipeline analytics).
- **Password reset (migrations 0052-0054):** Self-service reset via branded email links. `password_resets` table stores token+email+expiry (RLS bypassed via service role). `find_user_by_email(p_email)` function for direct `auth.users` lookup (replaces fragile client-side `listUsers()` pattern). `get_user_emails(p_user_ids)` for batched email lookup. Reset emails sent via system Gmail connection. API routes at `/api/auth/reset-password` (request) and `/api/auth/reset-password/[token]` (confirm). `/reset-password/:token` page has `Referrer-Policy: no-referrer` to prevent token leakage.
- **Realtime:** Enabled via migration 0036 for live updates.
- **Brand:** `src/lib/brand.ts` (`BRAND.name = 'Acquire'`, `BRAND.tagline = 'Acquisition Platform'`). **Page headings:** `src/lib/page-headings.ts`.

## Critical gotchas

- **Next.js 16** has breaking changes from training data. Read `node_modules/next/dist/docs/` before writing code.
- **`reactStrictMode: true`** — effects fire twice in dev. Don't duplicate cleanup/subscriptions.
- `supabase migration up` doesn't exist — use `supabase db push`.
- `supabase gen types` uses `--project-ref` not `--project-id`; output is broken — `src/lib/supabase/types.ts` is a manual placeholder.
- `vercel.json` missing (needed for Gmail watch cron).
- Upstash Redis required locally for rate limiting.
- Vitest configured (`vitest.config.ts`, node env, globals) but no test files written yet.
- `next.config.ts` `experimental.serverActions.allowedOrigins` depends on `NEXT_PUBLIC_APP_URL` — must be set in production.
- CSP headers in `next.config.ts` — adding external APIs/scripts/iframes requires updating CSP. Also sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`. Per-route override: `/reset-password/:token` sets `Referrer-Policy: no-referrer` to prevent token leakage via Referer header.
  - script-src: `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https://challenges.cloudflare.com`, `https://apis.google.com`, `https://*.googleapis.com`
  - connect-src: `'self'`, `https://*.supabase.co`, `https://www.googleapis.com`, `https://accounts.google.com`, `https://*.googleapis.com`
  - frame-src: `https://challenges.cloudflare.com`, `https://docs.google.com`, `https://accounts.google.com`
  - img-src: `'self'`, `data:`, `https://lh3.googleusercontent.com`, `https://*.googleapis.com`
  - style-src: `'self'`, `'unsafe-inline'`, `https://*.googleapis.com`

## Key reference docs

| Doc | Content |
|---|---|
| `PLAN.md` | Original build blueprint — schema details, Supabase API patterns. Some details diverged in implementation; verify against actual migrations (54 exist, PLAN.md describes 17). |
| `docs/architecture/ui.md` | Full design system: color tokens, dimensions, theme rules |
| `EXCEL_TABLE.md` | DataGrid/DealTable spec: keyboard nav, cell editing, clipboard, virtualization |
| `docs/architecture/overview.md` | System overview |
| `docs/architecture/database.md` | Database design, RLS, schema |
| `docs/guides/` | Various dev guides, API conventions |
| `supabase/seed.sql` | Seed data for local DB reset |

## Known tech debt

- Settings: campaign management is placeholder
- `DataGrid.tsx` has a few inline `var(--color-*, #fallback)` fallback hex values — acceptable CSS pattern, not urgent but prefer central token definitions over scattered fallbacks
- `src/lib/email/send.ts` uses Resend + React Email for transactional emails (invitations); ensure Resend API key is in env vars for production
