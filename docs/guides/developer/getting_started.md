# Developer Getting Started Guide

This guide provides exhaustive instructions for setting up the Acquisition Platform for local development, configuring third-party integrations, and managing database migrations.

## 1. Prerequisites

Ensure you have the following installed on your machine:
*   **Node.js**: Version 20.x or higher.
*   **Supabase CLI**: Required for local database operations (`npm i -D supabase`).

You will also need to create accounts and projects with the following external providers:
1.  **Supabase:** Create a project to host your Postgres database and Auth server.
2.  **Cloudflare:** Set up a Turnstile widget (Managed Challenge) for CAPTCHA.
3.  **Upstash:** Create a Redis database for rate limiting.
4.  **Google Cloud Console:** Create a project, enable the **Gmail API**, **Google Drive API**, and **Cloud Pub/Sub API**. Configure an OAuth Consent Screen and create Web Application credentials.

## 2. Environment Configuration

Create a `.env.local` file at the root of the repository. **Do not commit this file.**

```env
# --- Supabase (Dashboard -> Project Settings -> API) ---
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
SUPABASE_PROJECT_ID=[YOUR_PROJECT_REFERENCE_ID] # Used for CLI commands

# --- Cloudflare Turnstile ---
NEXT_PUBLIC_TURNSTILE_SITE_KEY=[YOUR_SITE_KEY]
TURNSTILE_SECRET_KEY=[YOUR_SECRET_KEY]

# --- Google OAuth / Gmail API ---
GOOGLE_CLIENT_ID=[YOUR_GOOGLE_CLIENT_ID]
GOOGLE_CLIENT_SECRET=[YOUR_GOOGLE_CLIENT_SECRET]
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_CLOUD_PROJECT_ID=[YOUR_GCP_PROJECT_ID]

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Generate a secure key for encrypting CA passwords:
# Run: openssl rand -base64 24 | tr -d '='
DB_ENCRYPTION_KEY=[YOUR_GENERATED_KEY]

# --- Rate Limiting (Upstash Redis) ---
UPSTASH_REDIS_REST_URL=https://[YOUR_UPSTASH_ENDPOINT]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]
```

## 3. Database Initialization

The platform uses Supabase CLI to manage the Postgres schema.

1.  **Authenticate the CLI:**
    ```bash
    npx supabase login
    ```
2.  **Link to your remote project:**
    ```bash
    npx supabase link --project-ref $SUPABASE_PROJECT_ID
    ```
3.  **Push Migrations:**
    The codebase includes 15 critical migrations. Push them to your database. *(Note: `supabase migration up` is deprecated. Always use `db push`.)*
    ```bash
    npm run db:push:local # For a local docker instance, OR
    npm run db:push       # To push to your linked remote Supabase instance
    ```
4.  **Generate TypeScript Types:**
    Every time you alter the database schema, regenerate the types to ensure strict type safety across the app.
    ```bash
    npm run db:types
    ```
5.  **Seed the Database (Optional):**
    You can reset the database and run `supabase/seed.sql` to populate test accounts and mock deals.
    ```bash
    npm run db:reset
    ```

## 4. Running the Application

Start the Next.js Turbopack development server:
```bash
npm run dev
```

### Test Accounts
If you ran the seed script, you can log in with:
*   **Internal Role:** `test-internal@example.com` / `Password123!`
*   **Client Role:** `test-client@example.com` / `Password123!`

## 5. Deployment Notes

When deploying to Vercel, ensure you carry over all environment variables from `.env.local` to the Vercel Project Settings.

**Cron Jobs:**
The application relies on a `vercel.json` file to trigger a cron job (`/api/auth/google/refresh-watch`) every 6 days. This is critical to keep the Google Push Notification subscriptions alive, as they expire automatically after 7 days.
