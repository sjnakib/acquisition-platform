# Acquisition Platform — UI/UX Technical Specification

## 1. Design Philosophy

The Acquisition Platform utilizes a premium, data-dense interface. The design language favors structured layouts, subtle contrast, and refined typography to handle complex multifamily property data.

The platform is **light-themed by default**. Light mode is the canonical, primary, and authoritative visual state of the application. Every component, color token, style rule, and layout decision must be designed and validated in light mode first. Dark mode is a secondary, opt-in experience activated exclusively when the user explicitly expresses a preference for it. No component, page, or widget may assume or hardcode a dark background unless it is one of the explicitly enumerated exceptions listed in §4.1 (Desktop Sidebar).

The platform implements theme switching via a custom CSS variable system (`globals.css`). The `.dark` class, applied to the `<html>` element, is the sole mechanism for enabling dark mode. This class must never be applied automatically based on system defaults, browser defaults, time of day, or any inference. It is applied only in response to a direct, explicit user action—see §3.5 for the full specification.

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

- **Display:** `Instrument Serif`, Georgia, serif — used for high-impact headings or brand elements.
- **Sans-Serif:** `DM Sans`, -apple-system, sans-serif — primary application font.
- **Monospace:** `JetBrains Mono`, 'Fira Code', monospace — used specifically for tabular numbers such as unit counts and dates.

All font color values must reference the CSS variable semantic tokens defined in §3.2. No component may hardcode a font color using a raw hex value, Tailwind color utility (e.g., `text-slate-500`, `text-gray-700`), or system color keyword.

### 2.3 Animation & Transitions

- **Fast:** `80ms ease`
- **Base:** `150ms ease` — standard for button hovers, link highlights, and hover rows.
- **Slow:** `250ms ease` — used for sidebar collapsing and drawer animations.
- **Sidebar Easing:** `cubic-bezier(0.4, 0, 0.2, 1)`
- **Theme Transition:** When the `.dark` class is toggled on `<html>`, all elements that reference CSS variables must transition using `background-color 200ms ease, color 200ms ease, border-color 200ms ease`. This transition must be applied globally via a `*, *::before, *::after` rule scoped within a `html.theme-transitioning` class that is added for the duration of the toggle animation and removed afterward. This prevents a flash of unstyled content during theme switches.

---

## 3. Color System & Theming

The platform relies on a variable-based color system defined entirely in `globals.css`. All color values used by any component must be expressed as `var(--color-*)` references. No component may reference raw hex values, raw RGB values, Tailwind palette utilities (e.g., `bg-white`, `bg-slate-100`, `text-blue-600`), or CSS named colors at the component level. These rules apply without exception to all new code and must be remediated in legacy code per §7.

### 3.1 Theme Application Rules

The following rules govern how the light and dark color tokens are applied. They are listed in order of authority; higher rules override lower ones.

1. **Light mode is the default.** The `<html>` element must never have the `.dark` class applied on initial render, server-side render, or page load, regardless of the OS-level `prefers-color-scheme` media query value. The application does not read or respond to `prefers-color-scheme` automatically.
2. **Dark mode requires explicit user opt-in.** The `.dark` class is applied to `<html>` only when a user has navigated to Settings → Appearance → Theme and selected "Dark" and confirmed the selection. See §3.5.
3. **User preference is persisted.** Once a user selects "Dark," the preference is stored in `localStorage` under the key `acq_theme` with the string value `"dark"`. On subsequent page loads, the application reads this key synchronously in a blocking `<script>` tag in the `<head>` before first paint. If the value is `"dark"`, the `.dark` class is applied before rendering. If the value is absent, `null`, `undefined`, `"light"`, or any other value, the `.dark` class is not applied and light mode is used.
4. **The sidebar is always dark.** The Desktop Sidebar (§4.1) uses a fixed, hardcoded dark background (`#0E0E0E`) and does not participate in theme switching. This is the only component exempt from the light-default rule.
5. **No other component may deviate from the theme.** No component may apply `.dark`, force a dark background, or use dark-mode-only color values outside of the sidebar exemption. Any future exceptions must be explicitly documented in this specification with a rationale.

### 3.2 CSS Variable Definitions (`globals.css`)

