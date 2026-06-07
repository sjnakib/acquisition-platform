export type ColumnAction =
  | { action: 'email_target' }
  | { action: 'field'; key: string }
  | { action: 'new_field'; key: string; label: string; dataType: string }
  | { action: 'drop' }

export type ColumnMapping = Record<string, ColumnAction>

/**
 * Auto-detect the import action for a column header.
 * - Headers matching email patterns → `email_target`
 * - Headers matching an existing field_definitions key → `field`
 * - Everything else → `new_field` (auto-creates a field definition on confirm)
 */
export function detectAction(
  header: string,
  existingKeys: string[],
): ColumnAction {
  const h = header.toLowerCase().trim().replace(/\s+/g, ' ')

  // Broad match for email columns — catches "Email", "e-mail", "Email Address",
  // "Contact Email", "Mail_To", "Email_Addr", etc.
  if (/^(e-?mail|contact\s*e-?mail|e-?mail\s*address|mail_to|e-?mail_addr)/i.test(h)) {
    return { action: 'email_target' }
  }

  // Normalise header into a key and check against existing field definitions
  const key = header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  if (existingKeys.includes(key)) {
    return { action: 'field', key }
  }

  return { action: 'new_field', key, label: header, dataType: 'text' }
}

/** Validate a column mapping before confirm. Returns human-readable error messages. */
export function validateMapping(headers: string[], mapping: ColumnMapping): string[] {
  const errors: string[] = []
  const fieldKeys = new Set<string>()
  let hasAddress = false
  let hasUnits = false
  let hasEmailTarget = false

  for (const header of headers) {
    const action = mapping[header]

    // Check: column has no mapping selected at all
    if (!action) {
      errors.push(`Column "${header}" has no mapping — choose a field or drop it`)
      continue
    }

    if (action.action === 'drop') continue

    if (action.action === 'field') {
      if (!action.key?.trim()) {
        errors.push(`Column "${header}" is mapped to a field but the key is empty`)
        continue
      }
      if (fieldKeys.has(action.key)) {
        errors.push(`Duplicate field mapping: "${action.key}" mapped from multiple columns`)
      }
      fieldKeys.add(action.key)
      if (action.key === 'address') hasAddress = true
      if (action.key === 'unit_count') hasUnits = true
    }

    if (action.action === 'new_field') {
      if (!action.key?.trim()) {
        errors.push(`Column "${header}" is set to create a new field but the key is empty`)
      }
      if (!action.label?.trim()) {
        errors.push(`Column "${header}" is set to create a new field but the label is empty`)
      }
      if (fieldKeys.has(action.key)) {
        errors.push(`Duplicate field mapping: "${action.key}" mapped from multiple columns`)
      }
      fieldKeys.add(action.key)
      if (action.key === 'address') hasAddress = true
      if (action.key === 'unit_count') hasUnits = true
    }

    if (action.action === 'email_target') {
      hasEmailTarget = true
    }
  }

  const nonDropped = headers.filter(
    (h) => mapping[h] && mapping[h]?.action !== 'drop',
  )

  if (nonDropped.length === 0) {
    errors.push('No columns mapped — address, units, and email target are required.')
  } else {
    if (!hasAddress) {
      errors.push('No column mapped to "address" — address is required.')
    }
    if (!hasUnits) {
      errors.push('No column mapped to "unit_count" (Units) — units field is required.')
    }
    if (!hasEmailTarget) {
      errors.push('No column mapped to "Email Target" — email target is required.')
    }
  }

  return errors
}
