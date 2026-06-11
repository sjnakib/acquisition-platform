'use client'

import { ChevronRight, Folder, ExternalLink } from 'lucide-react'

export interface BreadcrumbSegment {
  id: string
  name: string
}

interface DriveBreadcrumbProps {
  segments: BreadcrumbSegment[]
  onNavigate: (segment: BreadcrumbSegment | null) => void
  dealFolderName?: string
  dealFolderId?: string | null
}

export function DriveBreadcrumb({
  segments,
  onNavigate,
  dealFolderName,
  dealFolderId,
}: DriveBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap text-[13px] min-h-[28px] select-none">
      {/* Home / In-App Root button */}
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center justify-center hover:bg-[var(--color-surface-2)] rounded p-1 transition-colors text-[var(--color-text-secondary)] cursor-pointer"
        title="Go to root folder in Acquire"
      >
        <Folder size={14} />
      </button>

      <ChevronRight size={12} style={{ color: 'var(--color-text-tertiary)' }} />

      {/* Deal Room name (opens in Google Drive) */}
      {dealFolderId ? (
        <a
          href={`https://drive.google.com/drive/folders/${dealFolderId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-semibold hover:underline rounded px-1.5 py-0.5 transition-colors text-[var(--color-accent)]"
          title="Open root folder in Google Drive"
        >
          <span>{dealFolderName ?? 'Documents'}</span>
          <ExternalLink size={11} className="opacity-70" />
        </a>
      ) : (
        <span className="font-semibold px-1.5 py-0.5" style={{ color: 'var(--color-text-primary)' }}>
          {dealFolderName ?? 'Documents'}
        </span>
      )}

      {segments.map((seg) => (
        <span key={seg.id} className="flex items-center gap-1">
          <ChevronRight size={12} style={{ color: 'var(--color-text-tertiary)' }} />
          <button
            onClick={() => onNavigate(seg)}
            className="font-medium hover:underline rounded px-1.5 py-0.5 transition-colors text-[var(--color-text-primary)] cursor-pointer"
          >
            {seg.name}
          </button>
        </span>
      ))}
    </div>
  )
}
