# UI & Design System Specifications

The **Acquire Platform** enforces a high-density, precision-engineered design system. Built to present complex financial models, large property tables, and multi-threaded communications, the interface emphasizes visual clarity, contrast stability, and zero-FOUC theme switching.

---

## 1. Design System Architecture & Tokens

The application operates on an adaptive CSS variable token system mapped in `src/app/globals.css`. It explicitly prohibits standard Tailwind color utilities (e.g. `bg-white`, `bg-slate-*`, `text-blue-*`) or inline raw hex codes.

### Global Theme Tokens (`globals.css`):

```css
:root {
  --sidebar-width: 220px;
  /* Canvas & Surface Tokens */
  --color-canvas: #F7F5F0;       /* Warm linen light background */
  --color-surface-0: #FFFFFF;    /* Pure white card surface */
  --color-surface-1: #ECE9E0;    /* Secondary background */
  --color-surface-2: #D8D3C5;    /* Subdued divider & border */
  --color-surface-3: #BEB9A9;    /* Active control border */

  /* Brand Accent Tokens */
  --accent: #1E5B3F;             /* Deep Emerald Forest */
  --color-accent-light: #C3DFC7;
  --color-accent-bg: #EDF5EE;

  /* Typography Tokens */
  --color-text-primary: #1A1814;
  --color-text-secondary: #6B6560;
  --color-text-tertiary: #9B9690;
  --color-text-inverse: #F7F5F0;

  /* Sidebar Tokens (Light Mode) */
  --color-sidebar-bg: #F7F5F0;
  --color-sidebar-border: #C5C0B3;
  --color-sidebar-text: #6B6560;

  /* Transitions & Easing */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-fluid: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
}

.dark {
  --color-canvas: #111110;       /* Deep obsidian dark background */
  --color-surface-0: #191918;    /* Dark card surface */
  --color-surface-1: #222220;
  --color-surface-2: #2C2C2A;
  --color-surface-3: #3A3A38;

  --accent: #48A375;             /* Electric Emerald Dark Accent */
  --color-accent-light: #1A3F2C;
  --color-accent-bg: #0F261B;

  --color-text-primary: #F0EDE8;
  --color-text-secondary: #9B9690;
  --color-text-tertiary: #6B6560;

  /* Sidebar Tokens (Dark Mode) */
  --color-sidebar-bg: #0E0E0E;
  --color-sidebar-border: #2A2A2A;
  --color-sidebar-text: #A8A39A;
}
```

---

## 2. Light & Dark Mode Execution

*   **Canonical Primary Mode**: Light mode is the default state. All components are styled light-first using CSS variables.
*   **Opt-In Dark Mode**:
    *   No `@media (prefers-color-scheme: dark)` media queries are used.
    *   `next-themes` package is strictly prohibited.
    *   Theme preference is saved to `localStorage('acq_theme')`.
    *   A synchronous inline script in the `<head>` of `layout.tsx` evaluates `localStorage` before first paint, adding `.dark` to `<html>` if enabled. This guarantees **zero Flash of Unstyled Content (FOUC)**.

---

## 3. Typography & Data Font Pairings

The platform uses Google Fonts imported in `globals.css`:
1.  **Instrument Serif**: Display typography for page titles and high-impact branding.
2.  **DM Sans**: Clean sans-serif for UI labels, form controls, navigation, and body copy.
3.  **JetBrains Mono**: Monospaced font reserved for tabular financial numbers, unit counts, dates, and deal metrics to ensure exact column alignment.

```css
@theme inline {
  --font-sans: var(--font-dm-sans);
  --font-mono: var(--font-jetbrains-mono);
  --font-display: 'Instrument Serif', Georgia, serif;
}
```

---

## 4. Key UI Components & Hooks

### A. Virtualized DataGrid (`src/components/shared/DataGrid.tsx`)
- Driven by `@tanstack/react-virtual` for handling thousands of rows without DOM lag.
- Uses custom interaction hooks:
  - `useGridInteraction.ts`: Manages cell focus selection, keyboard navigation (Arrow keys, Enter, Tab, Escape, Shift+Tab), copy/paste buffers, and cell edit commits.
  - `useColumnOrder.ts` & `useColumnWidths.ts`: Remembers user column order and width preferences.
- Visual Feedback: Features custom CSS glow animations (`animate-cell-success`, `animate-cell-flash`, `animate-cell-error`).

### B. Drive File Manager (`src/components/deals/DriveFileManager.tsx`)
- Full Google Drive file system view with path breadcrumb navigation (`DriveBreadcrumb.tsx`).
- Integrated dropzone (`FileDropZone.tsx`) supporting WebKit recursive directory drop traversal (`directory-traversal.ts`).
- Displays Google Drive storage quota progress indicators and file MIME type icons.

### C. Email Thread List & Reply Box (`EmailThreadList.tsx`, `InlineReplyBox.tsx`)
- Gmail-style threaded view with collapsed message accordions.
- Scoped HTML email rendering via `.email-content` stylesheet rules.
- Recipient chips autocomplete (`RecipientChipsInput.tsx`) and template insertion manager (`EmailTemplateManager.tsx`).

### D. Collapsible Sidebar Navigation (`Sidebar.tsx`)
- Smooth animated collapsing with drag-resize handle (`useSidebarCollapsed.ts`).
- Project switcher menu with recent access shortcuts (`get_recent_projects`).
- Role-based nav items (`internalNavItems`, `clientNavItems`, `adminNavItems`).
