'use client'

import { useState, useEffect } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

export default function SettingsPage() {
  const [gmailConnected, setGmailConnected] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') setGmailConnected(true)
  }, [])

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your account and integrations" />
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Gmail Connection</h2>
          {gmailConnected ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Gmail Connected</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-700 text-sm">Gmail not connected</div>
              <a href="/api/auth/google" className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                Connect Gmail
              </a>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Campaign Management</h2>
          <p className="text-sm text-slate-500">Campaign management coming soon.</p>
        </div>
      </div>
    </div>
  )
}
