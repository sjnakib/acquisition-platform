'use client'

import { useState } from 'react'
import { Upload, FileSpreadsheet } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [campaignId, setCampaignId] = useState('')
  const [step, setStep] = useState(1)

  return (
    <div>
      <PageHeader title="Import from CoStar" subtitle="Upload a CoStar Excel export to bulk-import properties" />
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Campaign</label>
              <input
                type="text"
                placeholder="Select campaign..."
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full max-w-md h-9 rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 font-medium">Drop .xlsx file or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">CoStar export format only</p>
              <input
                id="file-input"
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {file && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileSpreadsheet className="h-4 w-4" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
            <button
              disabled={!file || !campaignId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              onClick={() => setStep(2)}
            >
              Preview Import
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">Import preview coming soon.</p>
          </div>
        )}
      </div>
    </div>
  )
}
