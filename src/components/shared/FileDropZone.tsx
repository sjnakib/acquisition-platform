'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'

interface FileDropZoneProps {
  accept?: string
  disabled?: boolean
  value: File | undefined
  onChange: (file: File | undefined) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileDropZone({ accept, disabled, value, onChange }: FileDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const resetDrag = useCallback(() => {
    dragCounter.current = 0
    setIsDragActive(false)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragActive(true)
  }, [disabled])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resetDrag()
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) onChange(file)
  }, [disabled, onChange, resetDrag])

  const handleClick = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onChange(file)
    e.target.value = ''
  }, [onChange])

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(undefined)
    if (inputRef.current) inputRef.current.value = ''
  }, [onChange])

  const hasFile = !!value

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className="relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200"
        style={{
          borderColor: isDragActive && !disabled
            ? 'var(--color-accent)'
            : 'var(--color-surface-3)',
          background: isDragActive && !disabled
            ? 'var(--color-accent-bg)'
            : 'var(--color-surface-0)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasFile ? (
          <div className="flex items-center gap-3 w-full">
            <FileSpreadsheet
              size={28}
              style={{ color: 'var(--color-accent)' }}
              className="shrink-0"
            />
            <div className="flex-1 text-left min-w-0">
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
              >
                {value.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {formatFileSize(value.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 p-1 rounded transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload
              size={28}
              style={{
                color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
              }}
            />
            <p
              className="text-sm"
              style={{
                color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              Drop Excel file here or click to browse
            </p>
            {accept && !disabled && (
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {accept.split(',').map((ext) => ext.trim().replace('.', '').toUpperCase()).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleInputChange}
        className="sr-only"
      />
    </div>
  )
}
