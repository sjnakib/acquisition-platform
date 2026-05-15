export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-muted">
      <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
      <p className="text-muted-foreground text-lg">This page doesn&apos;t exist.</p>
      <a href="/dashboard" className="text-primary hover:underline text-sm">Go to Dashboard</a>
    </div>
  )
}
