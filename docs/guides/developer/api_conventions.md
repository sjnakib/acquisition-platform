# API & Security Conventions

All backend API handlers in `src/app/api/` must strictly adhere to security, authorization, validation, and error handling standards to protect sensitive financial models and user credentials.

---

## 1. Client Instantiation & Auth Scoping

### A. User-Scoped Requests (Standard API Routes)
User-facing route handlers must **always** use `createClient()` from `@src/lib/supabase/server`. This creates an authed Supabase client under the user's JWT context, ensuring Postgres Row-Level Security (RLS) policies are enforced.

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  // 1. Validate session
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Query data — RLS automatically enforces project membership & role access
  const { data, error: dbError } = await supabase
    .from('deals')
    .select('*')

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

### B. Admin Client (`createAdminClient()`) Exceptions
`createAdminClient()` bypasses Row-Level Security via `SUPABASE_SERVICE_ROLE_KEY`. It is **strictly prohibited** in standard user routes and may only be used in:
1.  **Webhooks**: `/api/emails/webhook` (unauthenticated Google Pub/Sub push requests).
2.  **Admin Portal Routes**: `/api/admin/*` (where an admin user manages account roles or system connections).
3.  **Authentication Handlers**: `/api/auth/reset-password`, `/api/invitations/[token]/accept`.

---

## 2. CSRF Origin Check for State Mutations

All mutating route handlers (`POST`, `PUT`, `PATCH`, `DELETE`) must verify the HTTP `Origin` header against `process.env.NEXT_PUBLIC_APP_URL` to defend against Cross-Site Request Forgery.

```typescript
const origin = req.headers.get('origin')
if (origin && origin !== process.env.NEXT_PUBLIC_APP_URL) {
  return NextResponse.json({ error: 'CSRF protection check failed' }, { status: 403 })
}
```

---

## 3. Rate Limiting (`src/lib/rate-limit.ts`)

Sensitive endpoints must apply Upstash Redis sliding window limiters. Extract IP addresses from `x-forwarded-for`:

```typescript
import { loginRateLimit } from '@/lib/rate-limit'

const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
const { success } = await loginRateLimit.limit(ip)

if (!success) {
  return NextResponse.json(
    { error: 'Too many login attempts. Please wait 5 minutes.' },
    { status: 429 }
  )
}
```

---

## 4. Input Validation (Zod Schemas)

Never consume raw `req.json()` directly. Always validate request payloads against Zod schemas in `src/lib/validations/`.

```typescript
import { createDealSchema } from '@/lib/validations/deal.schema'

const body = await req.json()
const parsed = createDealSchema.safeParse(body)

if (!parsed.success) {
  return NextResponse.json(
    { error: 'Validation error', details: parsed.error.flatten() },
    { status: 400 }
  )
}

// Safely consume parsed.data
const { address, campaign_id } = parsed.data
```

---

## 5. Standardized HTTP Response Status Codes

*   `200 OK`: Successful query or update.
*   `201 Created`: Successful creation of a new entity.
*   `400 Bad Request`: Zod validation failure or invalid request body.
*   `401 Unauthorized`: Missing or unauthenticated user session.
*   `403 Forbidden`: CSRF mismatch or insufficient role permissions.
*   `404 Not Found`: Target entity or project does not exist.
*   `409 Conflict`: Unique constraint violation (e.g. key collision).
*   `429 Too Many Requests`: Upstash rate limit exceeded.
*   `500 Internal Server Error`: Unexpected database failure or unhandled exception.
