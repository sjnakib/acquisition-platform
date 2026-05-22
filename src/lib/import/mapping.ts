export type ColumnAction =
  | { action: 'system'; field: 'deal_name' }
  | { action: 'email_target' }
  | { action: 'unit_count' }
  | { action: 'field'; key: string }
  | { action: 'new_field'; key: string; label: string; dataType: string }
  | { action: 'drop' }

export type ColumnMapping = Record<string, ColumnAction>

export function validateMapping(headers: string[], mapping: ColumnMapping): string[] {
  const errors: string[] = []
  const unitCols = headers.filter(h => mapping[h]?.action === 'unit_count')
  if (unitCols.length > 1) errors.push('Only one column may be designated as Unit Count.')
  return errors
}
