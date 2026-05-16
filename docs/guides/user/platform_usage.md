# Platform Usage & Workflows

The Acquisition Platform is designed to bridge the gap between heavy, data-intensive underwriting done by the internal acquisition team, and the curated, high-level summaries required by executive clients and investors.

This guide outlines the major workflows tailored to both roles.

---

## Part 1: Internal Team Workflows

Internal users have full control over the platform. Their workspace resides in the `(internal)` route group (e.g., `/dashboard`, `/deals`).

### 1. Ingesting Leads via CoStar Import
Rather than manually entering properties, the team utilizes the **Import Wizard**:
1.  Navigate to **Import**.
2.  Select the target **Campaign** (e.g., "Texas Off-Market 2026").
3.  Upload an `.xlsx` file exported directly from CoStar.
4.  The platform parses the file, checking `property_id` against the database to flag **Duplicates**. It also flags **Invalid** rows missing critical data.
5.  Clicking "Import New Properties" kicks off a background job to safely bulk-insert the leads into the pipeline.

### 2. Deal Pipeline & Underwriting
Once a deal is in the system, the team manages it through an 11-stage pipeline (from *Lead* to *Closed*).
1.  **Market Research:** In the **Underwriting** tab, team members input Asking Prices, Market Cap Rates, and Rent Growth projections.
2.  **Auto-Calculations:** The system instantly calculates Market Delta %, IRR %, Cash-on-Cash %, and Equity Multiples.
3.  **Deal Scoring:** Based on the financials, the team assigns a score: **Very Good, Good, Bad, or Very Bad**. 
    *   *Note:* Only deals marked Good or Very Good will ever become visible to the Client.

### 3. Automated Outreach & Gmail Integration
The platform centralizes communication with brokers and property owners.
1.  **Connect Gmail:** The user connects their Google Workspace account in **Settings**. This grants the system permission to send emails and monitor replies.
2.  **Send Outreach:** From the **Outreach** tab of a deal, the team can send a templated React Email.
3.  **Track Responses:** A Google Pub/Sub webhook continuously listens for replies. When a broker replies, the deal's status automatically updates to **Replied**.
4.  **Classify Response:** The team reads the reply and classifies it (Positive, Negative, Neutral). Positive replies trigger UI prompts to send follow-up Thank You emails or advance the pipeline stage.

### 4. Drafting Call Briefs
Before a synchronous meeting with the client, the internal team prepares summaries.
1.  Navigate to the **Call Brief** tab on a highly-scored deal.
2.  Draft a plain-English summary in the text area.
3.  When ready, toggle the brief to **Published**. The brief is instantly pushed to the Client's dashboard.

---

## Part 2: Client Workflows

Clients (CEOs, investors, partners) log into a restricted, curated environment located in the `(client)` route group. They are shielded from early-stage leads, rejected deals, and internal technical notes.

### 1. Active Deals Overview (`/overview`)
The client's homepage acts as a high-level summary of the portfolio.
*   **Funnel Summary:** Displays aggregated metrics: Deals Reviewed, Currently Active, and LOIs Submitted.
*   **Curated Grid:** Displays cards for deals that the internal team has actively vetted and scored as Good or Very Good.
*   *Security Note:* RLS policies physically prevent the client from querying the database for archived or low-scored deals.

### 2. Call Queue Review (`/calls`)
This page is utilized directly prior to or during meetings with the internal acquisition team.
1.  **Review Published Briefs:** Clients see a feed of all deals that have a Call Brief toggled to "Published" by the internal team.
2.  **Leave Feedback:** Clients can type questions or thoughts into the **Client Notes** section. These notes sync instantly to the internal team's view.
3.  **Mark as Done:** Once the deal has been discussed on the call, the client changes the status to **Completed** or **Cancelled**, moving it out of the active queue and into an archive accordion at the bottom of the page.
