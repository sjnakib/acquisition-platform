# This is NOT the Next.js you know

Next.js 16.2.6 — APIs, conventions, and file structure differ from training data. Heed deprecation notices.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at localhost:3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm run test` | Vitest (node env, globals on) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test -- -t "name"` | Run single test matching "name" |
| `npx tsc --noEmit` | Type check (no script in package.json) |
| `npm run db:push` | Push migrations to linked Supabase |
| `npm run db:push:local` | Push to local Supabase |
| `npm run db:reset` | Reset + re-seed local DB (runs `supabase/seed.sql`) |
| `npm run db:types` | Generate TS types from Supabase schema |

**Gotcha:** `supabase migration up` does NOT exist (CLI v2). Use `supabase db push`.
**Gotcha:** `supabase gen types` uses `--project-ref` (NOT `--project-id`). Output redirection is broken — `src/lib/supabase/types.ts` is a manual placeholder with real enums but `Record<string, unknown>` for table rows. No Supabase client file passes the `Database` type param.
**Gotcha:** No test files exist yet. Vitest is configured but suite is empty.
**Gotcha:** `vercel.json` missing (needed for Gmail watch cron).

## Auth & Routing

- **No `src/middleware.ts`.** `src/proxy.ts` handles session + role routing (Next.js 16 proxy pattern). API routes excluded from matcher.
- **Route groups:** `(auth)` — login/signup/logout/reset-password, `(internal)` — team views + `/client-view`, `(client)` — CEO/client views.
- **Proxy gates:** unauthenticated → `/login`; authenticated on auth pages → role home (`/dashboard` or `/overview`); wrong role → redirect to correct home. Layout guards in `(internal)/layout.tsx` and `(client)/layout.tsx` reinforce this.
- **`app/page.tsx`** just `redirect('/login')`.
- **Seed users:** `test-internal@example.com` / `Password123!` (internal), `test-client@example.com` / `Password123!` (client).

## API Routes (37 route files in `src/app/api/`)

Pattern: auth check → CSRF origin check (mutations only) → Zod validation → Supabase anon-key client (RLS scopes data).

Domains: admin, auth, ca-credentials, calls, campaigns, contacts, deals (incl. import), emails, field-definitions, loi, portfolios, turnstile, underwriting.

- **`createAdminClient()`** (service role) ONLY used in Gmail webhook and `/api/admin/*` routes.
- **`get_my_role()`** SQL function (migration 0015) used for role checks in API routes.

## Database

- **18 migrations** in `supabase/migrations/` (0001–0018, all applied). 0016 is the v2 schema transform (11-stage → 8-stage enum, fixed columns → dynamic `deal_fields`). 0018 is `increase_max_rows`.
- **RLS is sole access control.** Internal sees all; client sees only good/very_good non-archived deals + published call briefs.
- **Enums (8-stage):** `deal_stage` = `lead | outreach | response | underwriting | loi | closed | failed | archived`. `failed` is only valid after `loi`; before LOI use `archived`. See `src/lib/supabase/types.ts` for all 14 enums.
- **Flexible schema:** `deals` table holds only system fields (outreach_emails, unit_count, stage, score). All property data (address, zip, CoStar link, etc.) stored in `deal_fields` as key/value rows catalogued by `field_definitions`.
- **Key tables:** users (Supabase Auth), contacts, deals, deal_fields, field_definitions, call_briefs, campaigns, import_jobs, google_tokens, profile, ca_credentials, loi_tracker, portfolios.
- Deals API response includes `deal_fields` with nested `field_definitions` join. New code touching deals should include this join for property data.

## Architecture

- **Supabase layer:** `src/lib/supabase/` — `client.ts` (browser), `server.ts` (server/API), `middleware.ts` (session refresh), `admin.ts` (service role), `types.ts` (manual placeholder).
- **Hooks:** `src/lib/hooks/` (7 files): `useAuth`, `useCampaigns`, `useCallQueue`, `useColumnWidths`, `useDeals`, `useGridInteraction`, `usePortfolios`. `components.json` aliases `hooks` to `@/hooks` but actual imports use `@/lib/hooks/`. Only `useGridInteraction`, `useColumnWidths`, and `usePortfolios` are currently imported — the other 4 are skeleton/placeholder.
- **`src/lib/stage-machine.ts`** — source of truth for deal stage transitions. `canTransition()` enforces: `failed` only after `loi`; `archived` not allowed at/past `loi`/`closed`/`failed`. Used by 4 API routes.
- **`ReactQueryProvider`** — default export, module-level `new QueryClient()` (NOT wrapped in `useState`).
- **`noUncheckedIndexedAccess: true`** — access arrays/records with `!` or `?.`.
- **`next.config.ts`** `experimental.serverActions.allowedOrigins` depends on `NEXT_PUBLIC_APP_URL` — must be set in production.
- **Component structure:** `src/components/` by domain — `ui/` (shadcn primitives), `shared/`, `auth/`, `dashboard/`, `deals/`, `client/`, `import/`. Before building, check if component already exists but is disconnected from pages.