All variables below are defined twice: once in the `:root` selector (light mode values) and once in `:root.dark` or `html.dark` (dark mode values). The light values are canonical and must be treated as the primary design reference.

#### Background & Surfaces

| Token                    | Light Value  | Dark Value  | Usage                                      |
|--------------------------|--------------|-------------|--------------------------------------------|
| `--color-canvas`         | `#F7F5F0`    | `#111110`   | Page background (`<body>` and `<main>`)    |
| `--color-surface-0`      | `#FFFFFF`    | `#191918`   | Cards, popovers, modals, panels            |
| `--color-surface-1`      | `#F2F0EB`    | `#222220`   | Muted areas, hover states, alternate rows  |
| `--color-surface-2`      | `#E8E5DE`    | `#2C2C2A`   | DataGrid row borders, dividers             |
| `--color-surface-3`      | `#D9D5CC`    | `#3A3A38`   | Input borders, card borders, scrollbar     |

#### Text

| Token                      | Light Value  | Dark Value  | Usage                                             |
|----------------------------|--------------|-------------|---------------------------------------------------|
| `--color-text-primary`     | `#1A1814`    | `#F0EDE8`   | All body text, labels, headings                   |
| `--color-text-secondary`   | `#6B6560`    | `#9B9690`   | Supporting labels, metadata, subtitles            |
| `--color-text-tertiary`    | `#9B9690`    | `#6B6560`   | Placeholder text, disabled states, captions       |
| `--color-text-inverse`     | `#F7F5F0`    | `#1A1814`   | Text on filled/dark backgrounds (e.g., accent btn)|

#### Accent & Brand

| Token                      | Light Value  | Dark Value  | Usage                                             |
|----------------------------|--------------|-------------|---------------------------------------------------|
| `--color-accent`           | `#C8963C`    | `#C8963C`   | Primary brand color; unchanged across themes      |
| `--color-accent-bg`        | `#FBF4E6`    | `#2A2316`   | Hover row tint, subtle accent backgrounds         |
| `--color-accent-border`    | `#E8C87A`    | `#5A4010`   | Borders on accent-tinted surfaces                 |
| `--color-primary`          | `#C8963C`    | `#C8963C`   | Alias for `--color-accent`; used on buttons       |

#### Semantic Colors

Each semantic color group has four tokens: `solid` (fill), `bg` (subtle background), `border`, and `text`.

**Success**

| Token                       | Light Value  | Dark Value  |
|-----------------------------|--------------|-------------|
| `--color-success-solid`     | `#2D8B24`    | `#3AAF30`   |
| `--color-success-bg`        | `#EAF4E8`    | `#0F2A0D`   |
| `--color-success-border`    | `#A8D8A0`    | `#1E5C1A`   |
| `--color-success-text`      | `#1E6B18`    | `#7DD678`   |

**Warning**

| Token                       | Light Value  | Dark Value  |
|-----------------------------|--------------|-------------|
| `--color-warning-solid`     | `#C8963C`    | `#C8963C`   |
| `--color-warning-bg`        | `#FBF4E6`    | `#2A2316`   |
| `--color-warning-border`    | `#E8C87A`    | `#5A4010`   |
| `--color-warning-text`      | `#8A5C00`    | `#D4A84B`   |

**Danger**

| Token                       | Light Value  | Dark Value  |
|-----------------------------|--------------|-------------|
| `--color-danger-solid`      | `#C42B2B`    | `#E03A3A`   |
| `--color-danger-bg`         | `#FBE9E9`    | `#2A0D0D`   |
| `--color-danger-border`     | `#F0A8A8`    | `#5C1A1A`   |
| `--color-danger-text`       | `#8B1E1E`    | `#F08080`   |

**Info**

| Token                       | Light Value  | Dark Value  |
|-----------------------------|--------------|-------------|
| `--color-info-solid`        | `#2461B8`    | `#3A7AD4`   |
| `--color-info-bg`           | `#EAF1FB`    | `#0D1A2A`   |
| `--color-info-border`       | `#A8C8F0`    | `#1A3A5C`   |
| `--color-info-text`         | `#1A4F8A`    | `#7AB0F0`   |

#### Deal Scoring Colors

