# Database & Frontend Restructuring — Column Rationalization

## Overview

Restructure the system so only explicitly listed columns are permanent in the database. Everything else (deal_name, unit_count, address, city, state, zip, etc.) becomes dynamic `deal_fields`. Restructure the frontend so the "Leads" and "Deals" views show different, well-defined column sets drawn from the `deals` table, `underwriting` table, `document_checklist`, `loi_records`, and `deal_fields`.

## Current State

**Permanent columns on `deals` table** (18 columns): `id`, `project_id`, `campaign_id`, `portfolio_id`, `deal_name`, `outreach_emails`, `unit_count`, `stage`, `score`, `is_archived`, `archive_reason`, `drive_folder_url`, `internal_notes`, `last_contacted_at`, `import_batch`, `created_by`, `created_at`, `updated_at`

**`DealTable.tsx`** renders 7 hardcoded columns (deal_name, unit_count, stage, score, campaign, portfolio, created_at) + dynamic columns from `field_definitions` where `show_in_grid = true`.

**`deals` API** has `SORT_COLUMNS` mapping `deal_name` and `unit_count` to the `deals` table directly.

**Import system** has special "system" mapping actions for `deal_name` and `unit_count`.

## Target State

### Permanent Columns on `deals` Table

Keep only these columns on `deals` (everything else → dynamic `deal_fields`):

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | System |
| `project_id` | uuid FK | System (multi-tenant scoping) |
| `campaign_id` | uuid FK | System (import grouping) |
| `portfolio_id` | uuid FK | System; displayed as "Portfolio" in tables |
| `stage` | deal_stage | Displayed in both Leads and Deals tables |
| `score` | deal_score | System (RLS filtering for clients); NOT displayed in either table |
| `is_archived` | boolean | System (RLS filtering) |
| `archive_reason` | text | System |
| `outreach_emails` | text[] | System (email targets) |
| `drive_folder_url` | text | System (Google Drive integration) |
| `internal_notes` | text | System |
| `last_contacted_at` | timestamptz | System (derived from activity_log) |
| `last_email_sent_on` | timestamptz | **NEW** — displayed as "Last Email Sent On" in Leads table |
| `response_type` | text | **NEW** — displayed as "Response Type" in Leads table; denormalized from most recent email_outreach.response_classification |
| `import_batch` | text | System (import dedup) |
| `created_by` | uuid FK | System |
| `created_at` | timestamptz | Displayed as "Date Added" in Leads table |
| `updated_at` | timestamptz | System |

**Removed from `deals` table** (migrated to `deal_fields`):
- `deal_name` → field_definition key=`deal_name`, label=`Deal Name`
- `unit_count` → field_definition key=`unit_count`, label=`Units`

`score` stays as a system column (RLS depends on it) but is NOT displayed in either frontend table.

### New Permanent Columns on `underwriting` Table

The following need to be added to `underwriting` (migration). Columns marked ✓ already exist:

| Column | Type | Exists? | Displayed In |
|--------|------|---------|-------------|
| `underwritability_status` | underwritability enum | ✓ | Evaluate Underwritability |
| `asking_price` | numeric(15,2) | ✓ | Eval + Summary |
| `price_per_unit` | numeric(12,2) | ✓ | Eval + Summary |
| `population_1mi` | int | ✓ | Evaluate Underwritability |
| `population_growth_pct` | numeric(6,3) | ✓ | Evaluate Underwritability |
| `vacancy_rate_pct` | numeric(6,3) | ✓ | Evaluate Underwritability |
| `market_price_per_unit` | numeric(12,2) | ✓ | Evaluate Underwritability |
| `delta_pct` | numeric(6,3) | ✓ | Evaluate Underwritability |
| `cap_rate` | numeric(6,3) | ✓ | Eval + Summary |
| `purchase_price` | numeric(15,2) | ✓ | Underwriting Summary |
| `capex` | numeric(15,2) | ✓ | Underwriting Summary |
| `irr_pct` | numeric(6,3) | ✓ | Underwriting Summary |
| `equity_multiple` | numeric(6,3) | ✓ | Underwriting Summary |
| `cash_on_cash_pct` | numeric(6,3) | ✓ | Underwriting Summary |
| `profit` | numeric(15,2) | ✓ | Underwriting Summary |
| `occupancy_pct` | numeric(6,3) | ✓ | Underwriting Summary |
| `proceed_with_loi` | boolean | ✓ | Underwriting Summary |
| **`rent_growth_12mo_pct`** | numeric(6,3) | **NEW** | Evaluate Underwritability |
| **`rent_growth_fwd_pct`** | numeric(6,3) | **NEW** | Evaluate Underwritability |
| **`sale_rent_comps`** | text | **NEW** | Evaluate Underwritability |

