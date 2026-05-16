# Acquisition Platform Documentation

Welcome to the definitive documentation for the **Acquisition Platform**, a comprehensive web application engineered to streamline the entire lifecycle of multifamily property acquisitions. 

The platform supports a dual-audience model: an internal acquisition team that manages heavy data importing, underwriting, and outreach, and an executive/client view providing high-level metrics and curated deal summaries.

## Documentation Structure

This repository is divided into two primary sections to help you navigate the system's complexity:

### 1. Architecture
These documents detail the foundational design decisions, data models, and styling systems that govern the application. Read these to understand *how* and *why* the platform is built the way it is.

*   [System Overview](./architecture/overview.md) — Next.js 16 routing, proxy patterns, and external integrations.
*   [Database & Security](./architecture/database.md) — Supabase schema, Row-Level Security (RLS) enforcement, and custom Postgres functions.
*   [UI & Theming Specifications](./architecture/ui.md) — The strict design system rules, custom CSS variables, and specific exceptions (e.g., the permanent dark sidebar).

### 2. Guides
These guides provide actionable steps for developers contributing to the codebase, and for end-users operating the platform.

*   **Developer Guides**
    *   [Getting Started](./guides/developer/getting_started.md) — Environment setup, CLI tools, and database initialization.
    *   [API & Security Conventions](./guides/developer/api_conventions.md) — Required patterns for writing new backend routes, including CSRF, rate-limiting, and validation.
*   **User Guides**
    *   [Platform Usage & Workflows](./guides/user/platform_usage.md) — A walkthrough of core platform features from both the internal team and client perspectives.

---
**Note for AI Agents & Developers:** This codebase enforces strict rules (e.g., prohibition of `next-themes`, absolute reliance on RLS, specific Next.js 16 conventions). Any deviations from these documented patterns will cause critical system failures or visual regressions.
