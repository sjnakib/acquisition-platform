import { google } from 'googleapis'
import { callWithConnection } from './oauth'

/**
 * Look up display names for email addresses from Gmail's interaction history
 * via the People API (otherContacts.search).
 *
 * Returns a Map of email → display name. Only returns names for addresses
 * the Gmail account has previously interacted with. Unknown addresses are
 * omitted from the result — callers should fall back to formatNameFromEmail.
 */
export async function lookupNamesByEmail(
  connectionId: string,
  emails: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  if (!emails.length) return result

  try {
    return await callWithConnection(connectionId, async (auth) => {
      const people = google.people({ version: 'v1', auth })
      const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase()))]
      const batchSize = 10

      for (let i = 0; i < uniqueEmails.length; i += batchSize) {
        const batch = uniqueEmails.slice(i, i + batchSize)

        for (const email of batch) {
          try {
            const res = await people.otherContacts.search({
              query: email,
              readMask: 'names,emailAddresses',
              pageSize: 3,
            })

            const otherContacts = res.data.results ?? []
            for (const contact of otherContacts) {
              const person = contact.person
              if (!person) continue

              const personEmails = person.emailAddresses ?? []
              const match = personEmails.find(
                (e) => e.value?.toLowerCase() === email,
              )
              if (!match) continue

              const displayName = person.names?.[0]?.displayName
              if (displayName) {
                result.set(email, displayName)
              }
              break
            }
          } catch {
            // Skip individual lookup errors — non-fatal
          }
        }
      }

      return result
    })
  } catch {
    // Connection or auth error — return empty, caller falls back
  }

  return result
}
