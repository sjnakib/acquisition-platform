<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Tech Stack

- **Framework:** Next.js (App Router)
- **Database:** Supabase
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI, lucide-react, sonner
- **Form Management:** React Hook Form with Zod for validation
- **Authentication:** Supabase Auth, with Google OAuth configured.
- **Rate Limiting:** Upstash Ratelimit

## Development

- **Run development server:** `npm run dev`
- **Run linting:** `npm run lint`

## Database

The project uses Supabase for the database.

- **Generate TypeScript types from schema:** `npm run db:types`
- **Push database migrations:** `npm run db:push`
- **Reset local database:** `npm run db:reset`

## Code Style and Conventions

- **Linting:** The project uses ESLint. Run `npm run lint` to check for issues.
- **Path Aliases:** The path alias `@/*` is configured to point to `src/*`.
- **Typing:** The codebase is strictly typed. `noUncheckedIndexedAccess` is enabled.

## Deployment & Security

- **Content Security Policy (CSP):** The application has a strict CSP. When adding external scripts or resources, you may need to update the `headers` section in `next.config.ts`.
- **Server Actions:** The app uses Next.js Server Actions. Any new server-side mutations should be implemented as Server Actions.
