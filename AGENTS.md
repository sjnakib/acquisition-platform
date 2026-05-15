<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Orientation

- **Master plan:** `PLAN.md` — exhaustive architecture doc. Read it before touching any feature.
- **`proxy.ts`** at `src/proxy.ts` handles session + role routing (the Next.js 16 proxy pattern). There is NO `src/middleware.ts` — do not create one.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run lint` | ESLint |
| `npm run db:types` | Generate TS types from Supabase schema |
| `npm run db:push` | Push migrations to linked project |
| `npm run db:push:local` | Push to local Supabase |
| `npm run db:reset` | Reset + re-seed local DB |

**Gotcha:** `supabase migration up` does NOT exist (removed in CLI v2). Use `supabase db push`.
**Gotcha:** `supabase gen types` uses `--project-ref` (NOT `--project-id`). The redirection output is broken — `src/lib/supabase/types.ts` is a manual placeholder with real enums but `Record<string, unknown>` for table rows.
**Gotcha:** No `npm run test` or `npm run typecheck` scripts exist. Lint is the only automated verification.

## Database

- **14 migrations** in `supabase/migrations/`, run in order. All applied.
- **Seed users:** `test-internal@example.com` / `Password123!` (role: internal), `test-client@example.com` / `Password123!` (role: client).
- Re-seed locally: `npm run db:reset`.
- **RLS is the sole access control** in user-facing queries — anon-key Supabase clients rely entirely on RLS policies.
- **`createAdminClient()`** (service role) is ONLY used in Gmail webhook and `/api/admin/*` routes — never in user-facing API routes.

## Route Groups & Auth

- **Three route groups:** `(auth)` — login/signup/reset-password, `(internal)` — team views, `(client)` — CEO/client views.
- **`src/proxy.ts`** gate unauthenticated users → redirect to `/login`; authenticated users on auth pages → redirect to role home (`/overview` or `/dashboard`); wrong-role access → redirect to correct role home.
- **Layout-level guards** in `(internal)/layout.tsx` and `(client)/layout.tsx` reinforce role checks.
- **`app/page.tsx`** just `redirect('/login')`.
- **API routes** authenticate via `supabase.auth.getUser()` (anon-key client, RLS-scoped). Mutations check `origin` header against `NEXT_PUBLIC_APP_URL` for CSRF.

## Architecture

- **Supabase client layer:** 4 files in `src/lib/supabase/` — `client.ts` (browser, `createBrowserClient`), `server.ts` (server components/API routes, `createServerClient`), `admin.ts` (service role), `middleware.ts` (session refresh helper used by `proxy.ts`). None pass the `Database` type parameter.
- **Hooks** live in `src/lib/hooks/` (NOT `src/hooks/`). The `components.json` shadcn config aliases `hooks` to `@/hooks`, but actual imports use `@/lib/hooks/`. Hooks call `createClient()` from `@/lib/supabase/client` directly, bypassing API routes.
- **Zod validation schemas** in `src/lib/validations/` — one file per domain (`auth.schema.ts`, `deal.schema.ts`, `contact.schema.ts`, `import.schema.ts`).
- **API routes** (30 total) follow this pattern: auth check → CSRF origin check (mutations only) → Zod validation → Supabase with anon-key client (RLS scopes data).
- **Google integration** in `src/lib/google/` — `oauth.ts` (OAuth2 client), `gmail.ts` (send + watch), `drive.ts` (file operations).
- **Rate limiting** in `src/lib/rate-limit.ts` — uses Upstash Redis, applied in API routes.
- **CoStar import** in `src/lib/import/costar-parser.ts` — uses `exceljs` (NOT `xlsx`).
- **`src/lib/utils.ts`** — `cn()` helper (clsx + tailwind-merge).
- **`ReactQueryProvider`** is a default export with a module-level `new QueryClient()` (not wrapped in `useState`).
- **Tailwind CSS v4** with `@tailwindcss/postcss` — no `tailwind.config.ts`.
- **`noUncheckedIndexedAccess`** is enabled in `tsconfig.json`. Access array/record elements with `!` or optional chaining.

## CSP Headers (next.config.ts)

- `next.config.ts` sets `Content-Security-Policy` restricting script-src, connect-src, frame-src, img-src.
- **Gotcha:** Adding external APIs, scripts, or iframes requires updating the CSP in `next.config.ts`. Current allowlist:
  - script-src: `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https://challenges.cloudflare.com`
  - connect-src: `'self'`, `https://*.supabase.co`, `https://www.googleapis.com`, `https://accounts.google.com`
  - frame-src: `https://challenges.cloudflare.com`
  - img-src: `'self'`, `data:`, `https://lh3.googleusercontent.com`

## Integration Quirks

- **Upstash Redis** is required locally for rate limiting. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must be set in `.env.local`.
- **Gmail/Drive integration** requires Google OAuth. SCOPES: `gmail.send`, `gmail.modify`, `drive.file`. Pub/Sub webhook verifies Google JWTs. Gmail watch expires every 7 days — re-register via `refresh-watch` cron.
- **Cloudflare Turnstile** for bot protection on login/signup. Verified server-side via `/api/turnstile/verify`.
- **`vercel.json`** is missing (needed for Gmail watch cron).

## Implementation Status (Known Gaps)

Many components exist but are NOT wired into pages:
- Dashboard shows "coming soon" — `FunnelMetrics`, `KPIScorecard`, `PipelineTable`, `ConversionChart` are built but unused.
- Deal detail page has 7 tabs — all show placeholder JSON, none wire to the actual components (`DealStageBar`, `UnderwritingForm`, `LOITracker`, `DocumentChecklist`, etc.).
- Settings page: Gmail connect works; campaign management, user management, email template editor are placeholders.
- Import wizard uses mock data, no preview table, no progress polling.
- Client calls page is missing the `client_notes` textarea.
