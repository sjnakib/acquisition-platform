interface CallBriefProps {
  brief: {
    id: string
    summary_text: string | null
    published: boolean
    call_status: string
    client_notes: string | null
    deals?: {
      deal_name: string | null
      address: string | null
      city: string | null
      state: string | null
      score: string | null
    }
  }
  onUpdate?: (id: string, data: Record<string, unknown>) => void
}

export function CallBrief({ brief, onUpdate }: CallBriefProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">{brief.deals?.deal_name ?? 'Deal'}</h3>
          <p className="text-sm text-slate-500">{[brief.deals?.address, brief.deals?.city, brief.deals?.state].filter(Boolean).join(', ')}</p>
        </div>
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
          brief.call_status === 'completed' ? 'bg-green-100 text-green-700' :
          brief.call_status === 'cancelled' ? 'bg-red-100 text-red-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {brief.call_status}
        </span>
      </div>
      <p className="text-sm text-slate-600 mb-3">{brief.summary_text || 'No summary available.'}</p>
      {brief.client_notes && (
        <div className="bg-slate-50 rounded p-3 text-sm text-slate-600">
          <span className="text-xs font-medium text-slate-400 block mb-1">Client Notes:</span>
          {brief.client_notes}
        </div>
      )}
    </div>
  )
}
