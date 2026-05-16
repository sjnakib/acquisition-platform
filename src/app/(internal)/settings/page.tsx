'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { pageHeadings } from '@/lib/page-headings'

export default function SettingsPage() {
  const [gmailConnected, setGmailConnected] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      const cb = () => setGmailConnected(true)
      if (window.requestIdleCallback) { window.requestIdleCallback(cb) } else { setTimeout(cb, 0) }
    }
  }, [])

  return (
    <div>
      <PageHeader title={pageHeadings.settings.title} description={pageHeadings.settings.description} />
      <div className="space-y-6">
        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Gmail Connection</h2>
          {gmailConnected ? (
            <Badge variant="success" dot>Gmail Connected</Badge>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md p-3 text-sm" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning-text)' }}>
                Gmail not connected
              </div>
              <a
                href="/api/auth/google"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 active:scale-[0.98] h-[34px] px-[14px] text-[13px]"
                style={{ background: 'var(--accent)', color: '#FFFFFF' }}
              >
                Connect Gmail
              </a>
            </div>
          )}
        </div>

        <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', boxShadow: 'var(--shadow-xs)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Campaign Management</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Campaign management coming soon.</p>
        </div>
      </div>
    </div>
  )
}
