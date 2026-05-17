# This is NOT the Next.js you know

Next.js 16 — APIs, conventions, and file structure differ from training data. Heed deprecation notices.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at localhost:3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint — only automated check |
| `npm run test` | Vitest (node env, globals on) |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:push` | Push migrations to linked Supabase |
| `npm run db:push:local` | Push to local Supabase |
| `npm run db:reset` | Reset + re-seed local DB (runs `seed.sql`) |
| `npm run db:types` | Generate TS types from Supabase schema |

**Gotcha:** `supabase migration up` does NOT exist (CLI v2). Use `supabase db push`.
**Gotcha:** `supabase gen types` uses `--project-ref` (NOT `--project-id`). Output redirection is broken — `src/lib/supabase/types.ts` is a manual placeholder with real enums but `Record<string, unknown>` for table rows. No Supabase client file passes the `Database` type param.
**Gotcha:** No test files exist yet. Vitest is configured (`vitest.config.ts`, node env, globals) but suite is empty.

## Auth & Routing

- **No `src/middleware.ts`.** `src/proxy.ts` handles session + role routing (Next.js 16 proxy pattern). API routes excluded from matcher.
- **Route groups:** `(auth)` — login/signup/reset-password, `(internal)` — team views + `/client-view`, `(client)` — CEO/client views.
- **`app/page.tsx`** just `redirect('/login')`.
- **API routes** (31 route files): auth check → CSRF origin check (mutations only) → Zod validation → Supabase anon-key client (RLS scopes data).
- **`createAdminClient()`** (service role) ONLY used in Gmail webhook and `/api/admin/*` routes.

## Database

- **15 migrations** in `supabase/migrations/` (0001–0015, all applied). Seed users: `test-internal@example.com` / `Password123!` (internal), `test-client@example.com` / `Password123!` (client). Re-seed: `npm run db:reset`.
- **RLS is sole access control.** Internal sees all; client sees only good/very_good non-archived deals + published call briefs.
- **Enums:** `user_role`, `deal_stage` (11 stages), `deal_score`, `property_type`, `building_class`, `email_status`, `response_classification`, `ca_status`, `underwritability`, `call_status`, `loi_outcome`, `email_template_key`, `listing_type`, `deal_source`. See `src/lib/supabase/types.ts`.

## Architecture

- **Supabase layer:** `src/lib/supabase/` — `client.ts` (browser), `server.ts` (server/API), `middleware.ts` (session refresh), `admin.ts` (service role), `types.ts` (manual placeholder).
- **Hooks:** `src/lib/hooks/` (7 files). `components.json` aliases `hooks` to `@/hooks` but actual imports use `@/lib/hooks/`.
- **`ReactQueryProvider`** — default export, module-level `new QueryClient()` (NOT wrapped in `useState`).
- **`noUncheckedIndexedAccess: true`** — access arrays/records with `!` or `?.`.
- **Tailwind CSS v4** with `@tailwindcss/postcss` — no `tailwind.config.ts`. `tw-animate-css` plugin.
- **Theme:** CSS variables in `globals.css` (light default, opt-in dark via `.dark` class). **Do NOT use `next-themes`** — root layout violates UI.md spec. UI.md takes precedence.
- **CSS variables:** All components must use `var(--color-*)` tokens. Raw hex, Tailwind palette colors, `prefers-color-scheme` prohibited. Sidebar always-dark (`#0E0E0E`), no theming.

## CSP Headers (`next.config.ts`)

Adding external APIs, scripts, or iframes requires updating CSP in `next.config.ts`. Current:
- script-src: `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https://challenges.cloudflare.com`
- connect-src: `'self'`, `https://*.supabase.co`, `https://www.googleapis.com`, `https://accounts.google.com`
- frame-src: `https://challenges.cloudflare.com`
- img-src: `'self'`, `data:`, `https://lh3.googleusercontent.com`

## Key Reference Docs (read before building)

- **`PLAN.md`** — Sequential build plan, phase-gated, schema details, API patterns.
- **`UI.md`** — Design system spec: color tokens, dimensions, theme rules, remediation debt.
- **`EXCEL_TABLE.md`** — DataGrid/DealTable: keyboard nav, cell editing, clipboard, virtualization.
- **`docs/architecture/`** and **`docs/guides/`** — System overview, DB/RLS, API conventions, dev setup.

## Integration Gotchas

- **Upstash Redis** required for rate limiting. `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in `.env.local`.
- **Gmail/Drive** requires Google OAuth. Pub/Sub webhook verifies Google JWTs. Gmail watch expires every 7 days — re-register via `refresh-watch` cron. `vercel.json` missing (needed for cron).
- **Cloudflare Turnstile** for bot protection on login/signup. Server verify at `/api/turnstile/verify`.
- **CoStar import** uses `exceljs` (NOT `xlsx`).
- **Zod schemas** in `src/lib/validations/` — one file per domain.
- **Env vars** in `.env.example` — 5 groups: Supabase, Turnstile, Google OAuth, App, Upstash.

## Implementation Status (Known Gaps)

Components may already exist in `src/components/` — check before building.
- Dashboard: "coming soon" — `FunnelMetrics`, `KPIScorecard`, `PipelineTable`, `ConversionChart` built but unused.
- Deal detail (`/deals/[id]`): 7 tabs show placeholder JSON — none wire to `DealStageBar`, `UnderwritingForm`, `LOITracker`, `DocumentChecklist`, etc.
- Settings: Gmail connect works; campaign management, user management, email template editor are placeholders.
- Import wizard: mock data, no preview table, no progress polling.
- Client calls page: missing `client_notes` textarea.
- `UnderwritingForm.tsx`, `DealCard.tsx`, `ClientDealCard.tsx`: hardcoded Tailwind palette colors — need `var(--color-*)` remediation (see `UI.md`).
- Root `layout.tsx` uses `next-themes` `ThemeProvider` — violates UI.md spec (mandates inline `<script>` + `localStorage`). Do NOT add more `next-themes` usage.
