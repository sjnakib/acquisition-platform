import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      {Icon && <Icon className="h-12 w-12 text-slate-400" />}
      <h3 className="text-lg font-medium text-slate-600">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-xs text-center">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
