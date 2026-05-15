import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DealStageBarProps {
 stage: string
 isArchived?: boolean
 archiveReason?: string | null
}

const STAGES = [
 'lead', 'outreach', 'response', 'document_collection', 'underwritability_review',
 'underwriting', 'scored', 'call_scheduled', 'loi', 'closed',
]

export function DealStageBar({ stage, isArchived, archiveReason }: DealStageBarProps) {
 if (isArchived) {
 return (
 <div className="flex items-center gap-2">
 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-destructive/20">
 Archived
 </span>
 {archiveReason && <span className="text-xs ">{archiveReason}</span>}
 </div>
 )
 }

 const currentIndex = STAGES.indexOf(stage)

 return (
 <div className="hidden sm:flex items-center gap-0">
 {STAGES.map((s, i) => {
 const isCompleted = i < currentIndex
 const isActive = i === currentIndex

 return (
 <div key={s} className="flex items-center">
 <div className="flex flex-col items-center">
 <div
 className={cn(
 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
 isCompleted && 'bg-success border-success -foreground',
 isActive && 'bg-primary border-primary -foreground',
 !isCompleted && !isActive && ' '
 )}
 >
 {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
 </div>
 <span
 className={cn(
 'text-[10px] mt-1 whitespace-nowrap',
 isActive && 'font-semibold ',
 isCompleted && '',
 !isCompleted && !isActive && ''
 )}
 >
 {s.replace(/_/g, ' ')}
 </span>
 </div>
 {i < STAGES.length - 1 && (
 <div
 className={cn(
 'w-8 h-0.5 mx-1 mb-5',
 i < currentIndex ? 'bg-success' : 'bg-border'
 )}
 />
 )}
 </div>
 )
 })}
 </div>
 )
}
