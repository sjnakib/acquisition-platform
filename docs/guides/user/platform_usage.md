# Platform Usage & Workflows Guide

This guide details the complete operational workflows for both **Internal Acquisition Teams** and **Client Sponsors** using the **Acquire Platform**.

---

## Part 1: Internal Acquisition Team Workflows

Internal team members manage projects, lead ingestion, outreach, underwriting, LOI counter-offers, and deal file repositories.

### 1. Project Navigation & Projects Hub
- Access the **Projects Hub** at `/projects` to view assigned projects.
- Switch between projects seamlessly using the **Sidebar Project Switcher** or recency menu.
- Project settings (`/projects/[id]/settings`) allow configuring project description, assigned team members (`project_members`), sponsors (`sponsors`), Google Workspace connection, and Google Drive root folder.

---

### 2. CoStar Lead Ingestion Wizard (`/projects/[id]/import`)
1.  Navigate to **Import Properties**.
2.  Select target **Campaign** or **Portfolio**.
3.  Upload a CoStar export file (`.csv` or `.xlsx`).
4.  **Column Mapping Step**:
    - The engine performs fuzzy matching against existing project dynamic fields (`field_definitions`).
    - Map columns to existing fields, define new dynamic custom fields, or designate outreach target email / unit count columns.
    - Dropped columns are dimmed in the preview table.
5.  **Execute Job**: Import runs asynchronously (`import_jobs`), inserting deal rows, populating `deal_fields`, and seeding document checklists (`PERFORM seed_default_checklist(deal_id)`).

---

### 3. The 8-Stage Flexible Deal Lifecycle (`/projects/[id]/deals`)
Deals progress through an 8-stage state machine:

```
[lead] ──► [outreach] ──► [response] ──► [underwriting] ──► [loi] ──► [closed]
  │           │              │                │              │
  ▼           ▼              ▼                ▼              ▼
[archived] [archived]     [archived]       [archived]     [failed]
```

- **Stage Bar**: Click any stage step on the `DealStageBar` to transition state.
- **Rules**: Deals before `loi` can be set to `archived`. Deals at or past `loi` cannot be archived — they must exit as `closed` or `failed`.
- **Virtualized Grid (`DataGrid`)**: Manage thousands of deals with keyboard navigation (Arrow keys, Enter, Tab), cell edit glow feedback, column reordering/resizing, and batch actions (bulk deletion, batch stage assignment).

---

### 4. Gmail Mail Merge Outreach & Snoozing
1.  **Mail Merge Templates**: Define reusable templates with dynamic variables (`{{address}}`, `{{unit_count}}`, `{{market}}`) in **Campaign Settings**.
2.  **Send Outreach**: Send single or batch outreach emails directly via the connected project Gmail account.
3.  **Gmail Thread View**: Expand message accordions to read full thread histories (`EmailThreadList.tsx`), compose inline replies with file attachments (`InlineReplyBox.tsx`), or snooze threads until a future date (`snoozed_threads`).
4.  **Automatic Webhook Sync**: Incoming broker replies automatically push via Pub/Sub webhooks, updating outreach status to `replied` in real time.

---

### 5. Financial Underwriting & 2-Tier Approvals
1.  Navigate to the **Underwriting** tab on any deal detail drawer.
2.  Input financial metrics: Asking Price, Market Cap Rate, Rent Growth 12mo & Forecast %, Vacancy %, Cap Rate %, Comps summary, Purchase Price, Total Capex, and Occupancy %.
3.  **Auto-Calculations**: The platform dynamically computes Price/Unit, Purchase Price/Unit, Capex/Unit, Market Delta %, IRR %, Equity Multiple, Cash-on-Cash %, and Projected Profit.
4.  **2-Tier Review Approvals**:
    - Toggle `proceed_with_loi` decision flag.
    - Record sign-offs for Underwriting Analyst, Senior Reviewer 1, and Executive Reviewer 2.

---

### 6. LOI Tracking & Negotiation Counter-Rounds
1.  Open the **LOI** tab for deals at or past the LOI stage.
2.  Input offer date, initial offered price, and verify mandatory due diligence booleans (Insurance Declarations, Vendor Service Contracts, Utility Bills).
3.  **Counter-Rounds Table**: Log multi-turn negotiations (`round_num`, `party`: `'buyer'` \| `'seller'`, `price`, `date`, `notes`).
4.  Finalize outcome: `deal_reached` (with final price & close date) or `fallen_through` (with fallout date & reason).

---

### 7. Google Drive File Workspace (`DriveFileManager`)
- Each deal generates an linked Google Drive folder (`drive_folder_id`).
- Upload files directly with drag-and-drop support, including full folder trees via WebKit directory drop traversal.
- Rename, trash/untrash, create subfolders, and monitor account storage quotas in real time.

---

## Part 2: Client Sponsor Workflows

Client Sponsors (investors, executive partners) operate in a simplified, read-only portal scoped to sponsored projects.

### 1. Active Deals Overview (`/projects/[id]/overview`)
- High-level KPI summary of active pipeline deals.
- Filtered grid showing non-archived active deals from sponsored projects.
- Client users are shielded from raw leads, low-score deals, and internal notes by RLS policies.

---

### 2. Sponsor Call Queue (`/projects/[id]/calls`)
- View published call briefs prepared by the internal team prior to investor meetings.
- Read deal summaries, contact roles, and phone numbers.
- **Client Notes**: Add questions or feedback in the **Client Notes** text field. Notes synchronize instantly to the internal team's view.
- Update call status (`pending` -> `completed` / `cancelled`).
