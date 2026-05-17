# DataGrid & DealTable — Excel-Like Interaction Layer
## Technical Specification Addendum v2.0

This document extends `EXCEL_TABLE.md` (the base DataGrid/DealTable spec). All styling rules, theming, and column definitions from that document remain in force. This addendum specifies the complete keyboard navigation, cell selection, range selection, editing, and resize interaction model — engineered to match Excel's interaction fidelity while staying within the React + `@tanstack/react-virtual` architecture.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Focus & Cell Address Model](#2-focus--cell-address-model)
3. [Keyboard Navigation](#3-keyboard-navigation)
4. [Selection Model](#4-selection-model)
5. [Mouse Selection](#5-mouse-selection)
6. [Cell Editing (F2 Mode)](#6-cell-editing-f2-mode)
7. [Column & Row Resize](#7-column--row-resize)
8. [Clipboard Integration](#8-clipboard-integration)
9. [Scroll Behavior & Virtualization Contract](#9-scroll-behavior--virtualization-contract)
10. [Performance Constraints](#10-performance-constraints)
11. [Visual Rendering of States](#11-visual-rendering-of-states)
12. [Accessibility & Focus Management](#12-accessibility--focus-management)
13. [Hook Architecture](#13-hook-architecture)
14. [Keyboard Shortcut Reference](#14-keyboard-shortcut-reference)

---

## 1. Architecture Overview

### 1.1 Interaction State Layers

The DataGrid now maintains two independent state layers stacked on top of the existing data/filter/sort layer:

```
┌─────────────────────────────────────────────────────┐
│  Layer 3 — Edit Mode State                          │  (transient, cell-level)
│  activeEditCell, draftValue, editMode               │
├─────────────────────────────────────────────────────┤
│  Layer 2 — Selection State                          │  (persistent, multi-cell)
│  focusCell, anchorCell, selectionRanges[], mode     │
├─────────────────────────────────────────────────────┤
│  Layer 1 — Data / Filter / Sort State               │  (existing, unchanged)
│  rows[], filters, sortConfig, pagination            │
└─────────────────────────────────────────────────────┘
```

### 1.2 New Dependencies

| Package | Purpose |
|---|---|
| `@tanstack/react-virtual` | Already required — unchanged |
| `immer` | Immutable range-set updates without array mutation |
| No additional packages | All interaction is pointer + keyboard events on existing DOM |

### 1.3 Grid Coordinate System

Every addressable cell is identified by a `CellAddress`:

```typescript
type CellAddress = {
  rowIndex: number;   // 0-based index into the **virtual** row list (not page-relative)
  colIndex: number;   // 0-based index into the **visible** column list
};

type CellRange = {
  start: CellAddress;
  end: CellAddress;   // inclusive; start and end may be the same cell
};
```

Column index 0 is always the Checkbox column. Column index `N-1` is always the Actions column. These two columns are **excluded** from keyboard navigation (the focus cursor skips them) and from range selection. They remain reachable by pointer only.

---

## 2. Focus & Cell Address Model

### 2.1 Focus Cell

At any time, exactly one cell holds the **focus** (`focusCell: CellAddress | null`). This is the Excel "active cell" — the one with the green border highlight. It is separate from the selection range.

- When the grid mounts, `focusCell` is `null`.
- The first `Tab`, `ArrowKey`, or click on any navigable cell sets `focusCell`.
- `focusCell` must always be inside the visible (non-fixed) column range.

### 2.2 Anchor Cell

When a range selection begins (Shift+Arrow, Shift+Click, or mouse drag), the **anchor** (`anchorCell: CellAddress`) is fixed at where the selection started. The range is always defined as `{start: anchorCell, end: focusCell}` with start/end normalized so `start.row <= end.row && start.col <= end.col`.

### 2.3 Virtualization Awareness

Row indices are **absolute** (into the full dataset, not the current page). The virtualizer's `startIndex` and `endIndex` are used only to determine which rows to render. Selection state always references absolute indices. When the user scrolls, the selection persists — selected rows that scroll out of view remain selected.

---

## 3. Keyboard Navigation

### 3.1 Arrow Keys (No Modifier)

| Key | Behavior |
|---|---|
| `ArrowRight` | Move focus one column right. At last column, do nothing. |
| `ArrowLeft` | Move focus one column left. At first column, do nothing. |
| `ArrowDown` | Move focus one row down. At last row of page, do nothing. |
| `ArrowUp` | Move focus one row up. At first row, do nothing. |

Navigation clears any existing range selection. The new `focusCell` becomes both `focusCell` and `anchorCell`.

If `focusCell` is null and any arrow key is pressed, set focus to `{rowIndex: 0, colIndex: 1}` (first navigable column, first row).

### 3.2 Tab / Shift+Tab

- `Tab`: Move right across columns. At the last column of a row, wrap to column 1 (index 1) of the next row. At the very last cell of the dataset, do nothing.
- `Shift+Tab`: Reverse of above.
- Tab navigation **never** enters the Checkbox or Actions columns.
- Pressing Tab while in Edit Mode (F2) commits the edit and moves focus right (standard Excel behavior).

### 3.3 Enter / Shift+Enter

- `Enter` (navigation mode): Moves focus **down** one row, same column. If at last row, does nothing.
- `Shift+Enter`: Moves focus **up** one row.
- `Enter` (edit mode): Commits the edit, moves focus down.

### 3.4 Page Up / Page Down

- `PageDown`: Move focus down by the number of currently **visible** rows (i.e., the virtualizer's rendered window size). Clamp to last row. Clear selection.
- `PageUp`: Move focus up by the same amount. Clamp to row 0. Clear selection.
- `Ctrl+PageDown` / `Ctrl+PageUp`: Not used (reserved for browser tab navigation — do not intercept).

### 3.5 Home / End

| Key | Behavior |
|---|---|
| `Home` | Move focus to column 1 (first navigable column), same row. |
| `End` | Move focus to last navigable column, same row. |
| `Ctrl+Home` | Move focus to `{rowIndex: 0, colIndex: 1}`. |
| `Ctrl+End` | Move focus to last row, last navigable column. |

### 3.6 Ctrl+Arrow (Jump to Data Boundary)

Mirrors Excel's Ctrl+Arrow "jump to edge of data region" behavior:

- `Ctrl+ArrowRight`: From current column, scan right. If the current cell is non-empty, jump to the last non-empty cell before a gap (or the edge). If current cell is empty, jump to the next non-empty cell.
- `Ctrl+ArrowLeft`: Mirror of above, scanning left.
- `Ctrl+ArrowDown` / `Ctrl+ArrowUp`: Same logic along rows.

Implementation note: "non-empty" is determined by the rendered cell value (not raw data) — a cell showing `—` (null placeholder) is treated as empty for navigation purposes.

### 3.7 Escape

- In Edit Mode: Discard draft, exit Edit Mode, restore previous value. Focus stays on the cell.
- In Navigation Mode with a range selection: Clear range selection, keep focus cell.
- In Navigation Mode with no selection: No-op.

### 3.8 Delete / Backspace

- In Navigation Mode: If the focused or selected cells are editable, clear their content (set to null/empty). Open a confirmation only if a required field would be nulled. Non-editable cells (Stage, Score, Actions, Date Added) ignore this key.
- In Edit Mode: Standard text editing behavior.

---

## 4. Selection Model

### 4.1 Selection Modes

The grid operates in one of three selection modes at any time:

| Mode | Description |
|---|---|
| `NONE` | No selection. focusCell may or may not be set. |
| `CELL_RANGE` | A contiguous rectangular range of cells is selected. |
| `MULTI_RANGE` | Multiple disjoint ranges are selected (Ctrl+Shift or Ctrl+Click). |
| `ROW` | One or more full rows are selected (via Checkbox column). |

`ROW` mode and `CELL_RANGE`/`MULTI_RANGE` modes are mutually exclusive. Clicking a checkbox clears any cell range selection; pressing a navigation key clears row selection.

### 4.2 Shift+Arrow — Extending a Range

When `Shift` is held with any arrow key:
1. `anchorCell` stays fixed at its current position (or `focusCell` if no anchor yet).
2. `focusCell` moves in the arrow direction.
3. The selection range is the rectangle bounded by `anchorCell` and `focusCell`.

Shift+Arrow range extension does **not** wrap rows. It respects the same column boundaries as unmodified navigation.

### 4.3 Shift+Home / Shift+End / Shift+PageUp / Shift+PageDown

Extend the selection range to the boundary indicated, keeping anchor fixed. Behavior follows the same rules as their unmodified equivalents, applied as range extension instead of focus movement.

### 4.4 Ctrl+Shift+Arrow

Extends the range to the data boundary in the given direction (same boundary logic as Ctrl+Arrow, applied as range extension).

### 4.5 Ctrl+A — Select All

- First press: Select all cells in all navigable columns of the current page.
- Second press (if already full page selected): Select all columns AND all rows in the full dataset (not just the current page). The grid should show a visual indicator that this is a cross-page selection.
- Third press: Deselect all.

### 4.6 Ctrl+Click — Additive Range Selection (MULTI_RANGE)

Each `Ctrl+Click` on a cell:
1. Creates a new single-cell range at the clicked cell.
2. Adds it to `selectionRanges[]`.
3. Sets `focusCell` and `anchorCell` to the clicked cell.

Subsequent `Ctrl+Shift+Click` extends the **most recently added** range from its anchor to the clicked cell.

There is no practical cap on the number of disjoint ranges, but rendering performance should degrade gracefully (see Section 10).

### 4.7 Shift+Click — Extend from Anchor

`Shift+Click` on any cell extends the current range from `anchorCell` to the clicked cell, replacing the current range. Does not add a new range.

### 4.8 Row Selection vs. Cell Selection

Row checkboxes use a separate `selectedRowIds: Set<string>` state (existing behavior). This is independent of `selectionRanges`. Clicking a checkbox does not affect `selectionRanges`; navigation keys do not affect `selectedRowIds`.

---

## 5. Mouse Selection

### 5.1 Single Click

- Clicking a navigable cell sets `focusCell` and `anchorCell` to that cell.
- Clears any existing `selectionRanges`.
- Mode becomes `NONE` (single cell focus, no range).
- If clicking an already-focused cell in navigation mode, no state change (does not enter edit mode — that requires F2 or double-click).

### 5.2 Click + Drag — Range Selection

1. `mousedown` on a cell: sets `anchorCell`, starts drag mode.
2. `mousemove` (with button held): continuously update `focusCell` to the hovered cell. The live selection range is `{anchor, focus}`.
3. `mouseup`: finalize the range. Mode becomes `CELL_RANGE`.

During a drag, an invisible overlay div (position: fixed, full viewport, z-index above the grid) captures pointer events to prevent text selection and handle the case where the pointer leaves the grid. On mouseup anywhere in the document, the drag ends.

Auto-scroll during drag: if the pointer is within 40px of the top or bottom of the grid viewport while dragging, scroll the grid at a rate proportional to proximity (max 8px/frame). Same for left/right edges.

### 5.3 Double-Click on Cell

Enters **Edit Mode** for that cell (see Section 6). The cell's existing value is populated in the input. The text cursor is placed at the end of the value.

### 5.4 Column Header Click

- Single click: Sort (existing behavior, unchanged).
- Single click on selected column header (when that column is selected): No additional action.
- Note: Column header is NOT part of cell range selection.

### 5.5 Row Number Area

The grid does not currently render row numbers. If row numbers are added in a future version, clicking a row number should select the entire row as a `CELL_RANGE` spanning all navigable columns at that row index.

---

## 6. Cell Editing (F2 Mode)

### 6.1 Entering Edit Mode

A cell enters Edit Mode via any of:

| Trigger | Cursor Position |
|---|---|
| `F2` | End of existing value |
| `Double-click` on cell | End of existing value |
| Any printable character key (letter, digit, symbol) while in navigation mode | Clears existing value; cursor at position 1 |

Only cells in editable columns can enter Edit Mode. Non-editable columns:
- Checkbox (col 0)
- Stage (renders `<DealStageBar>` — not directly editable)
- Score (renders `<DealScoreBadge>` — not directly editable)
- Date Added (read-only, auto-set by server)
- Actions (col N-1)

Attempting F2 or double-click on a non-editable column produces a brief visual flash of the cell border (using `var(--color-surface-3)`) and no mode change.

### 6.2 Edit Mode Visual

In Edit Mode:
- The cell renders an `<input>` (or `<textarea>` for multi-line fields — none currently) that fills the cell exactly.
- Input styling: `background: var(--color-surface-0)`, `border: 2px solid var(--color-accent)`, `outline: none`, `font-size: 13px`, `font-family` matching the column type.
- The cell's row hover state is suppressed while editing.
- The rest of the grid is still scrollable and clickable, but keyboard events are captured by the input.

### 6.3 Committing an Edit

| Action | Result |
|---|---|
| `Enter` | Commit, move focus down |
| `Tab` | Commit, move focus right |
| `Shift+Tab` | Commit, move focus left |
| Click another cell | Commit, move focus to clicked cell |
| `Escape` | Discard, stay on cell |

On commit, the new value is:
1. Validated against column type constraints (e.g., `unit_count` must be a positive integer or null).
2. If invalid: the input border turns `var(--color-error, #ef4444)` for 600ms, then reverts — the edit is **not** committed and the user remains in edit mode.
3. If valid: the draft value is applied to the local row data optimistically, and a `PATCH /api/deals/[id]` is dispatched. On API error, a toast notification is shown and the value reverts to the pre-edit state.

### 6.4 Editable Columns and Their Constraints

| Column | Field | Validation |
|---|---|---|
| Property Name | `deal_name` | Non-empty string, max 200 chars |
| Address | `address` | Free text, max 300 chars |
| Units | `unit_count` | Positive integer or null. Input type: `number`, `min=0`, `step=1` |
| Campaign | `campaign.name` | Triggers a Popover search dropdown instead of a plain input (see §6.5) |

### 6.5 Campaign Column — Edit Popover

Because Campaign is a relational field (not free text), pressing F2 or double-clicking the Campaign cell opens a small Popover anchored to the cell rather than an inline input. The Popover contains a search input that filters existing campaigns from the database. Keyboard behavior:
- Arrow keys navigate the Popover list.
- `Enter` selects a campaign and commits.
- `Escape` dismisses without committing.
- `Tab` dismisses the Popover and moves focus to the next cell (without committing).

### 6.6 F2 Toggle

Pressing `F2` while already in Edit Mode does nothing (Excel behavior — F2 toggles navigation cursor in the formula bar, which we do not implement; therefore F2 is a no-op in edit mode).

---

## 7. Column & Row Resize

### 7.1 Column Resize — Drag Handle (Existing, Extended)

The existing 4px drag handle on the right edge of header cells (specified in the base spec) is extended with the following behavior:

**Drag Resize:**
- `mousedown` on handle: start drag with `startX` and `startWidth` captured.
- `mousemove`: `newWidth = Math.max(MIN_COL_WIDTH, startWidth + (currentX - startX))`.
- `mouseup`: finalize. The column width is stored in `columnWidths: Record<colKey, number>` in component state and persisted to `localStorage` under the key `dealTableColumnWidths`.
- Minimum column width: `60px`. Maximum: `600px`.

**Snap to Content on Double-Click:**
This is the Excel "auto-fit column width" behavior triggered by double-clicking a column resize handle.

- `dblclick` on the resize handle of column `C`:
  1. Measure the **rendered text width** of every visible cell in column `C` (use a hidden off-screen `<canvas>` with `ctx.measureText()` using the column's font settings).
  2. Also measure the header label width.
  3. Set column width to `max(allMeasuredWidths) + 24px` (horizontal padding), clamped to `[MIN_COL_WIDTH, 600px]`.
  4. Apply immediately with a `150ms` CSS `width` transition.

Implementation note: Only measure rows currently in the virtualizer's rendered window plus the header. Do not iterate the entire dataset — this keeps the operation O(visible rows), not O(total rows).

**Multi-Column Auto-Fit:**
If 2+ columns are selected (via column header click with Shift), double-clicking any resize handle auto-fits **all selected columns** simultaneously using the same canvas measurement approach.

### 7.2 Row Resize — Double-Click Bottom Border

Row height is fixed at `40px` per the base spec for virtualization performance. **Variable row height is not supported.** Double-clicking a row's bottom border does nothing. A future version may introduce optional variable row heights with `@tanstack/react-virtual`'s `estimateSize` dynamic mode.

### 7.3 Multi-Column Resize via Drag

When multiple columns are selected (via column header Shift+Click), dragging any of their resize handles proportionally resizes all selected columns. The ratio of each selected column's width to the total selected width is preserved during the drag.

---

## 8. Clipboard Integration

### 8.1 Copy — Ctrl+C

Copies the current selection to the clipboard in two formats simultaneously:

**Plain text (text/plain):** Tab-separated values, newline-separated rows. Null/empty cells render as empty strings. This allows pasting into Excel, Google Sheets, or any text editor.

**HTML (text/html):** A `<table>` with `<tr>/<td>` elements preserving the selection shape. This allows pasting into rich-text environments with structure preserved.

Example: selecting a 3×2 range → clipboard contains:
```
Unit Count\tAddress
12\t123 Main St, Austin TX
—\t456 Oak Ave, Denver CO
```
(The `—` null placeholder is included verbatim in plain text output.)

Ctrl+C in Edit Mode copies the selected text within the input (default browser behavior — do not intercept).

### 8.2 Cut — Ctrl+X

Same as Ctrl+C, then clears the content of all editable cells in the selection (same as pressing Delete). Non-editable cells in the range are copied but not cleared.

### 8.3 Paste — Ctrl+V

Pastes clipboard content starting at `focusCell`:

1. Parse clipboard as tab/newline delimited text.
2. Map parsed rows/columns to the grid starting at `focusCell`.
3. For each target cell, validate the pasted value against the column's constraints.
4. Cells that fail validation are skipped (not modified); a toast lists which cells were skipped.
5. Valid cells are batch-updated: a single `PATCH /api/deals/batch` request is sent with all `{id, field, value}` tuples.
6. If the paste range extends beyond the current page, it is truncated to the visible rows.

Paste does not create new rows. Pasting into non-editable columns silently skips those columns.

### 8.4 Ctrl+D — Fill Down

Copies the value(s) from the **top row** of the current selection and fills them into all rows below within the selection. Respects editable/non-editable column rules. A single `PATCH /api/deals/batch` call is used.

### 8.5 Ctrl+R — Fill Right

Same as Ctrl+D but fills the leftmost column's value(s) rightward across the selection.

---

## 9. Scroll Behavior & Virtualization Contract

### 9.1 Scroll-to-Focus

Whenever `focusCell` changes (by any means), the grid must ensure the focus cell is visible:

1. **Vertical:** If the new `rowIndex` is outside the virtualizer's current rendered range, scroll the container so the row is visible. Use the virtualizer's `scrollToIndex(rowIndex, { align: 'auto' })` method — `'auto'` scrolls the minimum distance needed (shows at bottom if scrolling down, top if scrolling up).
2. **Horizontal:** If the new `colIndex` is outside the visible horizontal scroll range, scroll the container horizontally so the column's left or right edge is just inside the viewport. Use `scrollLeft` on the grid container directly (column virtualization does not have a built-in `scrollToIndex` equivalent — implement manually using `columnOffsets[colIndex]`).

Both scrolls happen in the same animation frame — do not introduce a render cycle between them.

### 9.2 Fixed Columns (Checkbox & Actions)

The Checkbox column (index 0) and the Actions column (index N-1) are **position-sticky**, exactly matching Excel's frozen column behavior. They do not participate in horizontal scroll — they always remain visible. The sticky implementation must use `position: sticky; left: 0` and `position: sticky; right: 0` with an appropriate `z-index` above scrolling cells.

The horizontal scroll-to-focus logic must account for sticky column widths when computing whether a column is "visible."

### 9.3 Virtualization and Selection Rendering

The virtualizer only renders rows/columns within the visible window. Selection state (`selectionRanges`) is stored globally but the visual highlight (background color, border) is applied only when a cell renders. Each cell checks at render time: `isInAnyRange(cellAddress, selectionRanges)`. This check must be O(1) or O(R) where R is the number of disjoint ranges (practically always ≤ 10) — not O(total cells).

---

## 10. Performance Constraints

### 10.1 State Update Batching

All selection state updates triggered by keyboard events must be batched into a single React state update. Do not call multiple `setState` calls in sequence for a single keydown handler. Use `useReducer` for the interaction state layer (focus, anchor, ranges, editMode) so a single `dispatch` produces one re-render.

### 10.2 Render Isolation

The DataGrid's virtualized row renderer must be wrapped in `React.memo` with a custom equality check that only re-renders a row if:
- Its data changed.
- Its selection state changed (is any cell in this row now selected or deselected).
- Its focus state changed (focusCell is in this row).

A row that is neither selected nor focused and whose data is unchanged must produce zero re-renders during keyboard navigation of other rows.

### 10.3 Canvas Measurement Cache

The off-screen canvas used for column auto-fit measurement (§7.1) must be a singleton attached to the DataGrid instance (not recreated per measurement). Column width measurements are cached in a `Map<colKey+rowKey, number>`. The cache is invalidated when:
- The column's data changes.
- The column's font settings change (column visibility toggle or column reorder).

### 10.4 No Layout Thrash in Drag Resize

During column resize drag, `width` updates must be applied via direct DOM manipulation (`ref.current.style.width = ...`) — not through React state — to avoid triggering a re-render on every `mousemove`. The React state for column widths is updated only on `mouseup`. After state update, the directly-set style is cleared so React takes over.

### 10.5 Debounce / Throttle

| Interaction | Throttle/Debounce |
|---|---|
| Mousemove during column resize | 16ms throttle (rAF) |
| Mousemove during range selection drag | 16ms throttle (rAF) |
| Auto-scroll during range selection drag | 16ms throttle (rAF) |
| Ctrl+A "select all" re-render | No debounce needed (single action) |
| Search input (existing) | 300ms debounce (unchanged) |

---

## 11. Visual Rendering of States

All new states must use CSS variables from `globals.css`. No raw colors.

### 11.1 Focus Cell (Active Cell)

The focused cell (no range selected) renders:
- Background: `var(--color-accent-bg)` (same as row hover)
- Border: `2px solid var(--color-accent)` on all four sides, **inset** (does not increase cell size)
- The border is rendered as a pseudo-element (`::after` on the cell div, `position: absolute, inset: 0, pointer-events: none`) to avoid layout impact.

### 11.2 Selected Range

Cells within a selection range (but not the focus cell) render:
- Background: `color-mix(in srgb, var(--color-accent) 15%, var(--color-surface-0))` — a very light tint of the accent color.
- No additional border on interior cells.
- The **outline** of the range (outermost edges of the bounding rectangle) renders a `1px solid var(--color-accent)` border, drawn via an absolutely positioned overlay div layered on top of the grid, not on individual cells. This avoids per-cell border calculation.

### 11.3 Multiple Disjoint Ranges

Each range in `selectionRanges[]` gets its own overlay div. All ranges share the same accent tint background on cells and the same accent border outline. There is no distinct color per range (unlike some spreadsheet apps) — this keeps the visual language consistent.

### 11.4 Focus Cell Inside a Range

When `focusCell` is inside a selected range:
- The cell still renders the `2px solid var(--color-accent)` inset border.
- Background is the range tint (not overridden to `var(--color-accent-bg)`).

### 11.5 Edit Mode Cell

In Edit Mode:
- The `<input>` fills the cell absolutely.
- A `2px solid var(--color-accent)` border on the input (not a pseudo-element — the input's own border).
- A subtle `box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent) 20%, transparent)` glow around the cell.

### 11.6 Column Resize Handle States

| State | Visual |
|---|---|
| Idle | `2px` wide, `var(--color-surface-3)`, opacity 0.6 |
| Hover | `2px` wide, `var(--color-accent)`, opacity 1, cursor `col-resize` |
| Active drag | `2px` wide, `var(--color-accent)`, full height of table (not just header), opacity 1 |

The full-height drag indicator is a fixed-positioned div rendered at the handle's X coordinate during drag. It is removed on mouseup.

### 11.7 Transition Rules

| State change | Transition |
|---|---|
| Cell focus moves | No transition (instant, like Excel) |
| Selection range changes | No transition (instant) |
| Row hover | `background-color 150ms ease` (unchanged from base spec) |
| Edit mode enter/exit | `box-shadow 100ms ease` on the glow |
| Column width change (auto-fit) | `width 150ms ease` |
| Column width change (drag) | No transition (direct DOM manipulation) |

---

## 12. Accessibility & Focus Management

### 12.1 ARIA Grid Role

The grid container receives `role="grid"`. Each header row has `role="row"`. Each data row has `role="row"`. Each header cell has `role="columnheader"`. Each data cell has `role="gridcell"`.

The entire grid container must be focusable (`tabIndex={0}`) and receive keyboard events at the container level (not individual cells). Individual cells are **not** focusable via the browser's tab order — only the grid container is. Keyboard navigation is managed entirely by the interaction layer.

The grid container sets `aria-activedescendant` to the ID of the currently focused cell's DOM element, so screen readers announce the focused cell without actual DOM focus moving.

### 12.2 Cell IDs

Each rendered cell must have a stable ID: `grid-cell-r{rowIndex}-c{colIndex}`. The header row cells: `grid-header-c{colIndex}`. These IDs are referenced by `aria-activedescendant`.

### 12.3 Edit Mode Accessibility

When a cell enters Edit Mode, the `<input>` receives actual DOM focus (browser focus, not just ARIA). The `aria-label` on the input is `"{column name}, row {rowIndex + 1}, edit"`. On exit from Edit Mode, focus returns to the grid container.

### 12.4 Keyboard Trap Prevention

The grid must NOT trap keyboard focus. Pressing `Tab` from the last cell should move browser focus to the next focusable element outside the grid. Pressing `Shift+Tab` from the grid container (or first cell) should move focus to the prior focusable element. The grid only intercepts Tab for **intra-grid navigation** when focus is already inside the grid and there are more navigable cells in the current direction.

---

## 13. Hook Architecture

### 13.1 `useGridInteraction(config)`

This is the primary new hook. It owns the interaction state layer and returns handlers + state.

```typescript
type GridInteractionConfig = {
  rowCount: number;
  columnCount: number;         // visible navigable columns (excludes checkbox/actions)
  editableColumns: Set<number>; // colIndex values that support editing
  onCellEdit: (address: CellAddress, newValue: unknown) => void;
  onCopyRequest: (ranges: CellRange[]) => void;
  onPasteRequest: (startCell: CellAddress, data: string[][]) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  virtualizerRef: React.RefObject<Virtualizer>; // @tanstack/react-virtual instance
};

type GridInteractionState = {
  focusCell: CellAddress | null;
  anchorCell: CellAddress | null;
  selectionRanges: CellRange[];
  editingCell: CellAddress | null;
  draftValue: string;
  isCellSelected: (address: CellAddress) => boolean;
  isCellFocused: (address: CellAddress) => boolean;
  isCellEditing: (address: CellAddress) => boolean;
};

type GridInteractionHandlers = {
  onContainerKeyDown: (e: React.KeyboardEvent) => void;
  onCellMouseDown: (address: CellAddress, e: React.MouseEvent) => void;
  onCellMouseEnter: (address: CellAddress, e: React.MouseEvent) => void;
  onCellDoubleClick: (address: CellAddress) => void;
  onResizeHandleMouseDown: (colIndex: number, e: React.MouseEvent) => void;
  onResizeHandleDoubleClick: (colIndex: number) => void;
  onDraftChange: (newDraft: string) => void;
  onEditCommit: () => void;
  onEditDiscard: () => void;
};
```

The hook uses `useReducer` internally. All keyboard and mouse event handlers dispatch to the reducer. The hook attaches `mousemove` and `mouseup` listeners to `document` during drag operations and removes them on completion.

### 13.2 `useColumnWidths(columnDefs)`

Manages column widths with localStorage persistence.

```typescript
type UseColumnWidths = {
  widths: Record<string, number>;
  setWidth: (colKey: string, width: number) => void;
  autoFitColumn: (colKey: string, containerRef: React.RefObject<HTMLElement>) => void;
  autoFitSelected: (colKeys: string[], containerRef: React.RefObject<HTMLElement>) => void;
};
```

Reads `dealTableColumnWidths` from localStorage on mount. Writes on every `setWidth` call (debounced 500ms to avoid excessive writes during drag — note: drag uses direct DOM manipulation, so `setWidth` is only called on mouseup).

### 13.3 `useClipboard()`

Wraps `navigator.clipboard.writeText` / `navigator.clipboard.write` (for rich HTML) and `navigator.clipboard.readText`. Handles permission errors gracefully with a toast.

### 13.4 Integration in `DataGrid.tsx`

```typescript
const interaction = useGridInteraction({...});
const columnWidths = useColumnWidths(visibleColumns);

// Spread handlers onto the container
<div
  ref={containerRef}
  role="grid"
  tabIndex={0}
  onKeyDown={interaction.handlers.onContainerKeyDown}
>
  {/* Virtualized rows and cells receive onMouseDown, onDoubleClick etc. */}
</div>
```

---

## 14. Keyboard Shortcut Reference

This table is the complete, authoritative list of keyboard shortcuts for the DataGrid/DealTable. It is also the reference for a planned in-app help panel (accessible via `Ctrl+/` or `?` key when grid is focused).

### 14.1 Navigation

| Shortcut | Action |
|---|---|
| `Arrow Keys` | Move focus one cell in direction |
| `Tab` | Move focus right; wraps to next row |
| `Shift+Tab` | Move focus left; wraps to previous row |
| `Enter` | Move focus down |
| `Shift+Enter` | Move focus up |
| `Home` | Jump to first column in current row |
| `End` | Jump to last column in current row |
| `Ctrl+Home` | Jump to first cell (row 0, col 1) |
| `Ctrl+End` | Jump to last cell |
| `PageDown` | Move focus down by visible row count |
| `PageUp` | Move focus up by visible row count |
| `Ctrl+Arrow` | Jump to data boundary in direction |

### 14.2 Selection

| Shortcut | Action |
|---|---|
| `Shift+Arrow` | Extend selection range in direction |
| `Shift+Home` | Extend selection to start of row |
| `Shift+End` | Extend selection to end of row |
| `Shift+PageDown` | Extend selection down by page |
| `Shift+PageUp` | Extend selection up by page |
| `Ctrl+Shift+Arrow` | Extend selection to data boundary |
| `Ctrl+Click` | Add disjoint range starting at clicked cell |
| `Shift+Click` | Extend current range to clicked cell |
| `Click+Drag` | Select rectangular range |
| `Ctrl+A` | Select all (press again for full dataset; again to deselect) |
| `Escape` | Clear selection (keep focus); or discard edit |

### 14.3 Editing

| Shortcut | Action |
|---|---|
| `F2` | Enter edit mode on focused cell |
| `Double-click` | Enter edit mode |
| `Any printable key` | Enter edit mode, replace existing value |
| `Enter` (in edit) | Commit, move down |
| `Tab` (in edit) | Commit, move right |
| `Shift+Tab` (in edit) | Commit, move left |
| `Escape` (in edit) | Discard changes, stay on cell |
| `Delete` | Clear content of selected cells |
| `Backspace` | Clear content of focused cell (navigation mode) |

### 14.4 Clipboard

| Shortcut | Action |
|---|---|
| `Ctrl+C` | Copy selection (text + HTML) |
| `Ctrl+X` | Cut selection (copy + clear editable cells) |
| `Ctrl+V` | Paste at focused cell |
| `Ctrl+D` | Fill selection down from top row |
| `Ctrl+R` | Fill selection right from left column |

### 14.5 Column Management

| Interaction | Action |
|---|---|
| Drag resize handle | Resize column |
| `Double-click` resize handle | Auto-fit column to content |
| `Double-click` resize handle (multi-column selected) | Auto-fit all selected columns |
| Settings icon (gear) | Open column visibility popover (existing) |

### 14.6 Help

| Shortcut | Action |
|---|---|
| `Ctrl+/` or `?` (grid focused) | Open keyboard shortcut help panel |

---

## Appendix A — Non-Goals (Explicit Exclusions)

The following Excel features are explicitly **not** in scope for this specification and must not be implemented speculatively:

- Formula evaluation (`=SUM(...)`, `=VLOOKUP(...)`, etc.)
- Cell formatting (bold, italic, background color on individual cells)
- Row insertion or deletion from within the grid
- Variable row heights
- Frozen rows (frozen columns are in scope; frozen rows are not)
- Cell comments / annotations
- Named ranges
- Undo/redo stack (the existing Supabase + API layer handles data persistence; in-grid undo is out of scope)
- Drag-to-reorder rows
- Cell merging (`colspan`/`rowspan`)

---

## Appendix B — Open Questions for Engineering Review

1. **Ctrl+A full-dataset selection:** When the full dataset is selected across pages, bulk actions (Archive Selected) must paginate API calls. Define the batch size and error handling strategy before implementing.
2. **Paste into relational fields:** Pasting into the Campaign column requires matching the pasted string to an existing campaign name. Define the matching strategy (exact match? fuzzy? error on no match?).
3. **`PATCH /api/deals/batch`:** This endpoint does not exist in the current API spec. It must be defined and implemented before Ctrl+D, Ctrl+R, and bulk paste can ship.
4. **Selection persistence across sort/filter changes:** When the user applies a new filter, should the current selection be cleared? Recommended: yes, clear selection on any filter or sort change to avoid stale row references.
