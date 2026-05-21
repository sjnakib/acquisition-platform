'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Something went wrong</h2>
      <p className="text-sm max-w-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>{error.message}</p>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-[34px] px-[14px] text-[13px] active:scale-[0.98]"
        style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}
      >
        Try again
      </button>
    </div>
  )
}
