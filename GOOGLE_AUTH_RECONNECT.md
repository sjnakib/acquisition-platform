# Google OAuth Reconnect UX

## Problem

Google OAuth refresh tokens were expiring (7-day limit for apps in Testing publish status) and the system had zero detection for `invalid_grant` errors. These errors propagated unhandled through every Gmail and Drive API call — returning 500 or being silently swallowed. Users saw empty inboxes and broken Drive with no indication re-authentication was needed.

Additionally, the OAuth callback overwrote valid `refresh_token` values with `null` on re-auth, permanently breaking connections.

## Root Causes (5 issues)

| # | Issue | Impact |
|---|-------|--------|
| 1 | `invalid_grant` not detected anywhere in codebase | Error swallowed / 500, no user guidance |
| 2 | OAuth callback nullified refresh_token on re-auth | Permanent connection breakage |
| 3 | In-memory cache retained bad credentials for 5 minutes | Repeated failures after first error |
| 4 | Route handlers returned 500 on `invalid_grant` | Frontend couldn't distinguish auth expiry from server error |
| 5 | Frontend `gmailConnected` never transitioned to `false` on error | User saw empty inbox with zero indication |

## Solution Architecture

### Central error handling layer (`src/lib/google/oauth.ts`)

Three new exports:

- **`GoogleAuthError`** — Typed error class with code `'invalid_grant' | 'not_connected'`. Static `isInvalidGrant(err)` detects raw GaxiosErrors from Google API calls.

- **`invalidateConnection(connectionId)`** — Evicts in-memory OAuth2 cache + nullifies `access_token`, `refresh_token`, `expiry` in the `google_connections` table. Skips nothing — both project and system connections are nullified so the UI can detect the expired state.

- **`callWithConnection(connectionId, fn)`** — Wrapper for all gmail.ts, drive.ts, and people.ts functions. Catches `invalid_grant`, calls `invalidateConnection()`, throws typed `GoogleAuthError`.

### Token health API (`token_valid`)

`GET /api/projects/[id]` and `GET /api/admin/system-email` now select `access_token, refresh_token` from `google_connections` and return `token_valid: boolean`. This allows the frontend to determine connection health without making a Google API call.

### Three-state model

Every surface uses a shared `useGoogleConnection(projectId?)` hook returning:

```
status: 'connected' | 'expired' | 'disconnected'
```

| State | Condition | UI |
|-------|-----------|----|
| **connected** | `google_connections` row exists, tokens present | Green badge + email, normal operations |
| **expired** | Row exists, tokens nullified by `invalidateConnection()` | Warning badge, reconnect dialog, "Needs Reconnection" |
| **disconnected** | No `google_connections` row | "Connect" button, link to settings |

### Reconnect dialog (`src/components/shared/GoogleReconnectDialog.tsx`)

Reusable Radix Dialog following the `DisconnectEmailDialog` pattern:
- "Reconnect Now" primary button → OAuth flow with `returnTo` parameter (redirects back to current page)
- "Later" / dismiss → downgrades to disconnected state with static reconnect button

### OAuth returnTo

`getAuthUrl()` accepts optional `returnTo` parameter. The callback validates it as a relative path (no open redirect) and redirects back to the user's current page instead of always sending them to settings/admin.

## Files Changed

### New files (3)

| File | Purpose |
|------|---------|
| `src/lib/hooks/useGoogleConnection.ts` | Shared TanStack Query hook — connection state for project or system |
| `src/components/shared/GoogleReconnectDialog.tsx` | Reusable reconnect dialog (Radix Dialog) |
| `GOOGLE_AUTH_RECONNECT.md` | This document |

### Modified files (18)

**Core library:**
| File | Change |
|------|--------|
| `src/lib/google/oauth.ts` | Added `GoogleAuthError`, `invalidateConnection()`, `callWithConnection()`. `getAuthUrl()` accepts `returnTo`. `getAuthedClientByConnection()` throws typed errors + proactive refresh check. `invalidateConnection()` nullifies system tokens too. |
| `src/lib/google/gmail.ts` | All 9 exported functions wrapped in `callWithConnection()` |
| `src/lib/google/drive.ts` | All 13 exported functions wrapped in `callWithConnection()` |
| `src/lib/google/people.ts` | `lookupNamesByEmail()` wrapped in `callWithConnection()` |

**API routes (7):**
| File | Change |
|------|--------|
| `src/app/api/projects/[id]/route.ts` | Selects `access_token, refresh_token`, returns `token_valid` |
| `src/app/api/admin/system-email/route.ts` | Selects `access_token, refresh_token`, returns `token_valid` |
| `src/app/api/auth/google/route.ts` | Passes `returnTo` query param to `getAuthUrl()` |
| `src/app/api/auth/google/callback/route.ts` | Preserves `refresh_token` on re-auth. Reads `returnTo` from state, validates, redirects. |
| `src/app/api/emails/send/route.ts` | Catches `GoogleAuthError` → 401 `google_auth_expired` |
| `src/app/api/campaigns/[id]/send-emails/route.ts` | Catches `GoogleAuthError` → 401 `google_auth_expired` |
| `src/app/api/auth/google/refresh-watch/route.ts` | Wrapped in `callWithConnection()` for auto-invalidation |
| `src/app/api/emails/webhook/route.ts` | Wrapped in `callWithConnection()` for auto-invalidation |

**Route handlers with GoogleAuthError catch blocks (13):**
`deals/[id]/emails/route.ts`, `deals/[id]/emails/send/route.ts`, `deals/[id]/emails/threads/route.ts`, `deals/[id]/emails/attachments/route.ts`, `deals/[id]/drive/files/route.ts`, `deals/[id]/drive/folders/route.ts`, `deals/[id]/drive/folders/batch/route.ts`, `deals/[id]/drive/route.ts`, `projects/[id]/drive/browse/route.ts`, `projects/[id]/drive/create-folder/route.ts`, `projects/[id]/drive/storage/route.ts`, `projects/[id]/drive/token/route.ts`, `campaigns/[id]/emails/route.ts`

