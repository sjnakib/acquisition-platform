/**
 * Shared Turnstile verification — usable both from API routes (for external
 * client requests) and from other server-side code (for internal callers that
 * need to verify a token without making an HTTP round-trip through the API).
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    },
  )

  const data = await res.json()
  return data.success === true
}