Used exclusively in `DealScoreBadge`, mapped to `deal.score`.

| Score Tier      | Token Prefix     | Text (Light) | Bg (Light) | Border (Light) | Text (Dark)  | Bg (Dark)  | Border (Dark) |
|-----------------|-----------------|--------------|------------|----------------|--------------|------------|---------------|
| Very Good (`vg`)| `--color-score-vg` | `#1E6B18`  | `#EAF4E8`  | `#A8D8A0`      | `#7DD678`    | `#0F2A0D`  | `#1E5C1A`     |
| Good (`g`)      | `--color-score-g`  | `#146B52`  | `#E8F4F0`  | `#A0D8C8`      | `#5DD4B0`    | `#0D2A22`  | `#1A5C44`     |
| Bad (`b`)       | `--color-score-b`  | `#8A5C00`  | `#FBF4E6`  | `#E8C87A`      | `#D4A84B`    | `#2A2316`  | `#5A4010`     |
| Very Bad (`vb`) | `--color-score-vb` | `#8B1E1E`  | `#FBE9E9`  | `#F0A8A8`      | `#F08080`    | `#2A0D0D`  | `#5C1A1A`     |

Each score group exposes three tokens: `--color-score-{tier}-text`, `--color-score-{tier}-bg`, `--color-score-{tier}-border`.

### 3.3 Variable Scope in `globals.css`

```css
/* Light mode — canonical, always defined first */
:root {
  --color-canvas:            #F7F5F0;
  --color-surface-0:         #FFFFFF;
  --color-surface-1:         #F2F0EB;
  --color-surface-2:         #E8E5DE;
  --color-surface-3:         #D9D5CC;

  --color-text-primary:      #1A1814;
  --color-text-secondary:    #6B6560;
  --color-text-tertiary:     #9B9690;
  --color-text-inverse:      #F7F5F0;

  --color-accent:            #C8963C;
  --color-accent-bg:         #FBF4E6;
  --color-accent-border:     #E8C87A;
  --color-primary:           #C8963C;

  --color-success-solid:     #2D8B24;
  --color-success-bg:        #EAF4E8;
  --color-success-border:    #A8D8A0;
  --color-success-text:      #1E6B18;

  --color-warning-solid:     #C8963C;
  --color-warning-bg:        #FBF4E6;
  --color-warning-border:    #E8C87A;
  --color-warning-text:      #8A5C00;

  --color-danger-solid:      #C42B2B;
  --color-danger-bg:         #FBE9E9;
  --color-danger-border:     #F0A8A8;
  --color-danger-text:       #8B1E1E;

  --color-info-solid:        #2461B8;
  --color-info-bg:           #EAF1FB;
  --color-info-border:       #A8C8F0;
  --color-info-text:         #1A4F8A;

  --color-score-vg-text:     #1E6B18;
  --color-score-vg-bg:       #EAF4E8;
  --color-score-vg-border:   #A8D8A0;

  --color-score-g-text:      #146B52;
  --color-score-g-bg:        #E8F4F0;
  --color-score-g-border:    #A0D8C8;

  --color-score-b-text:      #8A5C00;
  --color-score-b-bg:        #FBF4E6;
  --color-score-b-border:    #E8C87A;

  --color-score-vb-text:     #8B1E1E;
  --color-score-vb-bg:       #FBE9E9;
  --color-score-vb-border:   #F0A8A8;
}

/* Dark mode — applied only when <html> carries the .dark class */
html.dark {
  --color-canvas:            #111110;
  --color-surface-0:         #191918;
  --color-surface-1:         #222220;
  --color-surface-2:         #2C2C2A;
  --color-surface-3:         #3A3A38;

  --color-text-primary:      #F0EDE8;
  --color-text-secondary:    #9B9690;
  --color-text-tertiary:     #6B6560;
  --color-text-inverse:      #1A1814;

  --color-accent:            #C8963C;
  --color-accent-bg:         #2A2316;
  --color-accent-border:     #5A4010;
  --color-primary:           #C8963C;

  --color-success-solid:     #3AAF30;
  --color-success-bg:        #0F2A0D;
  --color-success-border:    #1E5C1A;
  --color-success-text:      #7DD678;

  --color-warning-solid:     #C8963C;
  --color-warning-bg:        #2A2316;
  --color-warning-border:    #5A4010;
  --color-warning-text:      #D4A84B;

  --color-danger-solid:      #E03A3A;
  --color-danger-bg:         #2A0D0D;
  --color-danger-border:     #5C1A1A;
  --color-danger-text:       #F08080;

  --color-info-solid:        #3A7AD4;
  --color-info-bg:           #0D1A2A;
  --color-info-border:       #1A3A5C;
  --color-info-text:         #7AB0F0;

  --color-score-vg-text:     #7DD678;
  --color-score-vg-bg:       #0F2A0D;
  --color-score-vg-border:   #1E5C1A;

  --color-score-g-text:      #5DD4B0;
  --color-score-g-bg:        #0D2A22;
  --color-score-g-border:    #1A5C44;

  --color-score-b-text:      #D4A84B;
  --color-score-b-bg:        #2A2316;
  --color-score-b-border:    #5A4010;

  --color-score-vb-text:     #F08080;
  --color-score-vb-bg:       #2A0D0D;
  --color-score-vb-border:   #5C1A1A;
}
```

