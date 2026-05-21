# REVAMP: Multi-Project Architecture

## Summary

Introduce **Projects** as top-level organizational container. Every entity (deals, campaigns, portfolios, imports, field definitions) scoped to a project. Clients become **Sponsors** — assigned to one or more projects. Internal users manage projects and see all data. Client users see only their sponsored project's dashboard, active deals, and call queue.

---

## Phase 1 — Database

### Migration 0019: `projects` table

```sql
CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_name_idx ON projects USING gin (name gin_trgm_ops);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Internal sees all projects
CREATE POLICY "projects: internal all" ON projects
  FOR ALL USING (get_my_role() = 'internal');

-- Client sees only projects they sponsor
CREATE POLICY "projects: client sees sponsored" ON projects
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM sponsors
      WHERE sponsors.project_id = projects.id
      AND sponsors.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Migration 0020: `sponsors` table

Links client users to projects. Replaces the flat `profiles.client_org` concept.

```sql
CREATE TABLE sponsors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(project_id, user_id)  -- one sponsorship per project per user
);

CREATE INDEX sponsors_project_idx ON sponsors(project_id);
CREATE INDEX sponsors_user_idx ON sponsors(user_id);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

-- Internal: full access
CREATE POLICY "sponsors: internal all" ON sponsors
  FOR ALL USING (get_my_role() = 'internal');

-- Client: see own sponsorships only
CREATE POLICY "sponsors: client sees own" ON sponsors
  FOR SELECT USING (user_id = auth.uid());
```

### Migration 0021: Add `project_id` to entity tables

```sql
-- Add project_id to deals
ALTER TABLE deals ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX deals_project_idx ON deals(project_id);

-- Add project_id to campaigns
ALTER TABLE campaigns ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX campaigns_project_idx ON campaigns(project_id);

-- Add project_id to portfolios
ALTER TABLE portfolios ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX portfolios_project_idx ON portfolios(project_id);

-- Add project_id to field_definitions (makes them project-scoped)
ALTER TABLE field_definitions ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX field_definitions_project_idx ON field_definitions(project_id);

-- Add project_id to import_jobs
ALTER TABLE import_jobs ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX import_jobs_project_idx ON import_jobs(project_id);
```

### Migration 0022: Update RLS policies

All existing RLS policies for `deals`, `campaigns`, `portfolios`, `field_definitions`, `deal_fields`, `import_jobs`, `contacts`, `email_outreach`, `document_checklist`, `underwriting`, `call_briefs`, `loi_records`, `loi_rounds`, `activity_log`, `deal_ca` need updating.

**Pattern for internal tables** (campaigns, portfolios, contacts, email_outreach, document_checklist, underwriting, call_briefs, loi_records, loi_rounds, activity_log, deal_ca):

```sql
-- OLD: internal sees all
-- "campaigns: internal all" USING (get_my_role() = 'internal')
-- NEW: unchanged — internal still sees all globally. Project filter is application-level.
-- These tables inherit project scope via their deal_id FK chain. No direct project_id needed.
```

**For tables with direct project_id** (deals, campaigns, portfolios, field_definitions, import_jobs):

```sql
-- Internal: unchanged (sees all)
-- Client deals: add project membership check
DROP POLICY IF EXISTS "deals: client read good" ON deals;
CREATE POLICY "deals: client read good" ON deals
  FOR SELECT USING (
    get_my_role() = 'client'
    AND is_archived = false
    AND score IN ('good', 'very_good')
    AND EXISTS (
      SELECT 1 FROM sponsors
      WHERE sponsors.project_id = deals.project_id
      AND sponsors.user_id = auth.uid()
    )
  );

-- Client deal_fields: add project membership check via deal
DROP POLICY IF EXISTS "deal_fields: client read good" ON deal_fields;
CREATE POLICY "deal_fields: client read good" ON deal_fields
  FOR SELECT USING (
    get_my_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_fields.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
      AND EXISTS (
        SELECT 1 FROM sponsors s
        WHERE s.project_id = d.project_id
        AND s.user_id = auth.uid()
      )
    )
  );

