# Acquisition Platform — UI/UX Technical Specification

## 1. Design Philosophy
The Acquisition Platform utilizes a premium, data-dense interface. The design language favors structured layouts, subtle contrast, and refined typography to handle complex multifamily property data. It features a custom light/dark mode implementation relying heavily on CSS variables mapped to specific semantic tokens.

---

## 2. Global Styling & Foundation
### 2.1 Base Metrics
- **Base Font Size:** `13px` (optimized for data-heavy tables and forms).
- **Line Height:** `1.6`.
- **Border Radius System:**
  - Small (`sm`): `4px`
  - Medium (`md`): `6px`
  - Large (`lg`): `10px`
  - Extra Large (`xl`): `14px`
- **Scrollbars:** Custom `6px` width/height, transparent track, surface-colored thumb (`var(--color-surface-3)`).

### 2.2 Typography
- **Display:** `Instrument Serif`, Georgia, serif (used for high-impact headings or brand elements).
- **Sans-Serif:** `DM Sans`, -apple-system, sans-serif (primary application font).
- **Monospace:** `JetBrains Mono`, 'Fira Code', monospace (used specifically for tabular numbers like unit counts and dates).

### 2.3 Animation & Transitions
- **Fast:** `80ms ease`
- **Base:** `150ms ease` (standard for button hovers, link highlights, and hover rows).
- **Slow:** `250ms ease` (used for sidebar collapsing and drawer animations).
- **Sidebar Easing:** `cubic-bezier(0.4, 0, 0.2, 1)`

---

## 3. Color System & Theming
The platform relies on a sophisticated variable-based color system (`globals.css`). The `.dark` class triggers the theme switch.

### 3.1 Background & Surfaces
- **Canvas (Background):** Light: `#F7F5F0`, Dark: `#111110`
- **Surface 0 (Cards/Popovers):** Light: `#FFFFFF`, Dark: `#191918`
- **Surface 1 (Muted/Hover):** Light: `#F2F0EB`, Dark: `#222220`
- **Surface 2 (DataGrid borders/rows):** Light: `#E8E5DE`, Dark: `#2C2C2A`
- **Surface 3 (Borders/Inputs):** Light: `#D9D5CC`, Dark: `#3A3A38`

### 3.2 Text
- **Primary:** Light: `#1A1814`, Dark: `#F0EDE8`
- **Secondary:** Light: `#6B6560`, Dark: `#9B9690`
- **Tertiary:** Light: `#9B9690`, Dark: `#6B6560`
- **Inverse:** Light: `#F7F5F0`, Dark: `#1A1814`

### 3.3 Accent & Semantic Colors
- **Accent (Primary Brand):** `#C8963C` (Gold)
- **Success:** Solid `#2D8B24`, Bg `#EAF4E8`, Border `#A8D8A0`, Text `#1E6B18`
- **Warning:** Solid `#C8963C`, Bg `#FBF4E6`, Border `#E8C87A`, Text `#8A5C00`
- **Danger:** Solid `#C42B2B`, Bg `#FBE9E9`, Border `#F0A8A8`, Text `#8B1E1E`
- **Info:** Solid `#2461B8`, Bg `#EAF1FB`, Border `#A8C8F0`, Text `#1A4F8A`

### 3.4 Deal Scoring Specific Colors
Used heavily in `DealScoreBadge` mapping to `deal.score`:
- **Very Good (`score-vg`):** Text `#1E6B18` / Bg `#EAF4E8` / Border `#A8D8A0`
- **Good (`score-g`):** Text `#146B52` / Bg `#E8F4F0` / Border `#A0D8C8`
- **Bad (`score-b`):** Text `#8A5C00` / Bg `#FBF4E6` / Border `#E8C87A`
- **Very Bad (`score-vb`):** Text `#8B1E1E` / Bg `#FBE9E9` / Border `#F0A8A8`

---

## 4. Layout Architecture (`(internal)/layout.tsx`)
### 4.1 Desktop Sidebar
- **Width:** `220px` expanded, `52px` collapsed.
- **Theme:** Strictly dark mode, even when the rest of the app is light mode (Background: `#0E0E0E`, Border: `#1A1A1A`).
- **Brand Logo:** "◆ Acquire" with the diamond mark colored in the accent gold (`#C8963C`).
- **Navigation Items:** `13px` text, height `34px`. Active state applies a `#242424` background and `#F7F5F0` text weight 500.
- **User Profile Menu:** Collapsible bottom widget. Renders a popup menu (`bottom-full`) with `#191918` background and `shadow-lg`. Sign out button uses danger color `#F08080`.

### 4.2 Mobile Layout
- **Header:** `48px` fixed header with hamburger menu.
- **Drawer:** Off-canvas sidebar, `280px` wide, overlaid with a backdrop blur `rgba(0,0,0,0.5)`.
- **Main Content Area:** Padding system heavily leans on `pt-8 px-8 pb-8` for desktop, scaling down to `px-4 pt-14` on mobile.

---