**Frontend pages (5):**
| File | Change |
|------|--------|
| `src/app/(internal)/projects/[id]/settings/page.tsx` | Uses `useGoogleConnection`. Three-state UI: connected/expired/disconnected. |
| `src/app/admin/page.tsx` | Uses `useGoogleConnection()` for system email. Three-state card. |
| `src/app/(internal)/campaigns/[id]/page.tsx` | Uses `useGoogleConnection`. Status card + `GoogleReconnectDialog`. |
| `src/app/(internal)/projects/[id]/campaigns/[campaignId]/page.tsx` | Uses `useGoogleConnection`. Three-state Sending Identity card + dialog. |

**Shared components (4):**
| File | Change |
|------|--------|
| `src/components/shared/EmailThreadList.tsx` | Added `onAuthExpired` callback. 401 handler checks `google_auth_expired`. |
| `src/components/deals/DealEmailView.tsx` | Uses `useGoogleConnection`. Expired state + `GoogleReconnectDialog`. `sendMutation.onError` opens dialog on auth expiry. |
| `src/components/campaigns/CampaignEmailView.tsx` | Same pattern as `DealEmailView`. |
| `src/components/deals/DriveFileManager.tsx` | Uses `useGoogleConnection`. 14 Drive API call sites catch `google_auth_expired`. Expired state UI + `GoogleReconnectDialog`. |
| `src/components/campaigns/EmailTemplateManager.tsx` | Added `onAuthExpired` prop. Catches `google_auth_expired` during send. |

**Validation:**
| File | Change |
|------|--------|
| `src/lib/validations/project.schema.ts` | `patchProjectSchema` now includes `google_connection_id` |

## Coverage Matrix

| Surface | Connected | Expired | Disconnected |
|---------|-----------|---------|-------------|
| Settings page | Green badge + email | Warning badge + Reconnect button | Connect Google button |
| Admin panel (system email) | Green badge + email | Warning badge + Reconnect + Disconnect | Connect Gmail button |
| Deal emails tab | Email composer | Reconnect dialog → "Google Connection Expired" + "Reconnect Now" | "Gmail Connection Required" + Settings link |
| Deal documents tab | Drive browser | "Google Connection Expired" + Reconnect button | N/A (no folder state) |
| Campaign detail (global) | Green dot + email in status card | Yellow dot + "Reconnect Gmail" button | Yellow dot + Settings link |
| Campaign detail (project) | Green dot + email in Sending Identity | Warning + "Reconnect" button | Warning + Settings link |
| Campaign emails view | Email view | Reconnect dialog → expired banner | "Gmail Connection Required" + Settings link |
| Portfolio tabs | Inherits from DealDetailView | Inherited | Inherited |
| EmailTemplateManager | Send enabled | Toast + `onAuthExpired` → dialog in parent | Send disabled + warning banner |

## Token Expiry Flow

```
1. Google API call fails with invalid_grant
2. callWithConnection() detects it
3. invalidateConnection() called:
   - Evicts in-memory OAuth2 cache
   - Nullifies access_token + refresh_token in google_connections
4. GoogleAuthError thrown with code 'invalid_grant'
5. Route handler catches it → returns 401 { error: 'google_auth_expired' }
6. Frontend detects:
   - EmailThreadList: 401 → gmailConnected: false + onAuthExpired()
   - DriveFileManager: google_auth_expired in response → setAuthExpired(true)
   - EmailTemplateManager: google_auth_expired in catch → onAuthExpired()
   - useGoogleConnection: polls /api/projects/[id], sees token_valid: false → status: 'expired'
7. UI renders:
   - GoogleReconnectDialog opens (or expired state with Reconnect button)
   - Badge changes from "Connected" (green) to "Expired" (warning)
   - All Google-dependent operations show expired state
8. User clicks "Reconnect Now":
   - Navigates to /api/auth/google?projectId=X&returnTo=/current/page
   - Google OAuth flow runs (prompt: 'consent' ensures new refresh_token)
   - Callback redirects back to current page with ?gmail=connected
   - useGoogleConnection re-fetches → token_valid: true → status: 'connected'
```

## Key Design Decisions

1. **Three-state over binary** — `connected`/`expired`/`disconnected` instead of just `connected`/`disconnected`. The expired state shows when tokens were nullified but the `google_connections` row still exists (with `google_email`). Without this, the UI would show "Connected" because `google_email` is non-null, while all Google APIs fail.

2. **Shared hook over copy-paste** — `useGoogleConnection` centralizes the connection state logic that was previously duplicated across 5+ components. Single query key enables cache invalidation after connect/disconnect.

3. **`callWithConnection` wrapper** — Instead of adding try/catch to every gmail.ts/drive.ts function, the wrapper catches `invalid_grant` centrally, invalidates the connection, and throws a typed error. Route handlers only need one `instanceof GoogleAuthError` check.

4. **`returnTo` for reconnect UX** — Without it, reconnecting from a deal page would dump the user on the settings page. The `returnTo` parameter flows through OAuth state → callback → redirect, validated as relative-only to prevent open redirect.

5. **System connections also auto-invalidated** — Previously, `invalidateConnection()` skipped system connections (only logged). Now it nullifies tokens for both so the admin panel shows `token_valid: false` and the "Expired" reconnect prompt.

6. **`refresh_token` preservation** — The OAuth callback only writes `refresh_token` if Google issues a new one, preventing re-auth from permanently breaking the connection.