### 3.4 Prohibited Patterns

The following patterns are forbidden in all components, pages, utilities, and style sheets except where an explicit exemption is granted in this document:

- Any raw hex color literal in a component's CSS, inline style, or Tailwind class.
- Any Tailwind color utilities from the default palette: `bg-white`, `bg-black`, `bg-slate-*`, `bg-gray-*`, `bg-zinc-*`, `bg-neutral-*`, `bg-stone-*`, `text-slate-*`, `text-gray-*`, `border-slate-*`, `bg-blue-*`, `text-blue-*`, `hover:bg-blue-*`, `bg-red-*`, etc.
- Any CSS `color-scheme` property that would cause the browser to apply its own dark-mode defaults to form controls or scrollbars.
- Any `@media (prefers-color-scheme: dark)` media query anywhere in the codebase. The platform does not use OS-level theme detection.
- Applying the `.dark` class in JavaScript for any reason other than the explicit user action described in §3.5.

### 3.5 Theme Toggle — Behavior Specification

**Location:** Settings → Appearance → Theme.

**Control:** A segmented control (not a checkbox or toggle switch) with exactly two options: "Light" and "Dark". The currently active option is visually highlighted using `var(--color-accent)` as the active indicator color.

**Default state:** "Light" is selected on all new accounts and for all users who have never explicitly chosen a theme.

**On selecting "Light":**
1. Remove the `.dark` class from `<html>` if present.
2. Write `"light"` to `localStorage` under key `acq_theme`.
3. Do not reload the page.

**On selecting "Dark":**
1. Add the `.dark` class to `<html>`.
2. Write `"dark"` to `localStorage` under key `acq_theme`.
3. Do not reload the page.

**On page load (executed in a synchronous `<script>` tag in `<head>`, before any React hydration or stylesheet load):**
```javascript
(function () {
  var theme = localStorage.getItem('acq_theme');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  }
  // No else branch — light is the default and requires no class.
})();
```
This script must be inlined directly in the HTML `<head>`, not deferred, not async, and not bundled with application JavaScript. Its sole purpose is to prevent a flash of light mode on dark-mode users' page loads.

**No other code path may add or remove the `.dark` class.** There is no auto-detection, no scheduled switching, no API-driven theme assignment, and no fallback to `prefers-color-scheme`.

---

## 4. Layout Architecture (`(internal)/layout.tsx`)

### 4.1 Desktop Sidebar

The sidebar is the **only component in the application permanently rendered in a dark visual style**, regardless of the active application theme. This is an intentional product decision: the sidebar serves as a permanent, stable chrome element that does not participate in theme switching.