-- Client call_briefs: add project membership check via deal
DROP POLICY IF EXISTS "call_briefs: client sees published" ON call_briefs;
CREATE POLICY "call_briefs: client sees published" ON call_briefs
  FOR SELECT USING (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
      AND EXISTS (
        SELECT 1 FROM sponsors s
        WHERE s.project_id = d.project_id
        AND s.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "call_briefs: client update notes" ON call_briefs;
CREATE POLICY "call_briefs: client update notes" ON call_briefs
  FOR UPDATE USING (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
      AND EXISTS (
        SELECT 1 FROM sponsors s
        WHERE s.project_id = d.project_id
        AND s.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'client'
    AND published = true
    AND EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = call_briefs.deal_id
      AND d.is_archived = false
      AND d.score IN ('good', 'very_good')
      AND EXISTS (
        SELECT 1 FROM sponsors s
        WHERE s.project_id = d.project_id
        AND s.user_id = auth.uid()
      )
    )
  );

-- field_definitions: client can read definitions for their sponsored projects
DROP POLICY IF EXISTS "field_definitions: read all" ON field_definitions;
CREATE POLICY "field_definitions: read sponsored" ON field_definitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      get_my_role() = 'internal'
      OR EXISTS (
        SELECT 1 FROM sponsors
        WHERE sponsors.project_id = field_definitions.project_id
        AND sponsors.user_id = auth.uid()
      )
    )
  );
