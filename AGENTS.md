# This is NOT the Next.js you know

Next.js 16.2.6 — APIs, conventions, and file structure differ from training data. Heed deprecation notices.

Commands + gotchas: see CLAUDE.md quick-start section.

## Auth & Routing

- **No `src/middleware.ts`.** `src/proxy.ts` handles session + role routing (Next.js 16 proxy pattern). API routes excluded from matcher.
- **Route groups:** `(auth)` — login/signup/logout/reset-password, `(internal)` — team views, `(client)` — CEO/client views.
- **`/projects`** is the primary route (project list + `[id]` workspace). `src/app/projects/page.tsx` is outside route groups — shared entry for both roles. Internal → `/projects/[id]/dashboard`; client → `/projects/[id]/overview`. Workspace sub-routes: `dashboard`, `deals`, `campaigns`, `portfolios`, `import`, `settings`, `client-view`. `/projects/[id]/profile` for user profile. Legacy routes redirect → `/projects`.
- **Proxy gates:** unauthenticated → `/login`; authenticated on auth pages → `/projects`; wrong role → redirect. Layout guards reinforce this.
- **Seed users:** `test-internal@example.com` / `Password123!` (internal), `test-client@example.com` / `Password123!` (client).

## API Routes (52 route files in `src/app/api/`)

Pattern: auth check → CSRF origin check (mutations only) → Zod validation → Supabase anon-key client (RLS scopes data).

Domains: admin, attachments, auth, ca-credentials, calls, campaigns, contacts, deals (incl. import), emails, field-definitions, loi, portfolios, projects (incl. sponsors, duplicate), templates, turnstile, underwriting.

- `createAdminClient()` (service role) ONLY in Gmail webhook + `/api/admin/*` routes.
- `get_my_role()` SQL function (migration 0015) used for role checks.

## Database

- **32 migrations** (`supabase/migrations/0001–0032`, all applied). 0016 = v2 schema transform (11-stage → 8-stage enum, fixed columns → dynamic `deal_fields`). 0019–0022 = projects/sponsors + project-scoped RLS. 0023–0026 = backfill `project_id`, column rationalization, surface imported fields. 0027–0029 = follow-up call fields, deal detail enhancements, project access. 0030 = multi-project Gmail (`google_connections` table, projects FK). 0031 = email body template fields. 0032 = custom templates (`email_templates` table, project-scoped).
- **RLS is sole access control.** Internal sees all; client sees only good/very_good non-archived deals + published call briefs.
- **8-stage `deal_stage`:** `lead | outreach | response | underwriting | loi | closed | failed | archived`. `failed` only valid after `loi`; before LOI use `archived`.
- **Flexible schema:** `deals` table stores only system fields (outreach_emails, unit_count, stage, score). Property data in `deal_fields` as key/value rows catalogued by `field_definitions`. Deals API response includes `deal_fields` with nested `field_definitions` join — new code touching deals must include this join.
- **Key tables:** users, contacts, deals, deal_fields, field_definitions, call_briefs, campaigns, import_jobs, google_connections, profile, ca_credentials, loi_tracker, portfolios, projects, sponsors.

## Architecture

