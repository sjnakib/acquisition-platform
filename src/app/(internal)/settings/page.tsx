'use client'

import { PageHeader } from '@/components/shared/PageHeader'
import { pageHeadings } from '@/lib/page-headings'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title={pageHeadings.settings.title} description={pageHeadings.settings.description} />
      <div className="space-y-6">
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Campaign Management</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Campaign management coming soon.</p>
        </div>
      </div>
    </div>
  )
}
