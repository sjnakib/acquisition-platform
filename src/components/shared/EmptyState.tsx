import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
 icon?: LucideIcon
 title: string
 description?: string
 action?: {
 label: string
 onClick: () => void
 }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
 return (
 <div className="flex flex-col items-center justify-center text-center py-16 px-8 gap-3">
 {Icon && <Icon className="w-10 h-10 mb-1" style={{ color: 'var(--color-text-tertiary)' }} />}
 <h2 className="text-[17px] font-medium" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>
 {title}
 </h2>
 {description && (
 <p className="text-[13px] max-w-[320px]" style={{ color: 'var(--color-text-tertiary)' }}>
 {description}
 </p>
 )}
 {action && (
 <Button onClick={action.onClick} variant="secondary" size="sm" className="mt-1">
 {action.label}
 </Button>
 )}
 </div>
 )
}
