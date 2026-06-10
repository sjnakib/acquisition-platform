'use client'

import { ChevronRight, Folder } from 'lucide-react'

export interface BreadcrumbSegment {
  id: string
  name: string
}

interface DriveBreadcrumbProps {
  segments: BreadcrumbSegment[]
  onNavigate: (segment: BreadcrumbSegment | null) => void
  dealFolderName?: string
}

export function DriveBreadcrumb({ segments, onNavigate, dealFolderName }: DriveBreadcrumbProps) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap text-[13px] min-h-[28px]">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1.5 font-semibold hover:underline rounded px-1.5 py-0.5 transition-colors"
        style={{
          color: segments.length === 0 ? 'var(--color-text-primary)' : 'var(--color-accent)',
        }}
      >
        <Folder size={14} />
        {dealFolderName ?? 'Documents'}
      </button>

      {segments.map((seg) => (
        <span key={seg.id} className="flex items-center gap-0.5">
          <ChevronRight size={13} style={{ color: 'var(--color-text-tertiary)' }} />
          <button
            onClick={() => onNavigate(seg)}
            className="font-medium hover:underline rounded px-1.5 py-0.5 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {seg.name}
          </button>
        </span>
      ))}
    </div>
  )
}
