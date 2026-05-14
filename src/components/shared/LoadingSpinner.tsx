interface LoadingSpinnerProps { size?: 'sm' | 'md' | 'lg' }

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-[3px]',
  lg: 'h-10 w-10 border-4',
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className={`animate-spin rounded-full border-slate-200 border-t-blue-600 ${sizeMap[size]}`} />
  )
}
