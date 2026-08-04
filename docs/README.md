# Acquire Platform Documentation

Welcome to the official developer and user documentation for the **Acquire — Multifamily Property Acquisition Platform**, a modern, multi-tenant web application engineered to streamline the entire lifecycle of commercial real estate acquisitions.

The platform provides a role-based dual experience: an **Internal Acquisition Team Portal** for heavy lead importing, automated outreach, financial underwriting with multi-tier approvals, LOI counter-offer tracking, and Google Drive file management; and a **Client Sponsor Portal** for investors and executive partners to monitor active pipeline deals, access published call briefs, and collaborate on call queues.

---

## Documentation Directory

### 1. Architectural Reference
These documents outline the system architecture, database security models, and design system rules.

*   [**System Architecture Overview**](./architecture/overview.md) — Next.js 16 App Router layout groups, Multi-Project workspace model, proxy session hydration (`src/proxy.ts`), and external integrations (Google Gmail/Drive/People APIs, Cloudflare Turnstile, Upstash Redis).
*   [**Database & Security Reference**](./architecture/database.md) — Complete Supabase PostgreSQL schema (25+ tables), Row-Level Security (RLS) policies for Admin, Internal, and Client roles, security definer stored functions, and triggers.
*   [**UI & Design System Specifications**](./architecture/ui.md) — Theme specifications, CSS variable tokens (`globals.css`), Light/Dark mode state management, font pairings (DM Sans, Instrument Serif, JetBrains Mono), and virtualized `DataGrid` interaction hooks.

### 2. Guides & Conventions
Actionable guides for setting up the codebase, writing API routes, and operating platform workflows.

*   **Developer Guides**
    *   [**Developer Getting Started**](./guides/developer/getting_started.md) — Prerequisites, environment variables (`.env.local`), database migrations (`npm run db:push`), type generation (`npm run db:types`), and Google Cloud OAuth / Pub/Sub setup.
    *   [**API & Security Conventions**](./guides/developer/api_conventions.md) — Standardized handler patterns, CSRF origin verification, Zod input validation schemas, Upstash sliding window rate limiting, and HTTP status codes.
*   **User & Operator Guides**
    *   [**Platform Usage & Workflows**](./guides/user/platform_usage.md) — End-to-end user workflows for Internal Acquisition Managers (Projects Hub, CoStar CSV import wizard, 8-stage state machine, mail merge outreach, underwriting approvals, LOI rounds, Drive files) and Client Sponsors (Active Deals Overview, Call Queue).

---

> **Engineering Note**: This codebase enforces strict architectural rules (e.g., project isolation via RLS, prohibition of `next-themes`, single-source theme tokens, Zod request validation). Always consult these docs before adding new features or modifying schema policies.