```

### Seed data update (`supabase/seed.sql`)

Replace entirely. Seed at minimum:
- 2 projects: "Heritage Multifamily Fund I", "Coastal Retail Portfolio"
- 1 internal test user (unchanged)
- 2 client test users — each as sponsor on one project
- Default field_definitions per project (address, city, state, zip, property_type, building_class, year_built, property_link, listing_type, source)

### Data cleanup

Run `supabase db reset` to wipe all test data. Fresh schema with new migrations. Re-seed with project-aware data.

---

## Phase 2 — API Layer

### New routes

#### `src/app/api/projects/route.ts`
- **GET** — list all projects (internal: all; client: only sponsored, via RLS)
- **POST** — create project (internal only). Body: `{ name, description? }`. Zod schema.
- Returns project with sponsor count.

#### `src/app/api/projects/[id]/route.ts`
- **GET** — single project with sponsor list + stats (deal count, active campaigns)
- **PATCH** — update name/description (internal only)
- **DELETE** — delete project, cascades to all child data (internal only). Confirmation required.

#### `src/app/api/projects/[id]/sponsors/route.ts`
- **GET** — list sponsors for project (user_id, full_name, email)
- **POST** — add sponsor. Body: `{ email, full_name? }`. If user doesn't exist, create auth user + profile with role=client via admin client. If exists and is client, link. If exists and is internal, reject.
- **DELETE** `/[id]/sponsors/[sponsorId]` — remove sponsor from project (does not delete user)

#### `src/app/api/projects/[id]/duplicate/route.ts`
- **POST** — deep-copy a project: copies project row, all field_definitions, campaigns (without deals, just structure). Body: `{ name }`.

### Modified existing routes

Every existing API route that touches deals, campaigns, portfolios, field_definitions, or import_jobs needs `project_id` awareness:

#### Pattern for list/query routes
Add `project_id` query param filter. When `project_id` is present, scope results to that project. When absent (internal global views), return all.

Example — `GET /api/deals`:
```
OLD: ?limit=&offset=&sort=&campaign_id=&stage=&score=&search=
NEW: + &project_id=  (required for client, optional for internal global views)
```

#### Pattern for create routes
Require `project_id` in body. Validate project exists and user has access.

Example — `POST /api/deals`:
```
OLD body: { campaign_id, deal_name, outreach_emails, unit_count }
NEW body: + { project_id }
```

#### Routes affected (all require project_id support):

| Route | Change |
|---|---|
| `GET/POST /api/deals` | Add project_id filter param + body field |
| `GET/PATCH/DELETE /api/deals/[id]` | Validate deal belongs to accessible project |
| `PATCH/DELETE /api/deals/batch` | Validate all deal IDs belong to accessible project(s) |
| `GET/POST /api/deals/[id]/fields` | Inherits project scope via deal |
| `GET/POST /api/deals/[id]/activity` | Inherits project scope via deal |
| `GET/POST /api/campaigns` | Add project_id filter + body field |
| `GET/PATCH/DELETE /api/campaigns/[id]` | Validate campaign belongs to accessible project |
| `GET/POST /api/portfolios` | Add project_id filter + body field |
| `GET/PATCH/DELETE /api/portfolios/[id]` | Validate portfolio belongs to accessible project |
| `GET/POST /api/field-definitions` | Add project_id filter + body field |
| `POST /api/deals/import` | Add project_id to import job |
| `POST /api/deals/import/[batchId]/mapping` | Inherits via import_job |
| `POST /api/deals/import/[batchId]/confirm` | Inherits via import_job |
| `GET /api/deals/import/[batchId]/status` | Inherits via import_job |
| `POST /api/underwriting` | Inherits via deal |
| `POST /api/loi` | Inherits via deal |
| `GET/POST /api/calls` | Add project-aware filtering |
| `GET/PATCH /api/calls/[id]` | Validate call_brief belongs to accessible project via deal |

#### Dashboard aggregation endpoint (new or modified)

Either add `GET /api/projects/[id]/dashboard` returning pre-aggregated pipeline data, or modify the dashboard page to pass `project_id` to the existing deals endpoint. Prefer dedicated endpoint for performance:

```typescript
// GET /api/projects/[id]/dashboard
// Returns: { pipeline: PipelineRow[], totals: KPITotals }
// Aggregates deals by campaign within the project
```

#### Auth route changes

**`POST /api/auth/signup`** — add optional `project_id` and `invite_token` fields for sponsor self-registration flow. If `project_id` provided, auto-create sponsor record after signup.

**`GET /api/auth/me`** — new endpoint returning current user profile + list of sponsored project IDs (for client routing).

---

## Phase 3 — Frontend Routes & Pages

### New route structure

```
src/app/
  (auth)/              — unchanged (login, signup, reset-password)
  (internal)/
    projects/          — NEW: project list (landing page for internal)
      page.tsx
    projects/[id]/
      layout.tsx       — NEW: project context layout (breadcrumb + sidebar)
      dashboard/
        page.tsx       — MOVED: dashboard scoped to project
      deals/
        page.tsx       — MOVED
      deals/[dealId]/
        page.tsx       — MOVED
      portfolios/
        page.tsx       — MOVED
      portfolios/[portfolioId]/
        page.tsx       — MOVED
      campaigns/
        page.tsx       — MOVED
      campaigns/[campaignId]/
        page.tsx       — MOVED
      import/
        page.tsx       — MOVED
      settings/
        page.tsx       — MOVED (project-level settings: sponsors, CA creds)
      client-view/
        overview/
          page.tsx     — MOVED
        calls/
          page.tsx     — MOVED
  (client)/
    projects/          — NEW: project selector (if multiple sponsorships)
      page.tsx
    projects/[id]/
      layout.tsx       — NEW: client project layout
      overview/
        page.tsx       — MOVED
      calls/
        page.tsx       — MOVED
```

### Proxy (`src/proxy.ts`) changes

```typescript
// Updated route classification:
const isInternalRoute = path.startsWith('/projects')  // covers all internal pages now
const isClientRoute = path.startsWith('/projects')    // client pages also under /projects/[id]/

