# DataGrid & Deal Table Technical Specification

This document serves as the absolute, exhaustive specification for the core table architecture of the Acquisition Platform, primarily encompassing the `DataGrid` (the reusable underlying primitive) and the `DealTable` (the concrete implementation used for pipeline management). It is engineered to handle "Excel-like" data density and interactions.

---

## 1. Architectural Philosophy

The table must feel as responsive and data-dense as a native spreadsheet application like Excel or CoStar's proprietary grid. To achieve this, standard HTML `<table>` rendering is abandoned in favor of a `div`-based, absolutely positioned, virtualized grid. 

### Core Dependencies
*   **Virtualization:** `@tanstack/react-virtual` must be used for both row and column virtualization to support thousands of deals without DOM bloat or frame drops.
*   **Icons:** `lucide-react` (ChevronUp, ChevronDown, Settings, Search, MoreHorizontal, Building2).

---

## 2. Base DataGrid Primitive (`shared/DataGrid.tsx`)

The `DataGrid` is the unopinionated underlying engine. It accepts a highly structured configuration of columns and data, handling the complex rendering math.

### 2.1 Dimensional Metrics & Layout
*   **Header Height:** `36px` (Fixed).
*   **Row Height:** `40px` (Fixed). Variable height rows are not supported to optimize virtualization performance.
*   **Footer Height:** `32px` (Fixed).
*   **Scrollbars:** Custom `6px` width/height transparent track with a `var(--color-surface-3)` thumb. 

### 2.2 Styling & Theming System
All colors must be bound to a localized styling object (e.g., `const S = { ... }`) that maps explicitly to `globals.css` variables. No raw color strings or Tailwind color classes are allowed.

#### Backgrounds & Borders
*   **Header Background:** `var(--color-surface-1)`
*   **Header Border Bottom:** `1px solid var(--color-surface-2)`
*   **Row - Even Background:** `var(--color-surface-0)`
*   **Row - Odd Background:** `var(--color-surface-1)`
*   **Row Border Bottom:** `1px solid var(--color-surface-2)`
*   **Footer Background:** `var(--color-surface-1)`
*   **Footer Border Top:** `1px solid var(--color-surface-2)`

#### Typography
*   **Header Text:** `var(--color-text-secondary)`. `font-size: 11px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.04em`.
*   **Cell Text:** `var(--color-text-primary)`, `font-size: 13px`. Numbers (units, currency, dates) MUST use `font-family: 'JetBrains Mono', monospace` for tabular lining.

### 2.3 Interaction States
*   **Row Hover:** `background-color: var(--color-accent-bg)`. Must transition using `background-color 150ms ease`.
*   **Row Selection (Active State):** When a checkbox is ticked, the entire row background becomes `var(--color-accent-bg)` and a left border of `2px solid var(--color-accent)` is applied to the first column cell of that row.

### 2.4 Column Resizing Logic
Users must be able to drag column headers to resize them, exactly like Excel.
*   **Hitbox:** A `4px` wide invisible absolute positioned `div` on the right edge of each header cell.
*   **Visual Handle:** A `2px` wide visible indicator inside the hitbox. 
*   **Idle State:** `background-color: var(--color-surface-3)`.
*   **Drag State (Active):** `background-color: var(--color-accent)`.
*   **Implementation:** Triggered via `onMouseDown` on the handle. An invisible overlay should cover the screen during the drag to capture `mousemove` and `mouseup` events at the `document` level to prevent the cursor from losing the drag context if moved too fast.

### 2.5 Loading Skeleton State
When data is fetching, the grid renders a skeleton layout.
*   **Layout:** 5 placeholder rows mimicking the standard 40px row height.
*   **Animation:** A `linear-gradient` shimmer from `var(--color-surface-1)` to `var(--color-surface-2)` and back.
*   **Speed & Dimensions:** `1.4s ease-in-out infinite`. The width of the shimmer band should be `40%`.

---

## 3. The Concrete Implementation (`deals/DealTable.tsx`)

The `DealTable` mounts the `DataGrid` and wraps it with business logic, filtering, and API connectivity.

### 3.1 Column Specification
By default, the following columns are rendered. 

