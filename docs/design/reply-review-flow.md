# Reply Review Flow — Design Plan

## Problem

Today the system detects email replies automatically (webhook sets `email_outreach.status = 'replied'`) but never advances deal stage. The campaign Outreach Funnel shows "Responses Received" but actually counts "responses someone manually classified." This gap means replies can arrive and sit invisible — the funnel looks dead even when replies are coming in.

>> ## Chosen Approach: Option B — Reply Detected → Flagged for Review → Human Confirms

System detects reply → deal gets "Reply Pending" badge → human reviews → move to response stage or dismiss (stays in outreach).

---

## Portfolio Context (Foundation)

When deals are grouped into a portfolio:

- The **portfolio deal** (`is_portfolio = true`) owns all communication
- `email_outreach` records belong to the portfolio deal, not member deals
- Member deals don't get their own outreach emails — they ride on the portfolio's communication
- A reply to the portfolio email thread is a reply about the whole group
- Member deal details page's emails tab shows a button to view the portfolio deal's emails tab
- Underwriting, deal room, and LOI tabs remain separate for each member deal and for the portfolio deal itself

>> **Stage behavior for portfolios:**
- **Portfolio deal:** System detects reply → deal gets "Reply Pending" badge → human reviews → move to `response` stage or dismiss (stays in `outreach`).
- **Member deals:** Follow the portfolio. When the portfolio deal advances to `response`, member deals at `outreach` follow along automatically. They don't get their own email threads or review flow.

---

## Flow

### Step 1: Email Goes Out

Mass email sent from campaign. Deal(s) move to `outreach` stage. Works the same as today. Portfolio deals send under the portfolio identity; member deals are silent.

### Step 2: Reply Arrives — Deal Flagged

Webhook detects a reply to the email thread:

1. `email_outreach.status` → `replied`, `responded_at` → now (already happens today)
2. **New:** `email_outreach.needs_review` → `true`
3. **New:** Deal stays at `outreach` stage, but a `reply_pending` status is surfaced in the UI

The badge is the hook. It signals "there's something here that needs a human look."

### Step 3: Notification Surfaces

**Campaign funnel card (right sidebar on Mass Emailing tab):**

```
Leads (not emailed) .......... 45
Outreach Sent ................ 30
Awaiting Review ..............  7   ← new row, subtle highlight color
Responses Confirmed .......... 12
```

**Deal table (leads tab):**
- Deals with unreviewed replies show a colored "Reply Pending" badge/chip
- Portfolio deals show the badge; member deals show a small portfolio link icon instead
- Filter/sort option: "Needs Review"

### Step 4(A): Badge Click → Emails Tab

Clicking the "Reply Pending" badge on any deal row:

1. Navigates to the campaign Emails tab
2. URL drives which thread is open: `?tab=emails&reviewThread=<threadId>`
3. That specific reply thread is expanded, highlighted, and scrolled into view
4. Review actions appear inline on the thread:
   - **Confirm as Response** — deal advances to `response`
   - **Dismiss (Noise)** — badge cleared, deal stays `outreach`
   - **Snooze** — badge hidden for N days, comes back after

### Step 4(B): Bulk Review — Emails Tab "Review Mode"

Emails tab gets a toggle at the top:

```
[ View All Emails ]    [ Review Replies (7) ]
```

Clicking "Review Replies" enters review mode:

