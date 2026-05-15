'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'

export default function SettingsPage() {
 const [gmailConnected, setGmailConnected] = useState(false)

 useEffect(() => {
 const params = new URLSearchParams(window.location.search)
 if (params.get('gmail') === 'connected') {
 if (window.requestIdleCallback) {
 window.requestIdleCallback(() => {
 setGmailConnected(true)
 });
 } else {
 setTimeout(() => {
 setGmailConnected(true)
 }, 0);
 }
 }
 }, [])

 return (
 <div>
 <PageHeader title="Settings" description="Manage your account and integrations" />
 <div className="space-y-6">
 <div className=" rounded-xl border p-6">
 <h2 className="text-lg font-semibold mb-4">Gmail Connection</h2>
 {gmailConnected ? (
 <div className="flex items-center gap-2">
 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ">Gmail Connected</span>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-700 text-sm">Gmail not connected</div>
 <a href="/api/auth/google" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary -foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
 Connect Gmail
 </a>
 </div>
 )}
 </div>

 <div className=" rounded-xl border p-6">
 <h2 className="text-lg font-semibold mb-4">Campaign Management</h2>
 <p className="text-sm ">Campaign management coming soon.</p>
 </div>
 </div>
 </div>
 )
}
