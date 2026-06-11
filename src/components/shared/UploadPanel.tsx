'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, X, ChevronUp, ChevronDown, Folder, RefreshCw } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// ── Types ──

export interface UploadItem {
  id: string
  name: string
  relativePath?: string // e.g. "MyFolder/subfolder/file.pdf"
  size?: number
  progress: number // 0–100
  status: 'uploading' | 'completed' | 'error'
  errorMessage?: string
  isFolderCreation?: boolean // true for folder-creation ops vs file uploads
  file?: File // stored for retry on error
}

export interface UploadPanelProps {
  items: UploadItem[]
  onDismiss: (id: string) => void
  onDismissAll: () => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onRetryAll?: () => void
}

// ── Helpers ──

function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function displayName(item: UploadItem): string {
  if (item.relativePath) {
    const parts = item.relativePath.split('/')
    return parts[parts.length - 1]!
  }
  return item.name
}

function folderContext(item: UploadItem): string | null {
  if (!item.relativePath) return null
  const parts = item.relativePath.split('/')
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join(' / ')
}

// ── Component ──

export function UploadPanel({ items, onDismiss, onDismissAll, onCancel, onRetry, onRetryAll }: UploadPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [exiting, setExiting] = useState(false)
  const prevCountRef = useRef(items.length)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-expand when new items appear, auto-collapse when all complete
  useEffect(() => {
    if (items.length === 0) {
      if (prevCountRef.current > 0) {
        // All dismissed — animate out then notify parent
        setExiting(true)
        const timer = setTimeout(() => {
          setExiting(false)
          onDismissAll()
        }, 400)
        prevCountRef.current = 0
        return () => clearTimeout(timer)
      }
      prevCountRef.current = 0
      return
    }

    if (items.length > prevCountRef.current) {
      // New items added — expand
      setExpanded(true)
    }

    prevCountRef.current = items.length
  }, [items.length, onDismissAll])

  // Dismiss completed items after 3s (if panel is not expanded)
  useEffect(() => {
    if (expanded) return
    const completedIds = items
      .filter((i) => i.status === 'completed')
      .map((i) => i.id)
    if (completedIds.length === 0) return

    const timer = setTimeout(() => {
      completedIds.forEach((id) => onDismiss(id))
    }, 3000)
    return () => clearTimeout(timer)
  }, [items, expanded, onDismiss])

  const handleDismiss = useCallback(
    (id: string) => {
      onDismiss(id)
    },
    [onDismiss],
  )

  // ── No items, not animating out — render nothing ──
  if (items.length === 0 && !exiting) return null

  const uploading = items.filter((i) => i.status === 'uploading')
  const uploadingCount = uploading.length
  const completedCount = items.filter((i) => i.status === 'completed').length
  const errorCount = items.filter((i) => i.status === 'error').length

  const allDone = uploadingCount === 0 && items.length > 0
  const summaryText = allDone
    ? `Upload complete (${items.length} item${items.length !== 1 ? 's' : ''})`
    : `Uploading ${uploadingCount} item${uploadingCount !== 1 ? 's' : ''}${completedCount > 0 ? ` · ${completedCount} done` : ''}${errorCount > 0 ? ` · ${errorCount} failed` : ''}`

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 transition-all ${exiting ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100'}`}
      style={{
        right: '24px',
        bottom: '24px',
        transitionDuration: 'var(--transition-slow)',
        transitionTimingFunction: 'var(--ease-fluid)',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      {/* ── Minimized pill ── */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2.5 cursor-pointer"
          style={{
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 18px',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {allDone ? (
            <Check
              size={16}
              style={{ color: 'var(--color-success-solid)' }}
            />
          ) : (
            <LoadingSpinner size="sm" />
          )}
          <span
            className="text-[13px] font-medium"
            style={{ color: allDone ? 'var(--color-success-text)' : 'var(--color-text-primary)' }}
          >
            {summaryText}
          </span>
          <ChevronUp
            size={14}
            style={{ color: 'var(--color-text-tertiary)' }}
          />
        </button>
      )}

      {/* ── Expanded panel ── */}
      {expanded && (
        <div
          className="flex flex-col overflow-hidden animate-item-entrance"
          style={{
            width: '380px',
            maxHeight: '480px',
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-2)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between shrink-0 px-4 py-3"
            style={{
              borderBottom: '1px solid var(--color-surface-1)',
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {allDone ? (
                <Check
                  size={16}
                  style={{ color: 'var(--color-success-solid)', flexShrink: 0 }}
                />
              ) : (
                <div style={{ flexShrink: 0 }}>
                  <LoadingSpinner size="sm" />
                </div>
              )}
              <span
                className="text-[13px] font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {summaryText}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => setExpanded(false)}
                className="p-1 rounded hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-text-tertiary)' }}
                aria-label="Collapse upload panel"
              >
                <ChevronDown size={16} />
              </button>
              {errorCount > 0 && onRetryAll && (
                <button
                  onClick={onRetryAll}
                  className="p-1 rounded hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--color-info-text)' }}
                  aria-label="Retry all failed"
                  title="Retry all failed"
                >
                  <RefreshCw size={16} />
                </button>
              )}
              {allDone && (
                <button
                  onClick={onDismissAll}
                  className="p-1 rounded hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  aria-label="Dismiss all"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Item list */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {items.map((item, i) => (
              <UploadItemRow
                key={item.id}
                item={item}
                onDismiss={handleDismiss}
                onCancel={onCancel}
                onRetry={onRetry}
                staggerIndex={i}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Item Row ──

function UploadItemRow({
  item,
  onDismiss,
  onCancel,
  onRetry,
  staggerIndex,
}: {
  item: UploadItem
  onDismiss: (id: string) => void
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  staggerIndex: number
}) {
  const [removing, setRemoving] = useState(false)

  const handleDismiss = () => {
    setRemoving(true)
    setTimeout(() => onDismiss(item.id), 250)
  }

  // Auto-dismiss completed items after 5s
  useEffect(() => {
    if (item.status !== 'completed') return
    const timer = setTimeout(() => {
      setRemoving(true)
      setTimeout(() => onDismiss(item.id), 250)
    }, 5000)
    return () => clearTimeout(timer)
  }, [item.status, item.id, onDismiss])

  const context = folderContext(item)

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 transition-all ${removing ? '' : 'animate-item-entrance'}`}
      style={{
        borderBottom: '1px solid var(--color-surface-1)',
        opacity: removing ? 0 : 1,
        height: removing ? 0 : undefined,
        paddingTop: removing ? 0 : undefined,
        paddingBottom: removing ? 0 : undefined,
        transitionDuration: 'var(--transition-base)',
        transitionTimingFunction: 'var(--ease-fluid)',
        overflow: 'hidden',
        animationDelay: `${staggerIndex * 40}ms`,
      }}
    >
      {/* Status icon */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: '24px', height: '24px' }}
      >
        {item.status === 'uploading' && <LoadingSpinner size="sm" />}
        {item.status === 'completed' && (
          <Check size={16} style={{ color: 'var(--color-success-solid)' }} />
        )}
        {item.status === 'error' && (
          <X size={16} style={{ color: 'var(--color-danger-solid)' }} />
        )}
      </div>

      {/* Info column */}
      <div className="flex-1 min-w-0">
        {/* Filename + folder icon */}
        <div className="flex items-center gap-1.5">
          {item.isFolderCreation && (
            <Folder
              size={12}
              style={{ color: 'var(--color-warning-solid)', flexShrink: 0 }}
            />
          )}
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {displayName(item)}
          </span>
        </div>

        {/* Folder context path */}
        {context && (
          <div
            className="text-[10px] truncate mt-0.5"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {context}
          </div>
        )}

        {/* Progress bar (uploading only) */}
        {item.status === 'uploading' && (
          <div className="mt-1.5">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--color-surface-2)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${item.progress}%`,
                  background: 'var(--color-accent)',
                  transitionDuration: '300ms',
                  transitionTimingFunction: 'ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Status text */}
        <div className="text-[11px] mt-0.5" style={{ color: statusColor(item) }}>
          {item.status === 'uploading' && `${item.progress}%`}
          {item.status === 'completed' && (item.isFolderCreation ? 'Created' : 'Uploaded')}
          {item.status === 'error' && (item.errorMessage || 'Failed')}
        </div>
      </div>

      {/* File size */}
      <div
        className="text-[11px] shrink-0 font-mono"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        {formatSize(item.size)}
      </div>

      {/* Contextual action button */}
      {item.status === 'uploading' && onCancel && (
        <button
          onClick={() => onCancel(item.id)}
          className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label={`Cancel ${item.name}`}
          title="Cancel upload"
        >
          <X size={14} />
        </button>
      )}
      {item.status === 'error' && (
        <div className="flex items-center gap-0.5 shrink-0">
          {onRetry && (
            <button
              onClick={() => onRetry(item.id)}
              className="p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--color-info-text)' }}
              aria-label={`Retry ${item.name}`}
              title="Retry upload"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-text-tertiary)' }}
            aria-label={`Dismiss ${item.name}`}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {item.status === 'completed' && (
        <button
          onClick={handleDismiss}
          className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label={`Dismiss ${item.name}`}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ── Helpers ──

function statusColor(item: UploadItem): string {
  switch (item.status) {
    case 'uploading':
      return 'var(--color-text-tertiary)'
    case 'completed':
      return 'var(--color-success-text)'
    case 'error':
      return 'var(--color-danger-text)'
  }
}
