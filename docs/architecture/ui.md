# UI & Theming Specifications

The Acquisition Platform requires a premium, exactingly precise user interface. Because it deals with high-density financial and real estate data, visual clarity, contrast, and layout stability are paramount.

## 1. Theming Architecture & Rules

The platform operates on a heavily customized CSS variable system. It does **not** rely on standard Tailwind colors, nor does it use OS-level default behaviors.

### The Canonical Light Mode
**Light mode is the primary, authoritative state of the application.** Every component must be designed for light mode first. 

### The Dark Mode Opt-In
Dark mode is treated strictly as an opt-in user preference. 
*   The application explicitly forbids the use of `@media (prefers-color-scheme: dark)`.
*   The application explicitly forbids the `next-themes` package. If it exists in `layout.tsx`, it must be removed.
*   **Implementation:** A user selects "Dark Mode" in settings. The value `"dark"` is written to `localStorage('acq_theme')`. A blocking `<script>` in the `<head>` of `layout.tsx` reads this key before first paint. If it equals `"dark"`, it attaches the `.dark` class to the `<html>` element. This completely prevents the flash-of-unstyled-content (FOUC).

### The Desktop Sidebar Exception
The Desktop Sidebar (part of the `(internal)` layout) is the **only** component in the application that is permanently dark.
*   Its background is hardcoded to `#0E0E0E`.
*   It does not use CSS variables like `var(--color-surface-0)`.
*   This ensures the sidebar provides a consistent, stable "chrome" frame around the application regardless of whether the user is in light or dark mode.

## 2. Global Token System

All colors must be applied using CSS variables mapped in `globals.css`. 

**Forbidden Patterns:**
*   `bg-white`, `bg-black`, `bg-slate-100`, `text-blue-600`, `border-gray-200`.
*   Raw hex codes inline like `color: #F7F5F0`.
*   CSS named colors.

**Allowed Tokens:**
*   **Surfaces:** 
    *   `--color-canvas`: The outer page background (`#F7F5F0` / `#111110`).
    *   `--color-surface-0`: Clean surfaces like cards and popovers.
    *   `--color-surface-1`, `2`, `3`: Escalating degrees of contrast used for borders, hover states, and dividers.
*   **Typography:**
    *   `--color-text-primary`: Primary reading text.
    *   `--color-text-secondary`: Labels, subtitles.
    *   `--color-text-tertiary`: Placeholders, disabled states.
    *   `--color-text-inverse`: Text placed on top of heavily colored backgrounds (e.g., white text on a blue button).
*   **Brand & Semantics:**
    *   `--color-accent`: The primary brand soothing green (`#1E5B3F`).
    *   `--color-success-*`, `--color-warning-*`, `--color-danger-*`, `--color-info-*`.
*   **Deal Scores:**
    *   Specific tokens exist exclusively for deal scores: `--color-score-vg-*` (Very Good), `--color-score-g-*` (Good), `--color-score-b-*` (Bad), `--color-score-vb-*` (Very Bad).

## 3. Typography & Metrics

*   **Fonts:**
    *   *Instrument Serif*: Used for high-impact brand elements.
    *   *DM Sans*: The standard sans-serif for UI elements, labels, and paragraphs.
    *   *JetBrains Mono*: Used exclusively for tabular data (financials, unit counts, dates) to ensure vertical alignment in tables.
*   **Base Metrics:** 
    *   The base font size is `13px` to accommodate data-heavy tables.
    *   Border radiuses are scaled systematically: Small (`4px`), Medium (`6px`), Large (`10px`), Extra Large (`14px`).

## 4. Complex Component Specifications

When building or modifying components, refer to these rules:
*   **DataGrid:** Must use virtualized rendering (`@tanstack/react-virtual`). Hover states use `var(--color-accent-bg)`.
*   **DealStageBar:** A horizontal stepper showing 11 distinct deal stages. Completed steps use `success` tokens, active steps use `primary` tokens, and future steps use `surface-3` borders.
*   **Forms:** All `<select>` and `<input>` elements must be wrapped in Shadcn UI components. Bare HTML inputs are not permitted due to styling inconsistencies across browsers.