- **Width:** `220px` expanded, `52px` collapsed.
- **Background:** Always `#0E0E0E`. This value is hardcoded as an inline style or a dedicated non-variable CSS class (e.g., `.sidebar-shell`). It must not reference `var(--color-canvas)` or any other theme variable, as those values change with the theme. The background must remain `#0E0E0E` in both light and dark application mode.
- **Border (right edge):** Always `#1A1A1A`. Same hardcoding rule applies.
- **Text within the sidebar:** Always `#F7F5F0` for primary labels; always `#9B9690` for secondary/inactive labels. These are hardcoded within a `.sidebar-shell *` scope, not via theme variables, to ensure they remain readable against the always-dark background in both light and dark application themes.
- **Brand Logo:** "◆ Acquire". The diamond `◆` character is always colored `#C8963C` (accent gold), hardcoded. The word "Acquire" is always `#F7F5F0`, hardcoded.
- **Navigation Items:** `13px` font size, `34px` row height.
  - Default (inactive) state: no background, label color `#9B9690`, icon opacity `0.7`.
  - Hover state: background `#1A1A1A`, label color `#F7F5F0`, icon opacity `1.0`. Transition: `background-color 150ms ease, color 150ms ease`.
  - Active state: background `#242424`, label color `#F7F5F0`, font-weight `500`, icon opacity `1.0`.
- **User Profile Menu:** Collapsible widget anchored to the bottom of the sidebar. On expansion, renders a popup menu positioned `bottom-full` (above the trigger). The popup background is always `#191918`, border `#2C2C2A`, `box-shadow: 0 8px 24px rgba(0,0,0,0.4)`. The "Sign Out" menu item label is always `#F08080`. All of these are hardcoded values scoped to the sidebar, not theme variables.
- **Sidebar collapse animation:** `width 250ms cubic-bezier(0.4, 0, 0.2, 1)`. Text labels fade out using `opacity 150ms ease` simultaneously.

### 4.2 Mobile Layout

- **Header:** `48px` fixed header. Background: `var(--color-surface-0)`. Border-bottom: `1px solid var(--color-surface-3)`. This header is theme-aware and correctly switches between light and dark values.
- **Hamburger icon:** `h-5 w-5`, color `var(--color-text-primary)`.
- **Drawer:** Off-canvas sidebar, `280px` wide. The drawer uses the same always-dark sidebar styles as the desktop sidebar (§4.1). Its backdrop is `rgba(0,0,0,0.5)` with `backdrop-filter: blur(4px)`. The backdrop does not change between themes.
- **Main Content Area:** `padding: 32px 32px 32px 32px` on desktop; `padding: 56px 16px 16px 16px` on mobile (`pt-14 px-4`). Background: `var(--color-canvas)`.

---

## 5. Core Primitives (Shadcn customized)

All shadcn/ui primitives have been customized to align with this design system's tokens. When implementing these primitives, no raw color value may be passed as a prop or style override. All visual states must be expressed through `var(--color-*)` tokens.

### 5.1 Buttons (`ui/button.tsx`)

- **Sizes:**
  - `default`: `height: 34px`, `padding: 0 14px`, `font-size: 13px`.
  - `sm`: `height: 28px`, `padding: 0 10px`, `font-size: 12px`.
  - `lg`: `height: 40px`, `padding: 0 18px`, `font-size: 14px`.
  - `icon`: `height: 34px`, `width: 34px`, no padding.
- **Variants:**
  - `default` (primary): Background `var(--color-primary)`, text `var(--color-text-inverse)`. Hover: background darkened by 8% (implement via a `filter: brightness(0.92)` on hover rather than a hardcoded color). Active: `transform: scale(0.98)`.
  - `destructive`: Background `var(--color-danger-solid)`, text `var(--color-text-inverse)`.
  - `outline`: Background transparent, border `1px solid var(--color-surface-3)`, text `var(--color-text-primary)`. Hover: background `var(--color-surface-1)`.
  - `secondary`: Background `var(--color-surface-2)`, text `var(--color-text-primary)`. Hover: background `var(--color-surface-3)`.
  - `ghost`: Background transparent, text `var(--color-text-primary)`. Hover: background `var(--color-surface-1)`.
  - `link`: Background transparent, text `var(--color-accent)`, underline on hover.
- **Click animation:** `active:scale-[0.98]` — applies to all variants.
- **Disabled state:** `opacity: 0.45`, `cursor: not-allowed`, `pointer-events: none`.
- **Transition:** `background-color 150ms ease, filter 150ms ease, transform 80ms ease`.

### 5.2 Inputs & Forms (`ui/input.tsx`)