1.  **Selection (Checkbox):** Fixed width `40px`. Leftmost column. Used for bulk actions.
2.  **Property Name:** Maps to `deal.deal_name`. Max width `w-64` (truncated with ellipsis). Clicking the name navigates to `/deals/[id]`.
3.  **Address:** Maps to `address, city, state`. Rendered as a single line, `text-sm`, `var(--color-text-secondary)`.
4.  **Units:** Maps to `unit_count`. Right-aligned. Font: `JetBrains Mono`. Renders `—` if null.
5.  **Stage:** Renders the `<DealStageBar inline pill />` component showing the stage name in a colored badge.
6.  **Score:** Renders the `<DealScoreBadge />` component.
7.  **Campaign:** Maps to `campaign.name`. Text color `var(--color-text-secondary)`.
8.  **Date Added:** Maps to `created_at`. Formatted as "MMM d, yyyy" (e.g., "May 14, 2026") using `date-fns`. Font: `JetBrains Mono`.
9.  **Actions:** Fixed width `48px`. Rightmost column. Contains a kebab menu (`MoreHorizontal` icon).

### 3.2 Column Visibility Toggle
*   **UI Trigger:** A gear (`Settings` icon) button located at the top-right of the table header.
*   **Interaction:** Opens a Shadcn Popover containing a list of checkboxes for every available column.
*   **Persistence:** The visible column array must be serialized to `localStorage` under the key `dealTableColumns`. The table must read this synchronously on mount to prevent layout shift.

### 3.3 Sorting Mechanics
*   **Trigger:** Clicking the column header text.
*   **Indicator:** A small `ChevronUp` or `ChevronDown` icon appears next to the sorted column's name.
*   **Default:** `created_at DESC` (Newest deals first).

### 3.4 Filter Bar Architecture (Above Table)
A dense flex-wrap container mapping complex states to the Supabase API query.
*   **Search Box:** Text input with a `Search` icon. Requires a **300ms debounce**. Calls the Supabase `.textSearch()` function using `type: 'websearch'` against the `pg_trgm` generated text index.
*   **Campaign:** Multi-select Shadcn `<Select>`. Default: "All campaigns".
*   **Stage:** Multi-select Shadcn `<Select>`. Default: "All stages".
*   **Score:** Multi-select Shadcn `<Select>`. Default: "All scores".
*   **State:** Multi-select Shadcn `<Select>`. Dynamically populated by a distinct query of available states in the database.
*   **Listing Type:** Single select. "All" | "On Market" | "Off Market".

### 3.5 Pagination
*   **Limit:** Hardcoded to 50 rows per page.
*   **Footer Display:** Renders a string exact to: `"Showing 1–50 of 234 deals"`.
*   **Controls:** "Prev" and "Next" buttons. Disabled when out of bounds.

### 3.6 Actions & Row Interactions
*   **Row Click:** Clicking anywhere on the row (excluding the Checkbox or Actions cell) triggers an immediate Next.js router navigation to `/deals/[id]`.
*   **Actions Kebab Menu:**
    *   **View:** Navigates to `/deals/[id]`.
    *   **Archive:** Opens a confirmation `<Dialog>`. Requires user to input an `archive_reason`. On confirm, sends `PATCH /api/deals/[id] { is_archived: true, archive_reason }`.
    *   **Delete:** Opens a destructive confirmation `<Dialog>`. Warning text must indicate permanent loss. On confirm, sends `DELETE /api/deals/[id]`.
*   **Bulk Actions Bottom Bar:** When 1 or more row checkboxes are selected, a fixed/sticky bottom bar slides up.
    *   Text: `"[N] selected"`
    *   Buttons: `[Archive Selected]` and `[Clear Selection]`.

### 3.7 Empty State
If the API returns 0 rows (and no search/filters are active), the table unmounts and renders the `EmptyState` component.
*   **Icon:** `Building2`
*   **Title:** "No deals found"
*   **Description:** "Import properties from CoStar to get started"
*   **Call to Action:** Primary button reading "Import from CoStar" which routes to `/import`. 
*(Note: If filters ARE active, the CTA should instead read "Clear Filters" and clear the state array).*