// New logic:
// - Unauthenticated → /login (unchanged)
// - Authenticated internal on /projects (no id) → stay (project list)
// - Authenticated internal on /login → /projects (was /dashboard)
// - Authenticated client on /login → /projects (project selector or auto-redirect)
// - Authenticated client on /projects without id → stay (project selector)
// - Authenticated client trying /projects/[id] they don't sponsor → redirect to /projects
```

### Page implementations

#### `(internal)/projects/page.tsx` — Project List
- Internal landing page. Grid of project cards.
- Each card: name, description, deal count, campaign count, sponsor count.
- "New Project" button → create dialog (name + description).
- Click card → navigate to `/projects/[id]/dashboard`.
- Card menu: Edit, Duplicate, Delete (with confirmation).

#### `(internal)/projects/[id]/layout.tsx` — Project Context Layout
- Fetches project by ID, stores in React Context.
- Renders **breadcrumb bar**: `Projects > [Project Name]` at top of main content area.
- Sidebar: nav items updated with project-scoped hrefs:
  ```
  /projects/[id]/dashboard
  /projects/[id]/deals
  /projects/[id]/portfolios
  /projects/[id]/campaigns
  /projects/[id]/import
  /projects/[id]/settings
  ```
- "Client View" section:
  ```
  /projects/[id]/client-view/overview
  /projects/[id]/client-view/calls
  ```
- Project name shown in sidebar header or breadcrumb.
- 404/redirect if project doesn't exist or internal user somehow lands on invalid ID.

#### `(internal)/projects/[id]/dashboard/page.tsx` — Project Dashboard
- Same dashboard components (KPIScorecard, FunnelMetrics, ConversionChart, PipelineTable).
- Data fetched with `project_id` filter.
- PageHeader title = project name, description = project description.

#### `(internal)/projects/[id]/deals/page.tsx` — Project Deals
- Existing deals page, scoped to project. Adds `?project_id=` to API calls.

#### `(internal)/projects/[id]/settings/page.tsx` — Project Settings
- Project name/description edit.
- **Sponsor management**: table of current sponsors with remove button. "Add Sponsor" form (email input).
- Gmail connection (existing, works per-user so unchanged).
- Delete project button (danger zone).

#### `(client)/projects/page.tsx` — Client Project Selector
- If client sponsors exactly 1 project: auto-redirect to `/projects/[id]/overview`.
- If client sponsors multiple: show simple project list (cards with project name). Click → `/projects/[id]/overview`.
- If client sponsors none: show "No projects available" empty state.

#### `(client)/projects/[id]/layout.tsx` — Client Project Layout
- Validates client sponsors this project. If not, redirect to `/projects`.
- Sidebar with scoped nav:
  ```
  /projects/[id]/overview  — Active Deals
  /projects/[id]/calls     — Call Queue
  ```
- Breadcrumb: `[Project Name] > Active Deals` (simpler than internal).

#### `(client)/projects/[id]/overview/page.tsx` — Client Active Deals
- Existing ActiveDealsTable, scoped to project.

#### `(client)/projects/[id]/calls/page.tsx` — Client Call Queue
- Existing CallQueueTable, scoped to project.

### Navigation (`src/lib/navigation.ts`) changes

Make nav items functions that take project ID:

```typescript
export function internalNavItems(projectId: string): NavItem[] {
  return [
    { label: 'Dashboard',  icon: LayoutDashboard, href: `/projects/${projectId}/dashboard` },
    { label: 'Deals',      icon: Building2,       href: `/projects/${projectId}/deals` },
    { label: 'Portfolios', icon: FolderKanban,    href: `/projects/${projectId}/portfolios` },
    { label: 'Campaigns',  icon: Megaphone,       href: `/projects/${projectId}/campaigns` },
    { label: 'Import',     icon: Upload,          href: `/projects/${projectId}/import` },
    { label: 'Settings',   icon: Settings,        href: `/projects/${projectId}/settings` },
  ]
}

export function clientNavItems(projectId: string): NavItem[] {
  return [
    { label: 'Active Deals', icon: LayoutDashboard, href: `/projects/${projectId}/overview` },
    { label: 'Call Queue',   icon: Phone,           href: `/projects/${projectId}/calls` },
  ]
}

