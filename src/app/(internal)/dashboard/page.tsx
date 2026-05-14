import { PageHeader } from '@/components/shared/PageHeader'

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your acquisition pipeline" />
      <div className="grid gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-slate-500 text-sm">Pipeline dashboard coming soon.</p>
        </div>
      </div>
    </div>
  )
}