## Key Libraries

- `@tanstack/react-query@^5` — data fetching; `@tanstack/react-virtual` — DataGrid virtualization
- `react-hook-form` + `zod` + `@hookform/resolvers` — forms; schemas in `src/lib/validations/`
- `exceljs` for CoStar import (NOT `xlsx`); `papaparse` for CSV parsing
- `googleapis` + `google-auth-library` for Gmail/Drive; `@react-email` for email templates
- `@upstash/ratelimit` + `@upstash/redis` for rate limiting
- `react-turnstile` for Cloudflare Turnstile CAPTCHA
- `immer` for immutable state (DataGrid); `sonner` for toasts; `lucide-react` for icons
- `date-fns` for dates; `use-debounce` for debounced inputs; `fast-check` for property-based testing (dev)

## Theme & Design System

- **Tailwind CSS v4** with `@tailwindcss/postcss` — no `tailwind.config.ts`. `tw-animate-css` plugin.
- **CSS variables:** All components must use `var(--color-*)` tokens. Raw hex, Tailwind palette colors, `prefers-color-scheme` prohibited.
- **Do NOT use `next-themes`** — root layout violates UI spec (mandates inline `<script>` + `localStorage` key `acq_theme`). Do NOT add more `next-themes` usage.
- Light default, opt-in dark via `.dark` class. Sidebar always-dark (`#0E0E0E`), no theming.
- **`src/lib/brand.ts`** — brand config (name: 'Acquire'). **`src/lib/page-headings.ts`** — centralized page heading titles/descriptions.
- Full spec: `docs/architecture/ui.md`.

## CSP Headers (`next.config.ts`)

Adding external APIs, scripts, or iframes requires updating CSP. Current:
- script-src: `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https://challenges.cloudflare.com`
- connect-src: `'self'`, `https://*.supabase.co`, `https://www.googleapis.com`, `https://accounts.google.com`
- frame-src: `https://challenges.cloudflare.com`
- img-src: `'self'`, `data:`, `https://lh3.googleusercontent.com`

## Env Vars (`.env.example` — 5 groups)

Supabase (URL, anon key, service role, project ID), Turnstile (site + secret), Google OAuth (client ID/secret, redirect URI, cloud project ID), App (app URL, DB encryption key), Upstash Redis (REST URL + token).

## Key Reference Docs (read before building)

- **`PLAN.md`** — Sequential build plan, phase-gated, schema details, API patterns. Supersedes all prior plans.
- **`docs/architecture/ui.md`** — Design system spec: color tokens, dimensions, theme rules, remediation debt.
- **`EXCEL_TABLE.md`** — DataGrid/DealTable: keyboard nav, cell editing, clipboard, virtualization (~728 lines).
- **`docs/architecture/`** — overview, database schema. **`docs/guides/developer/`** — API conventions. **`docs/guides/user/`** — platform usage.

## Implementation Status (Known Gaps)

- Dashboard: **wired up** — `FunnelMetrics`, `KPIScorecard`, `PipelineTable`, `ConversionChart` all used. Data aggregated client-side from `/api/deals`.
- Deal detail (`/deals/[id]`): 7 tabs show placeholder JSON — none wire to `DealStageBar`, `UnderwritingForm`, `LOITracker`, `DocumentChecklist`, etc.
- Settings: Gmail connect works; campaign management is placeholder.
- Import wizard: **fully wired** — upload → preview → confirm → poll status (3-step flow with `CoStarImportWizard`).
- Client calls page: missing `client_notes` textarea.
- `UnderwritingForm.tsx`, `DealCard.tsx`, `ClientDealCard.tsx`, `LOITracker.tsx`, `EmailThread.tsx`, `DocumentChecklist.tsx`: hardcoded Tailwind palette colors — need `var(--color-*)` remediation.
- `deals/[id]/page.tsx`: deal detail tabs all show placeholder JSON — not wired to any tab components. Also uses hardcoded Tailwind classes.
- Root `layout.tsx` uses `next-themes` `ThemeProvider` — violates UI spec.
- `DataGrid.tsx` (~47KB) + `useGridInteraction` (~39KB): Excel-like virtualized table with dynamic columns, multi-cell selection, F2 editing, copy/paste. Renders ALL `field_definitions` columns (not just `show_in_grid`).
