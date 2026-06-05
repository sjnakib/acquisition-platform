'use client'

import { useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react'
import { Bold, Italic, Underline, Link, List, ListOrdered, Palette, Paperclip } from 'lucide-react'

export interface RichTextEditorHandle {
  insertHTML: (html: string) => void
  clear: () => void
}

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  minHeight?: number
  showAttach?: boolean
  onAttach?: (files: FileList) => void
}

type FormatCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList'

const FORMAT_BUTTONS: { command: FormatCommand; icon: typeof Bold; label: string }[] = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
]

const FONT_SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Medium', value: '4' },
  { label: 'Large', value: '5' },
]

const TEXT_COLORS = [
  '#1e293b', '#334155', '#475569', '#64748b',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#0891b2',
]

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor({ value, onChange, placeholder, disabled, minHeight = 200, showAttach, onAttach }, ref) {
    const editorRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const isUpdatingRef = useRef(false)
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showFontSizes, setShowFontSizes] = useState(false)

    useImperativeHandle(ref, () => ({
      insertHTML: (html: string) => {
        const el = editorRef.current
        if (!el) return
        el.focus()
        if (el.textContent?.trim() === '' || el.innerHTML === '' || el.innerHTML === '<br>') {
          el.innerHTML = html
        } else {
          el.innerHTML += html
        }
        isUpdatingRef.current = true
        onChange(el.innerHTML)
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
        isUpdatingRef.current = false
      },
      clear: () => {
        const el = editorRef.current
        if (!el) return
        el.innerHTML = ''
        onChange('')
      },
    }))

    // Sync external value into editor
    const editor = editorRef.current
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) {
      editor.innerHTML = value
    }

    const execFormat = useCallback((command: FormatCommand) => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      document.execCommand(command, false)
      onChange(el.innerHTML)
    }, [onChange])

    const execFontSize = useCallback((size: string) => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      document.execCommand('fontSize', false, size)
      setShowFontSizes(false)
      onChange(el.innerHTML)
    }, [onChange])

    const execForeColor = useCallback((color: string) => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      document.execCommand('foreColor', false, color)
      setShowColorPicker(false)
      onChange(el.innerHTML)
    }, [onChange])

    const insertLink = useCallback(() => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      const sel = window.getSelection()
      const selectedText = sel?.toString() ?? ''
      const url = window.prompt('Enter URL:', 'https://')
      if (!url) return
      el.focus()
      const text = selectedText || url
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`)
      onChange(el.innerHTML)
    }, [onChange])

    const handleInput = useCallback(() => {
      const el = editorRef.current
      if (!el) return
      isUpdatingRef.current = true
      onChange(el.innerHTML)
      queueMicrotask(() => { isUpdatingRef.current = false })
    }, [onChange])

    const showPlaceholder = !value || value === '' || value === '<br>'

    return (
      <div
        className={`rounded-lg border overflow-hidden transition-colors ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
        style={{
          borderColor: 'var(--color-surface-2)',
          background: 'var(--color-surface-0)',
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center gap-0.5 px-2 py-1.5 border-b"
          style={{ borderColor: 'var(--color-surface-2)', background: 'var(--color-surface-1)' }}
        >
          {FORMAT_BUTTONS.map((btn) => (
            <button
              key={btn.command}
              type="button"
              onClick={() => execFormat(btn.command)}
              className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-text-secondary)' }}
              title={btn.label}
            >
              <btn.icon size={14} />
            </button>
          ))}
          <div className="w-px h-4 mx-1" style={{ background: 'var(--color-surface-3)' }} />

          {/* Font Size */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowFontSizes(!showFontSizes); setShowColorPicker(false) }}
              className="h-7 px-2 flex items-center gap-1 rounded transition-colors hover:bg-[var(--color-surface-2)]"
              style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}
              title="Font size"
            >
              A<span style={{ fontSize: 9 }}>▼</span>
            </button>
            {showFontSizes && (
              <div
                className="absolute top-full left-0 mt-1 rounded-md border shadow-lg z-10 py-1"
                style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)', minWidth: 100 }}
              >
                {FONT_SIZES.map((fs) => (
                  <button
                    key={fs.value}
                    type="button"
                    onClick={() => execFontSize(fs.value)}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--color-surface-1)] transition-colors"
                    style={{ fontSize: 13, color: 'var(--color-text-primary)' }}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Color */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowFontSizes(false) }}
              className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)]"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Text color"
            >
              <Palette size={14} />
            </button>
            {showColorPicker && (
              <div
                className="absolute top-full left-0 mt-1 rounded-md border shadow-lg z-10 p-2"
                style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}
              >
                <div className="grid grid-cols-6 gap-1">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => execForeColor(color)}
                      className="h-5 w-5 rounded-sm border transition-transform hover:scale-110"
                      style={{ background: color, borderColor: 'var(--color-surface-3)' }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-4 mx-1" style={{ background: 'var(--color-surface-3)' }} />

          <button
            type="button"
            onClick={insertLink}
            className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: 'var(--color-text-secondary)' }}
            title="Insert link"
          >
            <Link size={14} />
          </button>

          {/* Attach button */}
          {showAttach && onAttach && (
            <>
              <div className="w-px h-4 mx-1" style={{ background: 'var(--color-surface-3)' }} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)]"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Attach file"
              >
                <Paperclip size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    onAttach(e.target.files)
                    e.target.value = ''
                  }
                }}
              />
            </>
          )}
        </div>

        {/* Editor */}
        <div className="relative" style={{ minHeight }}>
          {showPlaceholder && (
            <div
              className="absolute inset-x-0 top-0 px-3 py-2.5 text-[13px] pointer-events-none select-none"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {placeholder ?? 'Write your message...'}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={handleInput}
            className="w-full text-[13px] px-3 py-2.5 outline-none focus:outline-none"
            style={{
              minHeight,
              color: 'var(--color-text-primary)',
              lineHeight: 1.6,
            }}
          />
        </div>
      </div>
    )
  }
)
