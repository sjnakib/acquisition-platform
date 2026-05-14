import type { UserRole } from './database'

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    SUPABASE_SERVICE_ROLE_KEY: string
    SUPABASE_PROJECT_ID: string
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: string
    TURNSTILE_SECRET_KEY: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    GOOGLE_REDIRECT_URI: string
    GOOGLE_CLOUD_PROJECT_ID: string
    NEXT_PUBLIC_APP_URL: string
    DB_ENCRYPTION_KEY: string
    UPSTASH_REDIS_REST_URL: string
    UPSTASH_REDIS_REST_TOKEN: string
  }
}

declare module 'next' {
  interface NextRequest {
    user?: {
      id: string
      email?: string
      app_metadata?: {
        role?: UserRole
      }
    }
  }
}