Note: existing `rent_growth_pct` column is SPLIT into two: `rent_growth_12mo_pct` (Rent Growth % 12 Mo) and `rent_growth_fwd_pct` (Rent Growth % Forecast). The old column is dropped after migration.

### New Permanent Columns on `loi_records` Table

| Column | Type | Exists? | Displayed In |
|--------|------|---------|-------------|
| `outcome` | loi_outcome enum | ✓ | LOI Related (as "LOI Status") |
| **`insurance_declarations`** | boolean | **NEW** | LOI Related |
| **`vendor_service_contracts`** | boolean | **NEW** | LOI Related |
| **`utility_bills`** | boolean | **NEW** | LOI Related |
| **`email_for_loi`** | text | **NEW** | LOI Related |
| **`last_email_for_loi_sent_on`** | timestamptz | **NEW** | LOI Related |

### Document Checklist (No Schema Change)

`document_checklist` is already a flexible row-per-document model. The default checklist items seeded by `seed_default_checklist()` should be updated to include:

- P&L (exists)
- **P&L Date** — NEW (stored as `metadata` JSON on the P&L row: `{ "doc_date": "..." }`)
- Rent Roll (exists)
- **Rent Roll Date** — NEW (stored as `metadata` on the Rent Roll row)
- OM (exists)
- Tax Bill (exists)
- CAPEX Schedule (exists)
- Market Reports 1-4 (exist)
- **Deal Room Link** — NEW (new doc_name row with `metadata: { "link": "..." }`)

### Frontend Column Sets

**Leads Table** (deals WHERE stage IN ('lead', 'outreach', 'response')):

| Column | Source | Notes |
|--------|--------|-------|
| Stage | `deals.stage` | Color-coded badge |
| Portfolio | `portfolios.name` | Via join |
| Date Added | `deals.created_at` | Formatted date |
| Last Email Sent On | `deals.last_email_sent_on` | NEW permanent column |
| Response Type | `deals.response_type` | NEW permanent column |
| *(imported dynamic columns)* | `deal_fields` + `field_definitions` | All where `show_in_grid = true` |

**Deals Table** (deals WHERE stage IN ('underwriting', 'loi', 'closed', 'failed')):

All Leads columns PLUS:

*Document Inventory (from `document_checklist`)*:
- P&L, P&L Date, Rent Roll, Rent Roll Date, OM, Tax Bill, CAPEX, 4 Market Reports, Deal Room Link

*Evaluate Underwritability (from `underwriting`)*:
- Asking Price, Price/Unit, Population (1-Mile), Population Growth %, Rent Growth % (12 Mo), Rent Growth % (Forecast), Vacancy Rate %, Market Price/Unit, Delta % (Market Vs Subject), Cap Rate, Underwritable?, Sale & Rent Comps

*Underwriting Summary (from `underwriting`)*:
- Asking Price, Price/Unit, Purchase Price, Price/Unit, CAPEX, Occupancy %, IRR, EM, CoC, Profit, Proceed with LOI?

*LOI Related (from `loi_records`)*:
- Insurance Declarations, Vendor/Service Contracts, Utility Bills, Email for LOI, Last Email for LOI Sent On, LOI Status

### Implementation Plan

#### Phase 1: Database Migration (new migration 0024)

1. **Create field_definitions for deal_name and unit_count** — INSERT INTO field_definitions for all existing projects (with appropriate `project_id`).

2. **Backfill deal_fields** — For every deal, create `deal_fields` rows for `deal_name` and `unit_count` by reading the existing values from the `deals` table.

3. **Add new columns to `deals`**:
   ```sql
   ALTER TABLE deals ADD COLUMN last_email_sent_on timestamptz;
   ALTER TABLE deals ADD COLUMN response_type text;
   ```

4. **Add new columns to `underwriting`**:
   ```sql
   ALTER TABLE underwriting ADD COLUMN rent_growth_12mo_pct numeric(6,3);
   ALTER TABLE underwriting ADD COLUMN rent_growth_fwd_pct numeric(6,3);
   ALTER TABLE underwriting ADD COLUMN sale_rent_comps text;
   ```

