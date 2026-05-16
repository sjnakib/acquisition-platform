# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md — full architecture docs. Read that first for anything beyond what's here.

## Quick start

```bash
npm run dev          # dev server at localhost:3000
npm run lint         # ESLint (only automated check — no test/typecheck scripts)
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

### API route pattern (30 routes)

```
auth check → CSRF origin check (mutations) → Zod validation → Supabase (anon-key, RLS)
```

### Key libraries

- `@tanstack/react-query@^5` — `ReactQueryProvider` is default export with module-level `new QueryClient()`
- `react-hook-form` + `zod` + `@hookform/resolvers`
- `exceljs` for CoStar import (NOT `xlsx`)
- `googleapis` + `google-auth-library` for Gmail/Drive
- `@upstash/ratelimit` + `@upstash/redis` for rate limiting
- `react-turnstile` for Cloudflare Turnstile CAPTCHA

### CSP headers

Defined in `next.config.ts`. Adding external APIs/scripts/iframes → update CSP there.

## Critical gotchas

- Next.js 16 has breaking changes from what you know. Read `node_modules/next/dist/docs/` before writing code.
- `supabase migration up` doesn't exist — use `supabase db push`.
- `supabase gen types` uses `--project-ref` not `--project-id`; output is broken — `src/lib/supabase/types.ts` is a manual placeholder.
- Hooks live in `src/lib/hooks/` (NOT `src/hooks/`). shadcn config aliases `hooks` to `@/hooks` but actual imports use `@/lib/hooks/`.
- `vercel.json` missing (needed for Gmail watch cron).
- Upstash Redis required locally for rate limiting.
- No test infrastructure exists — only lint check available.

## Implementation gaps

Many components built but not wired to pages. See AGENTS.md "Implementation Status" section for specifics. Before implementing new features, check if the component already exists but isn't connected.
