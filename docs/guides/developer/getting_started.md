# Developer Getting Started Guide

This guide provides step-by-step instructions for setting up the **Acquire Platform** locally, configuring environment variables, running database migrations, generating TypeScript types, and configuring external cloud services.

---

## 1. Local Environment Prerequisites

Ensure your development machine has the following tools installed:
*   **Node.js**: Version 20.x or higher.
*   **npm**: Package manager (included with Node).
*   **Supabase CLI**: Installed as a project dependency (`npm i -D supabase`).

### Required External Provider Accounts:
1.  **Supabase**: PostgreSQL database, Auth, and Storage host.
2.  **Google Cloud Console**: Project with **Gmail API**, **Google Drive API**, and **Google People API** enabled, plus a configured OAuth 2.0 Client ID & Secret and Pub/Sub Topic for webhooks.
3.  **Cloudflare**: Turnstile site key and secret key for CAPTCHA protection.
4.  **Upstash**: Redis database endpoint and token for sliding window rate limiting.

---

## 2. Environment Variables Configuration

Create a `.env.local` file at the root of the project. Copy values from `.env.example`:

```env
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SUPABASE_SERVICE_ROLE_KEY]
SUPABASE_PROJECT_ID=[YOUR_SUPABASE_PROJECT_REF_ID]

# Optional: Supabase CLI deployment token
SUPABASE_PERSONAL_ACCESS_TOKEN=[YOUR_ACCESS_TOKEN]

# --- Upstash Redis (Rate Limiting) ---
UPSTASH_REDIS_REST_URL=https://[YOUR_UPSTASH_ENDPOINT].upstash.io
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]

# --- Cloudflare Turnstile ---
NEXT_PUBLIC_TURNSTILE_SITE_KEY=[YOUR_TURNSTILE_SITE_KEY]
TURNSTILE_SECRET_KEY=[YOUR_TURNSTILE_SECRET_KEY]

# --- Google OAuth / Gmail / Drive / People API ---
GOOGLE_CLIENT_ID=[YOUR_GOOGLE_CLIENT_ID]
GOOGLE_CLIENT_SECRET=[YOUR_GOOGLE_CLIENT_SECRET]
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
GOOGLE_CLOUD_PROJECT_ID=[YOUR_GCP_PROJECT_ID]

# --- Application & Encryption ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
DB_ENCRYPTION_KEY=[YOUR_32_BYTE_BASE64_ENCRYPTION_KEY]
```

---

## 3. Database Setup & Migrations

The database schema is managed via the Supabase CLI using migration files in `supabase/migrations/`.

### Commands:

1.  **Authenticate Supabase CLI**:
    ```bash
    npx supabase login
    ```

2.  **Link to Remote Supabase Project**:
    ```bash
    npx supabase link --project-ref $SUPABASE_PROJECT_ID
    ```

3.  **Push Database Migrations**:
    ```bash
    # For local Docker Supabase instance:
    npm run db:push:local

    # For remote linked Supabase instance:
    npm run db:push
    ```

4.  **Generate Database TypeScript Definitions**:
    Run this command whenever table schemas or functions change to keep `src/lib/supabase/types.ts` synchronized:
    ```bash
    npm run db:types
    ```

5.  **Reset & Seed Local Database (Optional)**:
    ```bash
    npm run db:reset
    ```

---

## 4. Running the Application Locally

Start the Next.js Turbopack development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Test Accounts (from `supabase/seed.sql`):
*   **Admin Role**: `admin@acquire.com` / `Password123!`
*   **Internal Role**: `team@acquire.com` / `Password123!`
*   **Client Sponsor Role**: `sponsor@acquire.com` / `Password123!`

---

## 5. Testing & Verification

Run type checks and unit test suites:

```bash
# Run TypeScript compilation check
npx tsc --noEmit

# Run Vitest test runner
npm run test
```

---

## 6. Vercel Deployment Notes

*   Ensure all environment variables from `.env.local` are configured in Vercel Project Settings.
*   The application includes a `vercel.json` cron job definition (`/api/auth/google/refresh-watch`) scheduled every 6 days to auto-renew Gmail Pub/Sub push notification watches before their 7-day expiration window.