5. **Backfill new underwriting columns** — Migrate existing `rent_growth_pct` → `rent_growth_12mo_pct` (best-effort; `rent_growth_fwd_pct` left null).

6. **Drop old columns**:
   ```sql
   ALTER TABLE deals DROP COLUMN deal_name;
   ALTER TABLE deals DROP COLUMN unit_count;
   ALTER TABLE underwriting DROP COLUMN rent_growth_pct;
   ```

7. **Add new columns to `loi_records`**:
   ```sql
   ALTER TABLE loi_records ADD COLUMN insurance_declarations boolean DEFAULT false;
   ALTER TABLE loi_records ADD COLUMN vendor_service_contracts boolean DEFAULT false;
   ALTER TABLE loi_records ADD COLUMN utility_bills boolean DEFAULT false;
   ALTER TABLE loi_records ADD COLUMN email_for_loi text;
   ALTER TABLE loi_records ADD COLUMN last_email_for_loi_sent_on timestamptz;
   ```

8. **Update `seed_default_checklist()` function** to include Deal Room Link doc.

9. **Update RLS policies** if needed (existing policies should cover new columns on existing tables).

#### Phase 2: API Layer Changes

**`GET /api/deals` (src/app/api/deals/route.ts):**
- Remove `deal_name` and `unit_count` from `SORT_COLUMNS`
- Add `last_email_sent_on` and `response_type` to sort columns
- Remove `deal_name`-based search (search will need to go through `deal_fields` instead, or be removed temporarily)
- Include `underwriting` join expanded to include new columns
- Include `loi_records` join (currently not joined in list endpoint — needs to be added)
- Include `document_checklist` aggregation (currently not in list endpoint — needs to be added)
- Include `last_email_sent_on` and `response_type` in SELECT

