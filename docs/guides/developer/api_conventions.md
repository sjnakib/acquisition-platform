# API & Security Conventions

The Acquisition Platform handles highly sensitive financial data, encrypted credentials, and external API integrations. To maintain a secure perimeter, all backend logic written in Next.js API Routes must rigidly adhere to the following standards.

## 1. Authentication & Supabase Client Instantiation

All user-facing routes must utilize the **Anon Key** server client. This guarantees that all queries execute under the context of the logged-in user, allowing Postgres Row-Level Security (RLS) to properly filter data.

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  
  // 1. Authenticate session
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // 2. Execute query (RLS prevents unauthorized data exposure)
  const { data } = await supabase.from('deals').select('*')
  return NextResponse.json(data)
}
```

### The Service Role Rule
The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies. It is **expressly prohibited** in standard API routes. The function `createAdminClient()` may ONLY be used in:
1.  **Webhooks:** e.g., `/api/emails/webhook` (where the request comes from Google, not a user).
2.  **Admin Routes:** e.g., `/api/admin/users/[id]` (where internal supervisors manipulate user accounts).

## 2. CSRF Protection for Mutations

Any API route that mutates state (`POST`, `PATCH`, `DELETE`) is susceptible to Cross-Site Request Forgery. Because we rely on Supabase session cookies, you **must** validate the `Origin` header before processing the request.

```typescript
// Place this at the absolute top of your POST/PATCH/DELETE handlers
const origin = req.headers.get('origin')
if (origin !== process.env.NEXT_PUBLIC_APP_URL) {
  return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
}
```

## 3. Rate Limiting

Endpoints that are computationally expensive or prone to abuse (e.g., login, sending emails) must be rate-limited using the Upstash Redis limiters defined in `src/lib/rate-limit.ts`.

**Important:** Do not use `req.ip` as it is unreliable in modern Next.js deployments. Extract the IP from the `x-forwarded-for` header.

```typescript
import { loginRateLimit } from '@/lib/rate-limit'

const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
const { success } = await loginRateLimit.limit(ip)

if (!success) {
  return NextResponse.json(
    { error: 'Too many attempts. Try again in 15 minutes.' }, 
    { status: 429 }
  )
}
```

## 4. Input Validation (Zod)

Never trust client input. All request bodies must be parsed and validated using Zod schemas defined in `src/lib/validations/`.

```typescript
import { patchDealSchema } from '@/lib/validations/deal.schema'

const body = await req.json()
const parsed = patchDealSchema.safeParse(body)

if (!parsed.success) {
  // Return a 400 Bad Request with the flattened validation errors
  return NextResponse.json(
    { error: 'Invalid input', details: parsed.error.flatten() }, 
    { status: 400 }
  )
}

// Proceed safely using parsed.data
const { stage, score, internal_notes } = parsed.data
```

## 5. Error Handling and Status Codes

*   Wrap logic in `try/catch` blocks when interacting with external APIs (like Gmail or Drive).
*   Always return standardized JSON error objects: `{ error: string }`.
*   Use correct HTTP Status Codes:
    *   `400 Bad Request` for invalid input or Turnstile failures.
    *   `401 Unauthorized` for missing/invalid sessions.
    *   `403 Forbidden` for CSRF failures or role mismatches.
    *   `409 Conflict` for database constraints (e.g., duplicate property IDs).
    *   `422 Unprocessable Entity` for malformed file uploads (e.g., CoStar imports).
    *   `429 Too Many Requests` for rate limit breaches.