- **Height:** `36px` (`h-9`).
- **Font size:** `13px` (`text-sm`).
- **Background:** `var(--color-surface-0)`.
- **Border:** `1px solid var(--color-surface-3)`.
- **Border radius:** `var(--radius-md)` (`6px`).
- **Text color:** `var(--color-text-primary)`.
- **Placeholder color:** `var(--color-text-tertiary)`.
- **Focus state:** `border-color: var(--color-accent)`, `box-shadow: 0 0 0 1px var(--color-accent)`. No Tailwind `ring` utilities; use explicit `box-shadow`.
- **Disabled state:** Background `var(--color-surface-1)`, text `var(--color-text-tertiary)`, border `var(--color-surface-2)`, `cursor: not-allowed`.
- **`<select>` elements:** Must use the shadcn `<Select>` component. Raw HTML `<select>` elements are forbidden — see §7.

### 5.3 Badges (`ui/badge.tsx`)

- **Sizes:**
  - `md`: `padding: 2px 6px`, `font-size: 11px`.
  - `sm`: `padding: 1px 4px`, `font-size: 10px`.
- **Border radius:** `var(--radius-sm)` (`4px`) for all badge sizes.
- **Font weight:** `500` (medium).
- **Variants and their token mappings:**

| Variant    | Background                  | Border                         | Text                        |
|------------|-----------------------------|---------------------------------|-----------------------------|
| `success`  | `var(--color-success-bg)`   | `var(--color-success-border)`   | `var(--color-success-text)` |
| `warning`  | `var(--color-warning-bg)`   | `var(--color-warning-border)`   | `var(--color-warning-text)` |
| `danger`   | `var(--color-danger-bg)`    | `var(--color-danger-border)`    | `var(--color-danger-text)`  |
| `info`     | `var(--color-info-bg)`      | `var(--color-info-border)`      | `var(--color-info-text)`    |
| `neutral`  | `var(--color-surface-2)`    | `var(--color-surface-3)`        | `var(--color-text-secondary)`|
| `accent`   | `var(--color-accent-bg)`    | `var(--color-accent-border)`    | `var(--color-accent)`       |
| `score-vg` | `var(--color-score-vg-bg)`  | `var(--color-score-vg-border)`  | `var(--color-score-vg-text)`|
| `score-g`  | `var(--color-score-g-bg)`   | `var(--color-score-g-border)`   | `var(--color-score-g-text)` |
| `score-b`  | `var(--color-score-b-bg)`   | `var(--color-score-b-border)`   | `var(--color-score-b-text)` |
| `score-vb` | `var(--color-score-vb-bg)`  | `var(--color-score-vb-border)`  | `var(--color-score-vb-text)`|

- **`dot` prop:** When `dot={true}`, a `6px × 6px` circle (`border-radius: 50%`) is rendered inline to the left of the badge label text. The dot's background color matches the badge's text color (`var(--color-*-text)` for the active variant). The dot has `display: inline-block`, `margin-right: 5px`, and `vertical-align: middle`.

---

## 6. Complex Components

### 6.1 DataGrid (`shared/DataGrid.tsx`)

The `DataGrid` is the workhorse of the application, rendering complex, resizable, and virtualized lists (e.g., `DealTable.tsx`).

- **Virtualization:** Uses `@tanstack/react-virtual`.
- **Styling Configuration:** All colors are bound via a localized `S` constant object referencing `globals.css` variables. No component-level color values.
  - Header height: `36px`. Background: `var(--color-surface-1)`. Border-bottom: `1px solid var(--color-surface-2)`. Header text: `var(--color-text-secondary)`, `font-size: 11px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.04em`.
  - Row height: `40px`.
  - Footer height: `32px`. Background: `var(--color-surface-1)`. Border-top: `1px solid var(--color-surface-2)`.
  - Even rows: `var(--color-surface-0)`.
  - Odd rows: `var(--color-surface-1)`.
  - Row hover: `var(--color-accent-bg)`. Transition: `background-color 150ms ease`.
  - Row border-bottom: `1px solid var(--color-surface-2)`.
  - Selected row: Background `var(--color-accent-bg)`, left border `2px solid var(--color-accent)`.
