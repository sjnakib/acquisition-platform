# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md — full architecture docs. Read that first for anything beyond what's here.

## Quick start

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest (node env, globals on)
npm run test:watch   # Vitest watch mode
npm run db:types     # regenerate Supabase types (--project-ref, not --project-id)
npm run db:push      # push migrations to linked Supabase project
npm run db:push:local
npm run db:reset     # reset + re-seed local DB
```

## Architecture (60-second version)

- **Next.js 16.2.6 App Router** — `src/` directory, `@/*` alias
- **Tailwind CSS v4** (`@tailwindcss/postcss`, no `tailwind.config.ts`)
- **`noUncheckedIndexedAccess: true`** — use `!` or `?.` on array/record access
- **`src/proxy.ts`** handles auth routing. NO `src/middleware.ts` — don't create one.

### Auth & routing

Three route groups: `(auth)`, `(internal)`, `(client)`. Proxy gates:
- Unauthenticated → `/login`
- Authenticated on auth pages → role home (`/dashboard` or `/overview`)
- Wrong role → redirect to correct home
- Layout guards in `(internal)/layout.tsx` and `(client)/layout.tsx` reinforce this

Seed users: `test-internal@example.com` / `test-client@example.com` both with `Password123!`.

### Supabase client layer (4 files, no `Database` type param)

| File | Use |
|---|---|
| `src/lib/supabase/client.ts` | Browser (hooks, client components) |
| `src/lib/supabase/server.ts` | Server components, API routes |
| `src/lib/supabase/middleware.ts` | Session refresh helper, used by `proxy.ts` |
| `src/lib/supabase/admin.ts` | Service role — ONLY in Gmail webhook + `/api/admin/*` |

RLS is sole access control for user-facing queries. `createAdminClient()` bypasses RLS.

### API route pattern (37 route files in `src/app/api/`)

```
auth check → CSRF origin check (mutations) → Zod validation → Supabase (anon-key, RLS)
```

API routes by domain: admin, auth, ca-credentials, calls, campaigns, contacts, deals, emails, field-definitions, loi, portfolios, turnstile, underwriting.

### Key libraries

- `@tanstack/react-query@^5` — `ReactQueryProvider` is default export with module-level `new QueryClient()` (NOT wrapped in `useState`)
- `react-hook-form` + `zod` + `@hookform/resolvers` — forms; validation schemas in `src/lib/validations/`
- `exceljs` for CoStar import (NOT `xlsx`)
- `papaparse` for CSV parsing in import flow
- `googleapis` + `google-auth-library` for Gmail/Drive
- `@upstash/ratelimit` + `@upstash/redis` for rate limiting
- `react-turnstile` for Cloudflare Turnstile CAPTCHA
- `immer` for immutable state updates (DataGrid)
- `@tanstack/react-virtual` for DataGrid virtualization
- `date-fns` for date formatting
- `sonner` for toast notifications
- `lucide-react` for icons
- `@react-email/components` + `@react-email/render` for email templates
- `use-debounce` for debounced inputs/hooks
- `fast-check` for property-based testing (devDependency)

### CSP headers

Defined in `next.config.ts`. Adding external APIs/scripts/iframes → update CSP there.

### Theme & design system

- **CSS variable system** — components use `var(--color-*)` tokens (see `docs/architecture/ui.md`). No raw hex, no Tailwind palette colors (`bg-slate-*`, `text-blue-*`), no `prefers-color-scheme`.
- Light mode default, opt-in dark via `.dark` class on `<html>`.
- **Do NOT use `next-themes`** despite it being in `package.json` and root layout importing it — the `docs/architecture/ui.md` spec takes precedence (inline `<script>` + `localStorage` key `acq_theme`).
- Sidebar is always-dark (`#0E0E0E`), does NOT participate in theming.
- Animation via `tw-animate-css` plugin.

### Database (Supabase/Postgres)

- **17 migrations** in `supabase/migrations/` (0001–0017, all applied). 0016 is the v2 schema transform (11-stage → 8-stage `deal_stage` enum, fixed columns → dynamic `deal_fields`).
- **Flexible schema:** `deals` table holds only system fields (outreach_emails, unit_count, stage, score). All property data (address, zip, CoStar link, etc.) stored in `deal_fields` as key/value rows catalogued by `field_definitions`.
- Key tables: users (managed by Supabase Auth), contacts, deals, deal_fields, field_definitions, call_briefs, campaigns, import_jobs, google_tokens, profile, ca_credentials, loi_tracker, portfolios.
- RLS policies in migration 0013 enforce: internal role sees all; client role sees only good/very_good non-archived deals + published call briefs.
- `get_my_role()` function (migration 0015) used for role checks.
- Enums (8-stage): `deal_stage` = `lead | outreach | response | underwriting | loi | closed | failed | archived`. `failed` only valid after `loi`; before LOI use `archived`.
- Seed data in `supabase/seed.sql`.

## Component structure

Components live in `src/components/` by domain: `ui/` (shadcn-style primitives), `shared/`, `auth/`, `dashboard/`, `deals/`, `client/`, `import/`.

## Key reference docs (read before building)

| Doc | Content |
|---|---|
| `PLAN.md` (2867 lines) | Sequential build plan, schema details, Supabase API patterns |
| `docs/architecture/ui.md` | Full design system: color tokens, dimensions, theme rules, remediation debt |
| `EXCEL_TABLE.md` (728 lines) | DataGrid/DealTable spec: keyboard nav, cell editing, clipboard, virtualization |
| `docs/architecture/overview.md` | System overview |
| `docs/architecture/database.md` | Database design, RLS, schema |
| `docs/guides/` | Various dev guides, API conventions |

## Implementation gaps

Many components built but NOT wired to pages. See AGENTS.md "Implementation Status" section. Before implementing new features, check `src/components/` — the component may exist but be disconnected. Notable gaps:
- Deal detail page: 7 tabs show placeholder JSON — none wire to `DealStageBar`, `UnderwritingForm`, `LOITracker`, `DocumentChecklist`
- Settings: campaign management is placeholder
- Client calls page: missing `client_notes` textarea
- `UnderwritingForm.tsx`, `DealCard.tsx`, `ClientDealCard.tsx`, `LOITracker.tsx`, `EmailThread.tsx`, `DocumentChecklist.tsx` have hardcoded Tailwind palette colors — need remediation to use CSS var tokens
- Root `layout.tsx` uses `next-themes` `ThemeProvider` — violates `docs/architecture/ui.md` spec

## Critical gotchas

- **Next.js 16** has breaking changes from training data. Read `node_modules/next/dist/docs/` before writing code.
- `supabase migration up` doesn't exist — use `supabase db push`.
- `supabase gen types` uses `--project-ref` not `--project-id`; output is broken — `src/lib/supabase/types.ts` is a manual placeholder.
- Hooks live in `src/lib/hooks/` (NOT `src/hooks/`). shadcn config aliases `@/hooks` but actual imports use `@/lib/hooks/`.
- `vercel.json` missing (needed for Gmail watch cron).
- Upstash Redis required locally for rate limiting.
- Vitest configured (`vitest.config.ts`, node env, globals) but no test files written yet.
- Hooks (7): `useAuth.ts`, `useCallQueue.ts`, `useCampaigns.ts`, `useColumnWidths.ts`, `useDeals.ts`, `useGridInteraction.ts`, `usePortfolios.ts`.
- Company brand config in `src/lib/brand.ts`.
- Centralized page headings in `src/lib/page-headings.ts`.
- Deals API response now includes `deal_fields` with nested `field_definitions` join. New code touching deals should include this join for property data.
- DataGrid `DealTable` now renders ALL `field_definitions` columns (not just `show_in_grid`).