- **Dashboard** guides new projects through system-assisted deal flow: import properties → create campaign → view pipeline. Empty states for each step surface the next action.
- **Multi-project:** All core data scoped to `project_id` FK + RLS (migrations 0019–0030). `ProjectProvider` (`src/components/shared/ProjectContext.tsx`) wraps project pages via `useProjectContext`. Every query/API call must be project-scoped. Google connections are project-scoped via `google_connection_id` FK on `projects` (0030).
- **Supabase layer (5 files):** `client.ts` (browser), `server.ts` (server/API), `middleware.ts` (proxy helper), `admin.ts` (service role — limited use), `types.ts` (manual placeholder).
- **Hooks** in `src/lib/hooks/` (NOT `src/hooks/`): `useAuth`, `useCallQueue`, `useCampaigns`, `useColumnOrder`, `useColumnWidths`, `useDeals`, `useGridInteraction`, `usePortfolios`. Batch-delete logic in `src/lib/batch-delete.ts`.
- **`src/lib/stage-machine.ts`** — `canTransition()` is source of truth for deal stages. Used by 4 API routes.
- **`ReactQueryProvider`** — default export, module-level `new QueryClient()` (NOT wrapped in `useState`).
- **`noUncheckedIndexedAccess: true`** — access arrays/records with `!` or `?.`.
- **`next.config.ts`** `experimental.serverActions.allowedOrigins` depends on `NEXT_PUBLIC_APP_URL` — must be set in production.
- **shadcn alias gotcha:** `components.json` maps `"hooks": "@/hooks"`, but no imports use it — all hooks are at `@/lib/hooks/`. Use `@/lib/hooks/` for hook imports.
- **Key shared components:** `DataGrid` (~47KB virtualized Excel-like table, **renders ALL `field_definitions` columns** not just `show_in_grid`), `useGridInteraction` (~39KB), `ProjectContext`, `Sidebar`, `InlineDropdownEditor` (inline select for DataGrid enum columns: stage, score, portfolio, response classification), `PaginationControls`, `EmptyState`, `BrandLogo`. Components in `src/components/` by domain: `ui/`, `shared/`, `auth/`, `dashboard/`, `deals/`, `client/`, `import/`, `campaigns/`, `portfolios/`, `projects/`.

## Theme & Design System (strict — read `docs/architecture/ui.md`)

- **Tailwind CSS v4** with `@tailwindcss/postcss` — no `tailwind.config.ts`. `tw-animate-css` plugin. Theme tokens via `@theme inline` in `globals.css`.
- **CSS variables only** (`var(--color-*)`). No raw hex, no Tailwind palette colors, no `prefers-color-scheme`.
- **Do NOT use `next-themes`** — root layout uses inline `<script>` + `localStorage` key `acq_theme`. Light default, opt-in dark via `.dark` class. Sidebar always-dark (`#0E0E0E`), no theming.
- **Brand:** `src/lib/brand.ts` (name: 'Acquire'). **Page headings:** `src/lib/page-headings.ts`.

## Key Libraries (unusual picks)

`exceljs` (CoStar import, NOT `xlsx`), `papaparse` (CSV), `immer` (DataGrid state), `@dnd-kit` (drag/drop), `sonner` (toasts), `lucide-react` (icons), `date-fns` (dates), `use-debounce`, `googleapis` + `google-auth-library`, `@upstash/ratelimit` + `@upstash/redis`, `react-turnstile`, `fast-check` (dev, property-based testing).

## CSP Headers (`next.config.ts`)

Adding external APIs/scripts/iframes requires updating CSP:
- script-src: `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https://challenges.cloudflare.com`
- connect-src: `'self'`, `https://*.supabase.co`, `https://www.googleapis.com`, `https://accounts.google.com`
- frame-src: `https://challenges.cloudflare.com`
- img-src: `'self'`, `data:`, `https://lh3.googleusercontent.com`

## Env Vars (`.env.example` — 5 groups)

Supabase (URL, anon key, service role, project ID), Turnstile (site + secret), Google OAuth (client ID/secret, redirect URI, cloud project ID), App (app URL, DB encryption key), Upstash Redis (REST URL + token).

## Key Reference Docs (read before building)

- **`PLAN.md`** — Build blueprint, schema details, Supabase API patterns. Some divergence from implementation; verify against actual migrations.
- **`docs/architecture/ui.md`** — Full design system: color tokens, dimensions, theme rules.
- **`EXCEL_TABLE.md`** — DataGrid spec: keyboard nav, cell editing, clipboard, virtualization (~502 lines).
- **`docs/architecture/database.md`** — DB design, RLS, schema details.
- **`docs/architecture/`** — overview, database schema. **`docs/guides/developer/`** — API conventions, getting started.

## Known Gaps

- Settings: campaign management is placeholder.
- `DataGrid.tsx` has scattered `var(--color-*, #fallback)` fallback hex values — acceptable pattern but prefer central token definitions.
