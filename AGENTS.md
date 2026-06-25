# This is NOT the Next.js you know

Next.js 16.2.6 — APIs, conventions, and file structure differ from training data. Heed deprecation notices.

Commands + architecture: see **CLAUDE.md** (canonical source). This file = Next.js 16 specifics + migration timeline + quick DB reference.

## Next.js 16 specifics

- **No `src/middleware.ts`.** `src/proxy.ts` handles session + role routing (Next.js 16 proxy pattern). API routes excluded from matcher.
- **`reactStrictMode: true`** — effects fire twice in dev. Don't duplicate cleanup/subscriptions.
- **`next.config.ts`** `experimental.serverActions.allowedOrigins` depends on `NEXT_PUBLIC_APP_URL` — must be set in production.
- **shadcn alias gotcha:** `components.json` maps `"hooks": "@/hooks"`, but no imports use it — all hooks are at `@/lib/hooks/`. Use `@/lib/hooks/` for hook imports.

## Database quick reference

### Migration timeline

**57 migrations** (`supabase/migrations/0001–0057`). 0056 and earlier applied; 0057 (reply review: `needs_review`/`snoozed_until` on `email_outreach`) pending:

| Migration | What |
|-----------|------|
| 0016 | v2 schema transform: 11-stage → 8-stage enum, fixed columns → dynamic `deal_fields` |
| 0019–0022 | Projects/sponsors + project-scoped RLS |
| 0023–0026 | Backfill `project_id`, column rationalization, surface imported fields |
| 0027–0029 | Follow-up call fields, deal detail enhancements, project access |
| 0030 | Multi-project Gmail (`google_connections` table, projects FK) |
| 0031–0033 | Email body fields, custom templates (`email_templates`), `custom` enum |
| 0034 | **Address replaces `deal_name`** as primary required deal field |
| 0035 | Snoozed email threads |
| 0036 | Enable realtime |
| 0037 | Email attachments storage |
| 0038–0040 | Client RLS fixes (field defs, deal visibility, contacts) |
| 0041 | Drive folders (deal-linked file management) |
| 0042 | Remove `activity_log` table |
| 0043–0044 | **Portfolios as deals** — `is_portfolio` flag, `portfolio_deal_id` FK, backfill |
| 0045 | **Admin role** — `'admin'` in `user_role` enum, `is_staff()`, `project_members` table |
| 0050 | **Invitation system** — branded email invites, replaces Supabase `admin.inviteUserByEmail()` |
| 0051 | **System Gmail** — `google_connections.connection_type` (`project` \| `system`) |
| 0052–0054 | Password reset — `password_resets` table, `find_user_by_email()`, `get_user_emails()` |
| 0055 | Field cleanup — unified storage, consolidated LOI columns, deleted 57 stale `field_definitions` |
| 0056 | Drive file count functions — stored procedures for `deals.drive_file_count` |
| 0057 | Reply review — `needs_review` + `snoozed_until` columns on `email_outreach` |

### Key rules

- **RLS is sole access control.** `is_staff()` = admin OR internal. Admin sees all. Internal sees assigned projects via `project_members`. Client sees non-archived deals in sponsored projects + published call briefs.
- **8-stage `deal_stage`:** `lead | outreach | response | underwriting | loi | closed | failed | archived`. `failed` only valid after `loi`; before LOI use `archived`. Source of truth: `src/lib/stage-machine.ts` `canTransition()`.
- **Flexible schema:** `deals` table = system fields only. Property data → `deal_fields` key/value rows catalogued by `field_definitions`. `address` is required primary field.
- **`noUncheckedIndexedAccess: true`** — use `!` or `?.` on array/record access.

### Key tables

`users`, `contacts`, `deals`, `deal_fields`, `field_definitions`, `call_briefs`, `campaigns`, `import_jobs`, `google_connections`, `profile`, `ca_credentials`, `loi_tracker`, `portfolios`, `projects`, `sponsors`, `email_templates`, `drive_folders`, `underwriting`, `password_resets`, `project_members`

### Env vars (`.env.example` — 5 groups)

**Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`
**Turnstile:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
**Google OAuth:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_CLOUD_PROJECT_ID`
**App:** `NEXT_PUBLIC_APP_URL`, `DB_ENCRYPTION_KEY`
**Upstash Redis:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
