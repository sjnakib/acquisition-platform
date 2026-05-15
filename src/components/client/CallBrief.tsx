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

export function CallBrief({ brief }: CallBriefProps) {
 return (
 <div className=" rounded-xl border p-5">
 <div className="flex items-start justify-between mb-3">
 <div>
 <h3 className="font-semibold ">{brief.deals?.deal_name ?? 'Deal'}</h3>
 <p className="text-sm ">{[brief.deals?.address, brief.deals?.city, brief.deals?.state].filter(Boolean).join(', ')}</p>
 </div>
 <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
 brief.call_status === 'completed' ? ' ' :
 brief.call_status === 'cancelled' ? ' ' :
 ' '
 }`}>
 {brief.call_status}
 </span>
 </div>
 <p className="text-sm mb-3">{brief.summary_text || 'No summary available.'}</p>
 {brief.client_notes && (
 <div className=" rounded p-3 text-sm ">
 <span className="text-xs font-medium block mb-1">Client Notes:</span>
 {brief.client_notes}
 </div>
 )}
 </div>
 )
}