## 5. Core Core Primitives (Shadcn customized)
### 5.1 Buttons (`ui/button.tsx`)
- Customized height and padding for data-density. 
- **Sizes:** 
  - `default`: `h-[34px] px-[14px] text-[13px]` (Overrides standard Tailwind `h-10`).
  - `sm`: `h-[28px] px-[10px] text-[12px]`
  - `lg`: `h-10 px-[18px] text-[14px]`
  - `icon`: `h-[34px] w-[34px]`
- **Variants:** `default` (primary), `destructive`, `outline`, `secondary`, `ghost`, `link`. Includes a click animation: `active:scale-[0.98]`.

### 5.2 Inputs & Forms (`ui/input.tsx`)
- Standard input overrides: `h-9`, `text-sm`, `border-input`, `rounded-md`.
- Inherits focus states via `focus-visible:ring-1 focus-visible:ring-ring`.

### 5.3 Badges (`ui/badge.tsx`)
- Deeply customized to match the semantic coloring system. 
- **Sizes:** `md` (`px-[6px] py-[2px] text-[11px]`), `sm` (`px-[4px] py-px text-[10px]`).
- **Variants:** Maps directly to `success`, `warning`, `danger`, `info`, `neutral`, `accent`, and specific score variants (`score-vg`, `score-g`, `score-b`, `score-vb`).
- **Prop:** Supports an optional `dot` boolean prop that renders a 6px inline dot next to text.

---

## 6. Complex Components

### 6.1 DataGrid (`shared/DataGrid.tsx`)
The `DataGrid` is the workhorse of the application, rendering complex, resizable, and virtualized lists (like `DealTable.tsx`).
- **Virtualization:** Uses `@tanstack/react-virtual`.
- **Styling Configuration:** Uses a localized `S` constant object to rigorously bind inline styles to `globals.css` variables:
  - Header Height: `36px` / Row Height: `40px` / Footer Height: `32px`.
  - Backgrounds alternate between `S.rowEvenBg` (`var(--color-surface-0)`) and `S.rowOddBg` (`var(--color-surface-1)`).
- **Interactions:** Hovering a row changes its background to `S.rowHoverBg` (`var(--color-accent-bg)`).
- **Resizing:** Custom column resizer logic utilizing `onMouseDown` that expands widths dynamically.
- **Loading Skeleton:** Custom `linear-gradient` shimmer animation cycling between `var(--color-surface-1)` and `var(--color-surface-2)`.

### 6.2 DealStageBar (`deals/DealStageBar.tsx`)
A visual progress tracker for the Deal lifecycle.
- **Node Size:** 24px (`w-6 h-6`) rounded full.
- **Node Statuses:** 
  - *Completed:* `bg-success`, displays a `<Check className="h-3 w-3" />`.
  - *Active:* `bg-primary`, displays step number.
  - *Inactive:* Transparent border.
- **Connectors:** 32px width (`w-8`), 2px height (`h-0.5`). Color matches completion state.

### 6.3 Dashboard Widgets (`dashboard/*.tsx`)
- **KPIScorecard:** Renders a responsive CSS Grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-6`). Metric numbers are `text-2xl font-bold`.
- **FunnelMetrics:** Uses horizontal progress bars mapped to a `maxCount`. Bars utilize a gradient `bg-gradient-to-r from-primary to-success`. Labels have a fixed width for alignment (`w-24`).

### 6.4 Client Views (`client/*.tsx`)
- **CallBrief:** Renders a summary box. Relies on rounded-xl borders, containing titles, addresses, badges for `call_status`, and a dedicated nested block for `client_notes`.

---

## 7. Known Technical Debt & Inconsistencies

During implementation, several components were built as placeholders or prior to the finalization of `globals.css` CSS variables. These components exhibit "raw" Tailwind utility classes that **break dark mode** and do not match the premium design system:

1. **`UnderwritingForm.tsx`**: Uses raw HTML inputs (`<select>`, `<input>`) instead of shadcn components. Employs hardcoded colors like `border-slate-300` and `bg-blue-600` / `hover:bg-blue-700` instead of `var(--color-surface-3)` and `var(--color-primary)`.
2. **`DealCard.tsx` / `ClientDealCard.tsx`**: Uses `bg-white` and `border-slate-200` and text like `text-slate-500`. These must be migrated to `var(--color-surface-0)`, `var(--color-surface-3)`, and `var(--color-text-secondary)`.
3. **Missing Border Classes**: Multiple components in `dashboard/` and `client/` use the class `border` but fail to specify a border-color class, leaving the browser default or inheriting improperly instead of enforcing `var(--color-surface-3)`.

*When implementing new features or migrating these components, developers MUST replace all `slate-*`, `blue-*`, and raw background references with their respective `var(--color-*)` semantic counterparts or use the standard shadcn components (`<Input>`, `<Select>`, `<Button>`).*

---

## 8. Iconography
- The app strictly utilizes `lucide-react` for all iconography.
- **Sizing Defaults:** 
  - Standard action and navigation icons use `h-4 w-4`. 
  - Mobile menu triggers use `h-5 w-5`.
  - Stage bar checkmarks use `h-3 w-3`.
- **Opacity Hierarchy:** Icons often run at `opacity-70` in an inactive state to establish hierarchy alongside text, jumping to `opacity-100` on hover or active states.