**`PATCH /api/deals/[id]` (src/app/api/deals/[id]/route.ts):**
- Remove `deal_name` from `patchDealSchema` (it's now a field, updated via `/api/deals/[id]/fields`)
- Remove `unit_count` from `patchDealSchema` (now a field)
- Remove `price_per_unit` recalculation on `unit_count` change (no longer directly available)
- Add `last_email_sent_on` and `response_type` to patchable fields

**`GET /api/deals/[id]` (same file):**
- Remove `deal_name` from response (now in deal_fields)
- Keep `unit_count` in deal_fields
- Include `loi_records` join with new columns

**`POST /api/deals` (src/app/api/deals/route.ts):**
- Remove `deal_name` from `createDealSchema` — deals are created with a system-generated name or the first mapped field becomes the display name
- Remove `unit_count` from `createDealSchema`
- `deal_name` and `unit_count` come through `deal_fields` on create

**`PATCH /api/deals/[id]/fields` (src/app/api/deals/[id]/fields/route.ts):**
- No schema changes needed — it already accepts arbitrary field keys

**Import system changes:**

**`src/lib/validations/import.schema.ts`:**
- Remove `{ action: 'system', field: 'deal_name' }` from the discriminated union
- Remove `{ action: 'unit_count' }` from the discriminated union
- Both become standard `{ action: 'field', key: 'deal_name' }` / `{ action: 'field', key: 'unit_count' }` mappings (or `new_field` if those field_definitions don't exist yet)

**`src/app/api/deals/import/[batchId]/mapping/route.ts`:**
- Remove system/unit_count handling
- `deal_name` and `unit_count` are treated like any other field mapping

**`src/app/api/deals/import/[batchId]/confirm/route.ts`:**
- Remove special handling for `deal_name` on the `deals` insert — the insert no longer has a `deal_name` column
- Remove special handling for `unit_count` on the `deals` insert
- Both are written to `deal_fields` via the standard field resolution path

**`src/lib/import/mapping.ts`:**
- Remove `unit_count` validation (the "only one unit_count column" check)
- Remove references to `{ action: 'system' }` and `{ action: 'unit_count' }` in types

#### Phase 3: Frontend Changes

**`src/components/deals/DealTable.tsx` — Complete redesign:**

Current: 7 hardcoded columns + dynamic fields.  
New: Column set determined by a `view` prop (`'leads' | 'deals'`).

**Leads view columns** (hardcoded):
1. `stage` — from `deals.stage`, renders as Badge
2. `portfolio` — from `portfolios.name`, accessor
3. `created_at` — from `deals.created_at`, formatted date, header "Date Added"
4. `last_email_sent_on` — from `deals.last_email_sent_on`, formatted date, header "Last Email Sent On"
5. `response_type` — from `deals.response_type`, header "Response Type"
6. *(dynamic columns from deal_fields where show_in_grid=true)*

**Deals view columns** (all Leads columns + additional groups):

7-15. **Document Inventory** — columns built from `document_checklist` rows. For each deal, the deal's checklist rows are flattened into column values:
  - P&L (collected boolean → "Yes"/"—")
  - P&L Date (from metadata)
  - Rent Roll (collected)
  - Rent Roll Date (from metadata)
  - OM (collected)
  - Tax Bill (collected)
  - CAPEX (collected)
  - Market Reports (count of collected / 4)
  - Deal Room Link (from metadata, renders as link or "—")

16-27. **Evaluate Underwritability** — columns from `underwriting` table:
  - `asking_price`, `price_per_unit`, `population_1mi` (header "Population (1-Mile)"), `population_growth_pct` (header "Population Growth %"), `rent_growth_12mo_pct` (header "Rent Growth % (12 Mo)"), `rent_growth_fwd_pct` (header "Rent Growth % (Forecast)"), `vacancy_rate_pct` (header "Vacancy Rate %"), `market_price_per_unit` (header "Market Price/Unit"), `delta_pct` (header "Delta % (Market Vs Subject)"), `cap_rate` (header "Cap Rate"), `underwritability_status` (header "Underwritable?"), `sale_rent_comps` (header "Sale & Rent Comps")

28-38. **Underwriting Summary** — columns from `underwriting` table:
  - `asking_price` (header "Asking Price"), `price_per_unit` (header "Price/Unit"), `purchase_price` (header "Purchase Price"), `purchase_price_per_unit` (header "Price/Unit"), `capex` (header "CAPEX"), `occupancy_pct` (header "Occupancy %"), `irr_pct` (header "IRR"), `equity_multiple` (header "EM"), `cash_on_cash_pct` (header "CoC"), `profit` (header "Profit"), `proceed_with_loi` (header "Proceed with LOI?")

39-44. **LOI Related** — columns from `loi_records` table:
  - `insurance_declarations` (header "Insurance Declarations"), `vendor_service_contracts` (header "Vendor/Service Contracts"), `utility_bills` (header "Utility Bills"), `email_for_loi` (header "Email for LOI"), `last_email_for_loi_sent_on` (header "Last Email for LOI Sent On"), `outcome` (header "LOI Status")

**Important**: The API must return ALL this data for the list endpoint, or the DealTable must fetch supplementary data. The `GET /api/deals` endpoint should include:
- `underwriting` join (expanded to include all new columns)
- `loi_records` join
- `document_checklist` aggregation (grouped by deal_id)

**DataGrid column definitions:**

For boolean checklist columns: render as checkmark or "—". For numeric columns: right-aligned, monospace, formatted with commas and decimals. For percentage columns: formatted as `XX.X%`. For date columns: `date-fns` format.

**`src/app/(internal)/deals/page.tsx` and `src/app/(internal)/projects/[id]/deals/page.tsx`:**
- Add stage filtering: a tab or Select that toggles between "Leads" (stages lead/outreach/response) and "Deals" (stages underwriting/loi/closed/failed)
- Pass `view` prop to DealTable
- The API call already supports `?stage=` — add stage filter params based on the active view
- Default view: "Leads" (since that's where new imports land)

**Import auto-detection (`CoStarImportWizard.tsx`):**
- Remove `detectAction` cases for `{ action: 'system', field: 'deal_name' }` and `{ action: 'unit_count' }`
- Replace with: if header matches deal name patterns → `{ action: 'field', key: 'deal_name' }` (expects deal_name field_definition to exist)
- If header matches unit patterns → `{ action: 'field', key: 'unit_count' }`
- The `buildDefaultMapping` fallback (first column → deal_name) stays but uses `{ action: 'field', key: 'deal_name' }`

**Import preview mapping dropdown:**
- Remove "Deal Name" and "Unit Count" from system actions in the Select
- They appear in "Existing fields" section (as deal_name and unit_count field_definitions)

#### Phase 4: Seed Data & Type Updates

**`supabase/seed.sql`:**
- Remove `deal_name` and `unit_count` from deal INSERTs
- Add `deal_name` and `unit_count` as deal_field values instead
- Add default `field_definitions` for `deal_name` and `unit_count` if not already present
- Update seed checklist items to include Deal Room Link

**`src/lib/supabase/types.ts`:**
- Update `deals` Row type: remove `deal_name`, `unit_count`; add `last_email_sent_on`, `response_type`
- Update `underwriting` Row type: add `rent_growth_12mo_pct`, `rent_growth_fwd_pct`, `sale_rent_comps`; remove `rent_growth_pct`
- Update `loi_records` Row type: add 5 new columns

**`src/lib/hooks/useDeals.ts`:**
- Remove references to `deal_name` and `unit_count` from the select if used

#### Phase 5: Data Integrity

**Denormalization trigger or API logic for `last_email_sent_on` and `response_type`:**
- When an email_outreach record is updated (sent, replied), update `deals.last_email_sent_on` = `MAX(email_outreach.sent_at)` and `deals.response_type` = most recent `email_outreach.response_classification`
- Can be done via: (a) a Postgres trigger on `email_outreach`, or (b) in the email send API route after sending, or (c) a cron/scheduled function
- Recommended: API-level update in the email send route (simpler, no migration complexity). When sending an email via `POST /api/emails/send`, after successful send, update `deals.last_email_sent_on = NOW()`.

**Full-text search migration:**
- The `deals_search_idx` GIN index was dropped when `address`, `city`, `state` columns were removed (migration 0016). The current search uses `ilike` on `deal_name`.
- After `deal_name` is removed, search needs to use `deal_fields` instead. Options:
  - (a) Create a new GIN index on a generated column that concatenates deal_field values for display fields
  - (b) Remove text search from the list API and handle it client-side
  - (c) Search via `deal_fields` join with `ilike`
- Recommended: option (c) — add a subquery that filters deal IDs by matching `deal_fields.value ilike '%search%'` for text-type field_definitions. Accept the performance tradeoff for now.

### Files to Touch

| File | Change |
|------|--------|
| **Database** | |
| `supabase/migrations/0024_column_rationalization.sql` | **New** — full migration (see Phase 1) |
| `supabase/seed.sql` | Update deal INSERTs, field_definitions, seed_default_checklist calls |
| **API Layer** | |
| `src/app/api/deals/route.ts` | Remove deal_name/unit_count from schema, sort, search. Add new columns to SELECT + underwriting/loi/doc joins |
| `src/app/api/deals/[id]/route.ts` | Remove deal_name/unit_count from patch schema. Add new columns |
| `src/app/api/deals/import/[batchId]/mapping/route.ts` | Remove system/unit_count special handling |
| `src/app/api/deals/import/[batchId]/confirm/route.ts` | Remove deal_name/unit_count from deals INSERT |
| `src/app/api/emails/send/route.ts` | Update deals.last_email_sent_on after send |
| `src/lib/validations/import.schema.ts` | Remove system and unit_count from discriminated union |
| `src/lib/validations/deal.schema.ts` | Update createDealSchema, patchDealSchema |
| `src/lib/import/mapping.ts` | Remove system/unit_count from types and validation |
| `src/lib/supabase/types.ts` | Update Row types for deals, underwriting, loi_records |
| **Frontend** | |
| `src/components/deals/DealTable.tsx` | Complete redesign — view-based column sets |
| `src/app/(internal)/deals/page.tsx` | Add Leads/Deals view toggle, stage filter |
| `src/app/(internal)/projects/[id]/deals/page.tsx` | Add Leads/Deals view toggle, stage filter |
| `src/components/import/CoStarImportWizard.tsx` | Update detectAction, buildDefaultMapping |
| `src/components/import/ImportPreviewTable.tsx` | Remove system/unit_count from dropdown |
| `src/lib/hooks/useDeals.ts` | Remove deal_name/unit_count references |

### Constraints

- Do NOT break RLS policies — `score` and `is_archived` stay as permanent columns
- Do NOT break the stage machine — `canTransition()` is unchanged
- Do NOT break Google Drive integration — `drive_folder_url` stays
- Do NOT break the import execution pipeline — only change what fields get written where
- All existing CSS variable token usage must be maintained (`var(--color-*)`)
- Tailwind v4 conventions maintained (no `tailwind.config.ts`, no palette colors)

### Verification Checklist

1. `npx tsc --noEmit` — zero new errors
2. `npm run lint` — zero new errors in touched files
3. `npm run db:reset` succeeds (migration + seed work)
4. Create a deal via API with deal_fields for deal_name and unit_count
5. Import an Excel file — all columns map correctly, no system/unit_count options in dropdown
6. Leads table shows correct columns, Deals table shows correct columns
7. Stage filter toggles between views correctly
8. Underwriting and LOI columns display correctly for deals in later stages