// Static: project list nav
export const projectsNavItem: NavItem = {
  label: 'Projects', icon: FolderKanban, href: '/projects'
}
```

---

## Phase 4 — Sidebar & Breadcrumb

### Sidebar updates (`src/components/shared/Sidebar.tsx`)

Add optional **breadcrumb prop**:

```typescript
interface SidebarProps {
  // ... existing props
  breadcrumb?: {
    label: string
    href: string
  }[]
}
```

Breadcrumb renders as horizontal trail at top of sidebar (above nav sections):
```
Projects > Heritage Fund I
```

Each segment is a clickable link except the last (current).

### Breadcrumb component (`src/components/shared/Breadcrumb.tsx`)

New shared component for the main content area as well:

```
Projects  /  Heritage Fund I  /  Dashboard
```

Renders at top of each project-scoped page (inside the layout's main content area, above `<main>` children). Uses `var(--color-text-tertiary)` for separators, `var(--color-text-secondary)` for links, `var(--color-text-primary)` for current page.

### Sidebar profile section

Update to show actual user data: fetch `profiles.full_name` and `profiles.role` via `useAuth()` and display in sidebar footer instead of hardcoded "User / Team".

---

## Phase 5 — Data Migration & Seeding

### Approach
Since all data is test data, use **destructive reset**:
1. `supabase db reset` — wipes DB, re-applies all migrations (0001–0022), re-runs seed.
2. Write new `supabase/seed.sql` with project-aware data.

### New seed.sql structure
```sql
-- 1. Create projects
-- 2. Create default field_definitions per project
-- 3. Create test users (unchanged: test-internal@, test-client@)
-- 4. Create sponsor records linking test-client@ to project(s)
-- 5. Create sample campaigns, deals, contacts per project
```

### Default field definitions per project

Each new project gets these default fields auto-created (via API on project create, not just seed):

| key | label | data_type | sort_order | show_in_grid |
|-----|-------|-----------|------------|--------------|
| address | Address | text | 10 | true |
| city | City | text | 20 | true |
| state | State | text | 30 | true |
| zip | ZIP Code | text | 40 | false |
| property_type | Property Type | text | 50 | false |
| building_class | Building Class | text | 60 | false |
| year_built | Year Built | integer | 70 | false |
| property_link | CoStar Link | url | 80 | false |
| listing_type | Listing Type | text | 90 | false |
| source | Source | text | 100 | false |

---

## Phase 6 — Hooks & Data Fetching

### New hooks

#### `useProjects()`
```typescript
// Query key: ['projects']
// GET /api/projects
// Returns list of projects (all for internal, sponsored for client)
```

#### `useProject(id: string)`
```typescript
// Query key: ['projects', id]
// GET /api/projects/[id]
// Returns single project with sponsor list + stats
```

#### `useProjectSponsors(projectId: string)`
```typescript
// Query key: ['projects', projectId, 'sponsors']
// GET /api/projects/[id]/sponsors
```

#### `useCreateProject()`, `useUpdateProject()`, `useDeleteProject()`, `useDuplicateProject()`
```typescript
// Mutations with proper cache invalidation on ['projects']
```

### Modified hooks

#### `useDeals(projectId?: string)`
Add optional projectId. When provided, add `?project_id=` to API call.

#### `useCampaigns(projectId?: string)`
Same pattern.

#### `usePortfolios(projectId?: string)`
Same pattern.

#### `useCallQueue(projectId?: string)`
Same pattern.

### Query key convention
```
['projects']
['projects', id]
['projects', id, 'sponsors']
['projects', id, 'deals']
['projects', id, 'campaigns']
['projects', id, 'portfolios']
['projects', id, 'call_briefs']
```

---

## Phase 7 — Components

### New components

| Component | Location | Purpose |
|---|---|---|
| `Breadcrumb` | `src/components/shared/Breadcrumb.tsx` | Renders `Projects / Name / Page` trail |
| `ProjectCard` | `src/components/projects/ProjectCard.tsx` | Card with name, stats, actions menu |
| `CreateProjectDialog` | `src/components/projects/CreateProjectDialog.tsx` | react-hook-form + zod dialog |
| `DeleteProjectDialog` | `src/components/projects/DeleteProjectDialog.tsx` | Confirmation with cascade warning |
| `DuplicateProjectDialog` | `src/components/projects/DuplicateProjectDialog.tsx` | Name input + confirm |
| `SponsorList` | `src/components/projects/SponsorList.tsx` | Table of sponsors with remove |
| `AddSponsorDialog` | `src/components/projects/AddSponsorDialog.tsx` | Email input, creates user if needed |
| `ProjectSelector` | `src/components/projects/ProjectSelector.tsx` | Client-facing project picker cards |

### Modified components

| Component | Change |
|---|---|
| `Sidebar` | Add `breadcrumb` prop. Accept dynamic nav items per project. |
| `DealTable` | Pass `projectId` through to DataGrid/API calls. |
| `DataGrid` | Accept `projectId` prop for API calls (batch edit, etc.). |
| All dashboard components | Unchanged (accept same data shape, just scoped upstream). |
| `PageHeader` | Unchanged (receives project-scoped title/description from parent). |
| `CoStarImportWizard` | Add `projectId` to import job creation. |
| `ActiveDealsTable` | Accept `projectId` prop. |
| `CallQueueTable` | Accept `projectId` prop. |

---

## Phase 8 — Import Flow

CoStar import wizard already has a 3-step flow. Changes needed:

1. **Upload step**: Add project selector dropdown (for internal users importing into a specific project).
2. **Mapping step**: Field definitions are now project-scoped. `GET /api/field-definitions?project_id=` returns only that project's fields. New field creation during mapping uses the project's field_definitions.
3. **Confirm step**: Import job gets `project_id`. Deals created get `project_id`.

---

## Phase 9 — Settings Page

Project settings page consolidates:

1. **General**: Edit project name, description.
2. **Sponsors**: Table of sponsors with add/remove. Add sponsor flow:
   - Enter email
   - If user exists with role=client → link as sponsor
   - If user doesn't exist → create auth user via admin API (random temp password, force password reset), create profile with role=client, link as sponsor
   - If user exists with role=internal → reject (internal users can't be sponsors)
3. **Field Definitions**: Manage custom fields for this project (existing field-definitions management, now project-scoped).
4. **Danger Zone**: Delete project button with cascade warning.

---

## Phase 10 — Hardcoded Data Remediation

Opportunity to fix known issues during restructure:

1. **Sidebar profile**: Replace hardcoded "User / Team" with actual `profiles.full_name` and role badge from `useAuth()`.
2. **Nav icons**: Fix placeholder `LayoutDashboard` icons — use proper Lucide icons (already partially done in internal layout).
3. **`next-themes` removal**: Not in scope of this revamp but note in code comments.

---

## Execution Order

```
Phase 1  → Database migrations (0019–0022) + seed.sql rewrite + db reset
Phase 2  → API routes (new project/sponsor routes + modify all existing routes)
Phase 3  → Frontend page restructure (new route groups, move existing pages)
Phase 4  → Sidebar + Breadcrumb components
Phase 5  → Run db reset, verify seed data works
Phase 6  → Hooks (new + modified)
Phase 7  → Project components (cards, dialogs, sponsor management)
Phase 8  → Import flow project awareness
Phase 9  → Settings page consolidation
Phase 10 → Hardcoded data fixes
```

### Critical dependency chain
```
Migration → Seed → API routes → Hooks → Pages → Components
                \→ Proxy update (parallel with Pages)
```

---

## Risks & Notes

1. **All existing URLs break**. `/dashboard` → `/projects/[id]/dashboard`. Need redirects from old paths or accept clean break (test data, no production users).
2. **RLS complexity**: Client deal visibility now requires a join through `sponsors` table. Test RLS policies thoroughly with both roles.
3. **`field_definitions` becoming project-scoped**: Existing import mapping logic assumes global field definitions. Must update to project-scoped lookups.
4. **No middleware.ts**: Proxy handles all routing. Ensure `projects` path prefix is correctly classified.
5. **Client signup flow**: Currently standalone. New sponsor invite flow (internal invites client by email) needs an invite token or magic link pattern to auto-associate sponsor record.
6. **Deal batch operations**: `PATCH/DELETE /api/deals/batch` must validate all deal IDs share an accessible project (or at minimum, each deal's project is accessible to the user).
