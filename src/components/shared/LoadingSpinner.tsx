interface LoadingSpinnerProps { size?: 'sm' | 'md' | 'lg' | 'page' }

const sizeMap: Record<string, string> = {
 sm: 'h-3.5 w-3.5 border-[1.5px]',
 md: 'h-5 w-5 border-2',
 lg: 'h-8 w-8 border-[3px]',
 page: 'h-12 w-12 border-4',
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
 return (
 <div
 className={`animate-spin rounded-full ${sizeMap[size]}`}
 style={{
 borderColor: 'var(--color-surface-3)',
 borderTopColor: 'var(--accent)',
 }}
 />
 )
}