- **Resizing:** Column resizer handle: `2px` wide, `var(--color-surface-3)` in default state, `var(--color-accent)` while being dragged. Implemented via `onMouseDown` with `document`-level `mousemove`/`mouseup` listeners.
- **Loading skeleton:** `linear-gradient` shimmer from `var(--color-surface-1)` to `var(--color-surface-2)` and back. Animation: `1.4s ease-in-out infinite`. Width of shimmer band: `40%`.

### 6.2 DealStageBar (`deals/DealStageBar.tsx`)

A visual progress tracker for the Deal lifecycle.

- **Node size:** `24px × 24px`, `border-radius: 50%`.
- **Node states:**
  - *Completed:* Background `var(--color-success-solid)`, border none. Displays `<Check className="h-3 w-3" />` with color `var(--color-text-inverse)`.
  - *Active:* Background `var(--color-primary)`, border none. Displays the step number as text, color `var(--color-text-inverse)`, `font-size: 11px`, `font-weight: 600`.
  - *Inactive:* Background transparent, border `2px solid var(--color-surface-3)`. Displays the step number as text, color `var(--color-text-tertiary)`, `font-size: 11px`.
- **Connectors:** `32px × 2px`. Background:
  - If the preceding step is completed: `var(--color-success-solid)`.
  - Otherwise: `var(--color-surface-2)`.
- **Stage labels:** Positioned below each node. `font-size: 11px`, completed/active: `var(--color-text-primary)`, inactive: `var(--color-text-tertiary)`.

### 6.3 Dashboard Widgets (`dashboard/*.tsx`)

- **KPIScorecard:** Grid layout: `grid-cols-2 md:grid-cols-3 lg:grid-cols-6`. Each cell: background `var(--color-surface-0)`, border `1px solid var(--color-surface-2)`, border-radius `var(--radius-lg)`, padding `16px`. Metric numbers: `font-size: 24px`, `font-weight: 700`, color `var(--color-text-primary)`, rendered in `JetBrains Mono`. Metric label: `font-size: 11px`, `font-weight: 500`, color `var(--color-text-secondary)`, `text-transform: uppercase`, `letter-spacing: 0.04em`.
- **FunnelMetrics:** Horizontal progress bar track: `height: 6px`, background `var(--color-surface-2)`, border-radius `3px`. Bar fill: `background: linear-gradient(to right, var(--color-primary), var(--color-success-solid))`. Label column: `width: 96px` fixed (`w-24`), text `var(--color-text-secondary)`, `font-size: 12px`. Value column: `font-size: 12px`, color `var(--color-text-primary)`, `font-family: JetBrains Mono`.

### 6.4 Client Views (`client/*.tsx`)

- **CallBrief:** Outer container: background `var(--color-surface-0)`, border `1px solid var(--color-surface-2)`, border-radius `var(--radius-xl)`, padding `20px 24px`. Title: `font-size: 15px`, `font-weight: 600`, color `var(--color-text-primary)`. Address subtitle: `font-size: 12px`, color `var(--color-text-secondary)`. Call status badge: uses the `<Badge>` component (§5.3) with variant mapped to `call_status` value. Client notes block: inner container with background `var(--color-surface-1)`, border `1px solid var(--color-surface-2)`, border-radius `var(--radius-md)`, padding `12px 14px`, `font-size: 13px`, color `var(--color-text-secondary)`.

---

## 7. Technical Debt & Required Remediation

The following components were built before `globals.css` was finalized and contain hardcoded color values that break the theming system. They are non-compliant and must be remediated. Until remediation is complete, these components will appear visually broken in dark mode. Remediation is required before any new feature work may begin on these files.

### 7.1 `UnderwritingForm.tsx`

**Issues:**
- Uses raw HTML `<select>` and `<input>` elements instead of shadcn `<Select>` and `<Input>` components.
- `border-slate-300` → must be replaced with `var(--color-surface-3)`.
- `bg-blue-600` → must be replaced with `var(--color-primary)`.
- `hover:bg-blue-700` → must be replaced with a `filter: brightness(0.92)` hover rule on the primary-colored element.
- Any other `slate-*` or `blue-*` Tailwind utilities → audit fully and replace with the appropriate `var(--color-*)` token.