```
┌─────────────────────────────────────────────────────┐
│ ← Back to All Emails    Reviewing 3 of 7            │
│ ████████████░░░░░░░░░░  43%                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ Reply #1 ──────────────────────────────────┐   │
│  │ From: bob@investor.com                       │   │
│  │ Re: 123 Main St — Investment Opportunity     │   │
│  │                                              │   │
│  │ "Thanks for reaching out. We're interested   │   │
│  │  but need more info on cap rate..."          │   │
│  │                                              │   │
│  │ Property: 123 Main St                        │   │
│  │ [Portfolio: Downtown Portfolio (5 props)]    │   │  ← only if portfolio deal
│  │                                              │   │
│  │  [✓ Confirm]    [✗ Dismiss]    [⏳ Snooze]   │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ Reply #2 ──────────────────────────────────┐   │
│  │ (next reply card, stacked below)              │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Review mode behaviors:**
- One reply card per unreviewed thread, stacked vertically
- Keyboard shortcuts: `→` / `Enter` = Confirm, `←` / `Esc` = Dismiss, `S` = Snooze
- After each action, the next reply auto-scrolls into focus
- Progress bar updates live
- "Back to All Emails" exits review mode; remaining unreviewed threads stay in the queue
- Portfolio deal replies show the portfolio name and member count on the card

### Step 5: Outcome

#### Standalone deal (no portfolio):

| Action | Result |
|---|---|
| Confirm | Deal `outreach` → `response`. Funnel updates. |
| Dismiss | `email_outreach.needs_review` → `false`. Badge removed. Deal stays `outreach`. |
| Snooze | `email_outreach.snoozed_until` → future timestamp. Badge hidden, comes back after expiry. |

#### Portfolio deal:

| Action | Result |
|---|---|
| Confirm | Portfolio deal `outreach` → `response`. All non-archived member deals at `outreach` also advance to `response`. |
| Dismiss | Portfolio deal stays `outreach`. Badge cleared. Member deals unaffected. |
| Snooze | Badge hidden for N days on the portfolio deal only. Member deals unaffected. |

#### Single deal inside a portfolio (edge case):

If a member deal somehow has its own email thread (manual send, not mass campaign), it gets its own badge and review flow. But the norm is: portfolio owns the thread, portfolio gets reviewed.

### Step 6: Funnel Stays Honest

| Funnel Metric | Counts |
|---|---|
| Leads (not emailed) | Deals at `lead` stage |
| Outreach Sent | Deals at `outreach`, no unreviewed reply |
| Awaiting Review | Deals at `outreach` with `email_outreach.needs_review = true` |
| Responses Confirmed | Deals at `response` stage (human confirmed) |

Portfolio deals count as **one** in the funnel. Member deals follow silently.

---

## What Needs to Change

### Database

- `email_outreach` table: add `needs_review` (boolean, default `false`) and `snoozed_until` (timestamptz, nullable)

### Backend

- **Webhook** (`/api/emails/webhook`): when a reply is detected, also set `needs_review = true` on the `email_outreach` record
- **Review actions endpoint** (new or modified): confirm / dismiss / snooze a reply. On confirm: transition deal stage `outreach` → `response`. For portfolio deals: also transition all eligible member deals.
- **Deals API**: return a `has_pending_review` flag with each deal for badge rendering
- **Email outreach API**: support filtering by `needs_review = true` for review mode

### Frontend

- **Campaign funnel card**: add "Awaiting Review" row; fetch count from deals with a pending review
- **Deal table**: render "Reply Pending" badge on deals where `has_pending_review = true`; navigate to `?tab=emails&reviewThread=<threadId>` on click; add "Needs Review" filter/sort option
- **Emails tab**: add review mode toggle, stacked reply cards, keyboard navigation, and progress bar
- **Email thread component**: inline review actions (confirm / dismiss / snooze) when `needs_review = true`

---

## States Summary

| Deal State | What It Means | How It Got There |
|---|---|---|
| `lead` | Not emailed yet | Default on import |
| `outreach` (sent) | Emailed, no reply detected | After send succeeds |
| `outreach` (reply pending) | Reply detected, awaiting review | Webhook detected reply, set `needs_review = true` |
| `response` | Human confirmed real reply | After review → confirm |
| `outreach` (dismissed) | Reply was noise, still in outreach | After review → dismiss |
| `outreach` (snoozed) | Reply parked for later | After review → snooze |

---

## Future Possibilities (Out of Scope for Now)

- **Option D-style smart filtering**: auto-detect bounce-backs, out-of-office, mailer-daemon and auto-dismiss them without human review
- **Bulk actions across campaigns**: review replies across all campaigns from a central inbox
- **Reply sentiment / urgency tagging**: surface "hot" replies (strong interest signals) before "warm" ones
