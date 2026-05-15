'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
 return (
 <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
 <h2 className="text-xl font-semibold ">Something went wrong</h2>
 <p className=" text-sm max-w-sm text-center">{error.message}</p>
 <button
 onClick={reset}
 className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary -foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
 >
 Try again
 </button>
 </div>
 )
}
