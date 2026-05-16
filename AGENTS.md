<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Orientation

- **Master plan:** `PLAN.md` — exhaustive architecture doc. Read it before touching any feature.
- **`src/proxy.ts`** handles session + role routing (Next.js 16 proxy pattern). NO `src/middleware.ts` — do not create one.
- **`UI.md`** — theming & design system. Custom CSS vars in `globals.css`, NOT `next-themes` (despite being in deps).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at localhost:3000 |
| `npm run lint` | ESLint (only automated check — no test/typecheck scripts) |
| `npm run db:types` | Generate TS types from Supabase schema |
| `npm run db:push` | Push migrations to linked project |
| `npm run db:push:local` | Push to local Supabase |
| `npm run db:reset` | Reset + re-seed local DB |

**Gotcha:** `supabase migration up` does NOT exist (removed in CLI v2). Use `supabase db push`.
**Gotcha:** `supabase gen types` uses `--project-ref` (NOT `--project-id`). Output redirection is broken — `src/lib/supabase/types.ts` is a manual placeholder with real enums but `Record<string, unknown>` for table rows.

## Database

- **15 migrations** in `supabase/migrations/` (0001–0015). All applied.
- **Seed users:** `test-internal@example.com` / `Password123!` (role: internal), `test-client@example.com` / `Password123!` (role: client).
- Re-seed locally: `npm run db:reset`.
- **RLS is the sole access control** for user-facing queries — anon-key Supabase clients rely entirely on RLS policies.
- **`createAdminClient()`** (service role) is ONLY used in Gmail webhook and `/api/admin/*` routes — never in user-facing API routes.

## Route Groups & Auth

- **Three route groups:** `(auth)` — login/signup/reset-password, `(internal)` — team views (plus `(internal)/client-view/` for internal users previewing client UI), `(client)` — CEO/client views.
- **`src/proxy.ts`** gates (use this instead of `src/middleware.ts`): unauthenticated → `/login`; authenticated on auth pages → role home (`/overview` or `/dashboard`); wrong-role → redirect to correct home.
- **Layout-level guards** in `(internal)/layout.tsx` and `(client)/layout.tsx` reinforce role checks.
- **`app/page.tsx`** just `redirect('/login')`.
- **API routes** authenticate via `supabase.auth.getUser()` (anon-key client, RLS-scoped). Mutations check `origin` header against `NEXT_PUBLIC_APP_URL` for CSRF (GET routes do not).

## Architecture

- **Supabase client layer:** 5 files in `src/lib/supabase/` — `client.ts` (browser), `server.ts` (server comps/API routes), `middleware.ts` (session refresh, used by `proxy.ts`), `admin.ts` (service role), `types.ts` (manual placeholder). None pass the `Database` type param.
- **Hooks** live in `src/lib/hooks/` (NOT `src/hooks/`). `components.json` aliases `hooks` to `@/hooks` but actual imports use `@/lib/hooks/`. Hooks call `createClient()` from `@/lib/supabase/client` directly.
- **Zod validation schemas** in `src/lib/validations/` — one file per domain.
- **API routes** (30 total) follow: auth check → CSRF origin check (mutations only) → Zod validation → Supabase with anon-key client (RLS scopes data).
- **Google integration** in `src/lib/google/` — `oauth.ts`, `gmail.ts`, `drive.ts`.
- **Rate limiting** in `src/lib/rate-limit.ts` — Upstash Redis (required locally).
- **CoStar import** in `src/lib/import/costar-parser.ts` — uses `exceljs` (NOT `xlsx`).
- **`ReactQueryProvider`** is a default export with module-level `new QueryClient()` (not wrapped in `useState`).
- **`noUncheckedIndexedAccess`** is enabled. Access array/record elements with `!` or optional chaining.
- **Tailwind CSS v4** with `@tailwindcss/postcss` — no `tailwind.config.ts`. `tw-animate-css` plugin for animations.
- **Theme:** Custom CSS variable system in `globals.css` (light default, opt-in dark via `.dark` class). **Do NOT use `next-themes`** despite it being in package.json — the UI.md spec overrides.

## CSP Headers (next.config.ts)

- `next.config.ts` sets `Content-Security-Policy`. Adding external APIs, scripts, or iframes requires updating CSP. Current allowlist:
  - script-src: `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https://challenges.cloudflare.com`
  - connect-src: `'self'`, `https://*.supabase.co`, `https://www.googleapis.com`, `https://accounts.google.com`
  - frame-src: `https://challenges.cloudflare.com`
  - img-src: `'self'`, `data:`, `https://lh3.googleusercontent.com`

## Integration Quirks

- **Upstash Redis** required locally for rate limiting. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must be in `.env.local`.
- **Gmail/Drive** requires Google OAuth. SCOPES: `gmail.send`, `gmail.modify`, `drive.file`. Pub/Sub webhook verifies Google JWTs. Gmail watch expires every 7 days — re-register via `refresh-watch` cron.
- **Cloudflare Turnstile** for bot protection on login/signup. Server-side verify at `/api/turnstile/verify`.
- **`vercel.json`** is missing (needed for Gmail watch cron).

## Implementation Status (Known Gaps)

Many components exist but are NOT wired into pages:
- Dashboard shows "coming soon" — `FunnelMetrics`, `KPIScorecard`, `PipelineTable`, `ConversionChart` built but unused.
- Deal detail page has 7 tabs — all show placeholder JSON, none wire to components (`DealStageBar`, `UnderwritingForm`, `LOITracker`, `DocumentChecklist`, etc.).
- Settings: Gmail connect works; campaign management, user management, email template editor are placeholders.
- Import wizard uses mock data, no preview table, no progress polling.
- Client calls page missing `client_notes` textarea.
- Before building new UI, check `src/components/` — the component may already exist but be unwired.
