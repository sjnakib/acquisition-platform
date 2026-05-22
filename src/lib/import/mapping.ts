export type ColumnAction =
  | { action: 'email_target' }
  | { action: 'field'; key: string }
  | { action: 'new_field'; key: string; label: string; dataType: string }
  | { action: 'drop' }

export type ColumnMapping = Record<string, ColumnAction>

export function validateMapping(_headers: string[], _mapping: ColumnMapping): string[] {
  return []
}
