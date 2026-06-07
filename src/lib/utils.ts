import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(1)}%`
}

/**
 * Derive a human-readable name from an email address.
 * Splits on separators, camelCase boundaries, and digit boundaries.
 *
 *   jamilshafaat@gmail.com       → Jamilshafaat
 *   shafaat.jamil@domain.com     → Shafaat Jamil
 *   jamilShafaat@domain.com      → Jamil Shafaat
 *   shafaat561@gmail.com         → Shafaat 561
 *   john.doe+tag@domain.com      → John Doe
 */
export function formatNameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null

  const local = email.split('@')[0]
  if (!local) return null

  // Step 1: Replace common separators with spaces
  let name = local.replace(/[._\-+]+/g, ' ')

  // Step 2: Split camelCase (lowercase→uppercase transition)
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2')

  // Step 3: Split digit boundaries (letter→digit, digit→letter)
  name = name.replace(/([a-zA-Z])(\d)/g, '$1 $2')
  name = name.replace(/(\d)([a-zA-Z])/g, '$1 $2')

  // Step 4: Capitalize each word
  name = name.replace(/\b\w/g, (c) => c.toUpperCase())

  // Step 5: Collapse multiple spaces and trim
  name = name.replace(/\s+/g, ' ').trim()

  return name || null
}
