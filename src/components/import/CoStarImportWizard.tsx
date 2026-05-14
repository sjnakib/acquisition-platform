'use client'

import { useState } from 'react'
import { Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'

export function CoStarImportWizard() {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [campaignId, setCampaignId] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [importing, setImporting] = useState(false)

  async function handlePreview() {
    if (!file || !campaignId) return
    const form = new FormData()
    form.append('file', file)
    form.append('campaign_id', campaignId)

    const res = await fetch('/api/deals/import', { method: 'POST', body: form })
    const data = await res.json()
    setPreview(data)
    setStep(2)
  }

  async function handleConfirm() {
    if (!preview?.batchId) return
    setImporting(true)
    setStep(3)

    await fetch(`/api/deals/import/${preview.batchId}/confirm`, { method: 'POST' })

    const poll = setInterval(async () => {
      const res = await fetch(`/api/deals/import/${preview.batchId}/status`)
      const data = await res.json()
      if (data.status === 'done' || data.status === 'failed') {
        clearInterval(poll)
        setImporting(false)
        setStep(4)
      }
    }, 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className="ml-2 text-xs text-slate-500 hidden sm:inline">
              {s === 1 ? 'Upload' : s === 2 ? 'Preview' : s === 3 ? 'Import' : 'Done'}
            </span>
            {s < 4 && <div className="w-12 h-0.5 mx-2 bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Campaign</label>
            <input
              type="text"
              placeholder="Enter campaign ID..."
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full max-w-md h-9 rounded-md border border-slate-300 px-3 text-sm"
            />
          </div>
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-400 cursor-pointer"
            onClick={() => document.getElementById('wizard-file')?.click()}
          >
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-600 font-medium">Drop .xlsx file or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">CoStar export format</p>
            <input id="wizard-file" type="file" accept=".xlsx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {file && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FileSpreadsheet className="h-4 w-4" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
          <button
            disabled={!file || !campaignId}
            onClick={handlePreview}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Preview Import
          </button>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-700 font-medium">{preview.totalNew ?? 0} new</span>
            <span className="text-slate-400">properties to import</span>
          </div>
          <button onClick={handleConfirm} disabled={!preview.totalNew} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            Import {preview.totalNew} Properties
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-slate-600">Importing properties...</p>
        </div>
      )}

      {step === 4 && (
        <div className="text-center py-12">
          <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Import complete!</p>
          <button onClick={() => { setStep(1); setFile(null); setPreview(null) }} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
