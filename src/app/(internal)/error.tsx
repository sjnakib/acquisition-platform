'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-semibold text-slate-800">Something went wrong</h2>
      <p className="text-slate-500 text-sm max-w-sm text-center">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  )
}