**Required action:** Replace all raw HTML form controls with shadcn equivalents (`<Input>`, `<Select>`, `<Button>`). Audit the full file for any remaining Tailwind palette utilities and replace with CSS variable tokens.

### 7.2 `DealCard.tsx` and `ClientDealCard.tsx`

**Issues:**
- `bg-white` → must be replaced with `background: var(--color-surface-0)`.
- `border-slate-200` → must be replaced with `border-color: var(--color-surface-2)`.
- `text-slate-500` → must be replaced with `color: var(--color-text-secondary)`.

**Required action:** Audit both files completely. Replace every Tailwind palette utility with the correct `var(--color-*)` token. Verify in both light and dark modes after remediation.

### 7.3 Missing Border Colors in `dashboard/` and `client/`

**Issue:** Multiple components apply the `border` Tailwind utility class (which sets `border-width: 1px; border-style: solid`) without specifying a border-color class. This causes the browser to use its default `currentColor`, which produces incorrect results in both themes.

**Required action:** Every element that uses `border`, `border-t`, `border-b`, `border-l`, or `border-r` must also explicitly set a border color using an inline style (`border-color: var(--color-surface-3)`) or a dedicated utility class that maps to the correct token. The default border color for all structural borders throughout the application is `var(--color-surface-3)`. Use `var(--color-surface-2)` for dividers inside data-dense surfaces (table rows, grid cells). Use `var(--color-surface-2)` for card borders. No border may have an unspecified color.

---

## 8. Iconography

- The application uses `lucide-react` exclusively for all iconography. No other icon library may be introduced.
- **Sizing defaults:**
  - Standard action and navigation icons: `h-4 w-4` (`16px`).
  - Mobile menu trigger (hamburger): `h-5 w-5` (`20px`).
  - Stage bar checkmarks: `h-3 w-3` (`12px`).
- **Color:** All icons must inherit color via the CSS `color` property (`currentColor`). No icon may have an explicit fill or stroke color passed as a prop unless it is intentionally a semantic color (e.g., a status indicator icon using `var(--color-success-solid)`).
- **Opacity hierarchy:**
  - Inactive / default state: `opacity: 0.7`.
  - Hover state: `opacity: 1.0`.
  - Active / selected state: `opacity: 1.0`.
  - Transition: `opacity 150ms ease`.
- **Sidebar icons:** Because the sidebar is always dark (§4.1), sidebar icon colors are always `#9B9690` (inactive) and `#F7F5F0` (active/hover), hardcoded within the `.sidebar-shell` scope. They do not use `currentColor` because the parent text color is managed separately from the sidebar's non-variable color scheme.

---

## 9. Theming QA Checklist

Every component — new and remediated — must pass the following checks before being considered complete:

1. **Light mode default:** Load the application without any `acq_theme` entry in `localStorage`. Confirm the `.dark` class is absent from `<html>`. Confirm the component renders correctly on a `#F7F5F0` canvas.
2. **Dark mode opt-in:** Navigate to Settings → Appearance → Theme and select "Dark." Confirm the `.dark` class is added to `<html>`. Confirm the component renders correctly on a `#111110` canvas. Confirm no raw colors remain visible (no white backgrounds, no hardcoded dark text on dark backgrounds).
3. **Persistence:** After selecting "Dark," reload the page. Confirm the `.dark` class is present before first paint and `acq_theme` in `localStorage` is `"dark"`. Confirm no flash of light mode.
4. **Return to light:** Select "Light" in Settings. Confirm the `.dark` class is removed from `<html>`, `acq_theme` in `localStorage` is `"light"`, and the component returns to its light appearance.
5. **Sidebar invariance:** In both light and dark application themes, confirm the sidebar background remains `#0E0E0E`, sidebar text remains `#F7F5F0`/`#9B9690`, and no sidebar color changes between themes.
6. **No palette utilities:** Inspect the component's rendered DOM and its source. Confirm no Tailwind palette class (e.g., `bg-white`, `text-slate-*`, `border-gray-*`) appears anywhere.
7. **No bare borders:** Inspect every element with a border. Confirm each has an explicit border-color referencing a `var(--color-*)` token.
8. **No `prefers-color-scheme`:** Confirm no media query in the component's styles or the global stylesheet responds to `prefers-color-scheme`.
