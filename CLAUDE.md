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

## Architecture (60-second version)

- **Next.js 16.2.6 App Router** — `src/` directory, `@/*` alias
- **Tailwind CSS v4** (`@tailwindcss/postcss`, no `tailwind.config.ts`)
- **`noUncheckedIndexedAccess: true`** — use `!` or `?.` on array/record access
- **`src/proxy.ts`** handles auth routing. NO `src/middleware.ts` — don't create one.
- **API route pattern:** auth check → CSRF origin check (mutations) → Zod validation → Supabase anon-key (RLS)
- **43 API route files** — domains: admin, auth, ca-credentials, calls, campaigns, contacts, deals (incl. import), emails, field-definitions, loi, portfolios, projects (incl. sponsors, duplicate), turnstile, underwriting
- **Supabase client layer (5 files):** `client.ts` (browser), `server.ts` (server/API), `middleware.ts` (proxy helper), `admin.ts` (service role — ONLY Gmail webhook + `/api/admin/*`), `types.ts` (manual placeholder)
- **RLS** is sole access control. `createAdminClient()` bypasses RLS.
- **Components** in `src/components/` by domain: `ui/`, `shared/`, `auth/`, `dashboard/`, `deals/`, `client/`, `import/`, `campaigns/`, `portfolios/`, `projects/`
- **Hooks** in `src/lib/hooks/` (NOT `src/hooks/`). shadcn config aliases `@/hooks` but actual imports use `@/lib/hooks/`.
- **`/projects`** is primary route. `src/app/projects/page.tsx` is shared entry for both roles (outside route groups). Internal → `/projects/[id]/dashboard`; client → `/projects/[id]/overview`. Workspace sub-routes: `dashboard`, `deals`, `campaigns`, `portfolios`, `import`, `settings`, `client-view`, `profile`.
- **Multi-project:** All core data project-scoped via `project_id` FK + RLS policies (migrations 0019-0026). `ProjectProvider` + `useProjectContext` (from `src/components/shared/ProjectContext.tsx`) wraps project pages. Every data query/API call must be scoped to current project. `projects` and `sponsors` tables added in 0019-0020; API routes at `/api/projects/*`.
- **Shared components:** `DataGrid` (virtualized Excel-like table), `ProjectContext` (project state provider — wraps children with current project), `Sidebar`, `Breadcrumb`, `PageHeader`, `InlineDropdownEditor` (inline select for DataGrid enum columns), `PaginationControls`, `LoadingSpinner`, `EmptyState`, `BrandLogo`.

## Key design rules

- **Theme:** CSS var tokens only (`var(--color-*)`). No raw hex, no Tailwind palette colors, no `prefers-color-scheme`. Do NOT use `next-themes` despite package.json — inline `<script>` + `localStorage` key `acq_theme`. Full spec: `docs/architecture/ui.md`.
- **Deal stages:** `src/lib/stage-machine.ts` — `canTransition()` is source of truth. `failed` only valid after `loi`; `archived` not allowed at/past `loi`/`closed`/`failed`. Used by 4 API routes.
- **Deals API:** response includes `deal_fields` with nested `field_definitions` join. New code touching deals must include this join for property data.
- **DataGrid** renders ALL `field_definitions` columns (not just `show_in_grid`). Inline editing via F2 (text) or `InlineDropdownEditor` (enum/dropdown columns like stage/score).
- **ReactQueryProvider** — default export, module-level `new QueryClient()` (NOT wrapped in `useState`).
- **Brand:** `src/lib/brand.ts`. **Page headings:** `src/lib/page-headings.ts`.

## Critical gotchas

- **Next.js 16** has breaking changes from training data. Read `node_modules/next/dist/docs/` before writing code.
- **`reactStrictMode: true`** — effects fire twice in dev. Don't duplicate cleanup/subscriptions.
- `supabase migration up` doesn't exist — use `supabase db push`.
- `supabase gen types` uses `--project-ref` not `--project-id`; output is broken — `src/lib/supabase/types.ts` is a manual placeholder.
- `vercel.json` missing (needed for Gmail watch cron).
- Upstash Redis required locally for rate limiting.
- Vitest configured (`vitest.config.ts`, node env, globals) but no test files written yet.
- `next.config.ts` `experimental.serverActions.allowedOrigins` depends on `NEXT_PUBLIC_APP_URL` — must be set in production.
- CSP headers in `next.config.ts` — adding external APIs/scripts/iframes requires updating CSP.

## Key reference docs

| Doc | Content |
|---|---|
| `PLAN.md` | Original build blueprint — schema details, Supabase API patterns. Some details diverged in implementation; verify against actual migrations (26 exist, PLAN.md describes 17). |
| `docs/architecture/ui.md` | Full design system: color tokens, dimensions, theme rules |
| `EXCEL_TABLE.md` | DataGrid/DealTable spec: keyboard nav, cell editing, clipboard, virtualization |
| `docs/architecture/overview.md` | System overview |
| `docs/architecture/database.md` | Database design, RLS, schema |
| `docs/guides/` | Various dev guides, API conventions |
| `supabase/seed.sql` | Seed data for local DB reset |

## Known tech debt

- Settings: campaign management is placeholder
- `DataGrid.tsx` has a few inline `var(--color-*, #fallback)` fallback hex values — acceptable CSS pattern, not urgent but prefer central token definitions over scattered fallbacks
