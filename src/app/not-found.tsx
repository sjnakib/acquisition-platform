export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
      <h1 className="text-6xl font-bold text-slate-200">404</h1>
      <p className="text-slate-600 text-lg">This page doesn't exist.</p>
      <a href="/dashboard" className="text-blue-600 hover:underline text-sm">Go to Dashboard</a>
    </div>
  )
}
