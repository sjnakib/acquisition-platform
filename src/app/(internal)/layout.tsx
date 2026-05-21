export default function InternalLayout({ children }: { children: React.ReactNode }) {
  // Sidebar and breadcrumb handled by (internal)/projects/[id]/layout.tsx
  // This root layout is a passthrough for the projects route group
  return <>{children}</>
}
