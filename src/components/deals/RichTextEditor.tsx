'use client'

import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Bold, Italic, Underline, Link, List, ListOrdered } from 'lucide-react'

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
}

type FormatCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList'

const FORMAT_BUTTONS: { command: FormatCommand; icon: typeof Bold; label: string }[] = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
]

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor({ value, onChange, placeholder, disabled, minHeight = 200 }, ref) {
    const editorRef = useRef<HTMLDivElement>(null)
    const isUpdatingRef = useRef(false)

    // Sync external value into editor (only when not mid-edit)
    const syncValue = useCallback(() => {
      if (!editorRef.current || isUpdatingRef.current) return
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value
      }
    }, [value])

    // Ensure editor ref always has latest value when focused
    const editor = editorRef.current
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) {
      editor.innerHTML = value
    }

    useImperativeHandle(ref, () => ({
      insertHTML: (html: string) => {
        const el = editorRef.current
        if (!el) return
        el.focus()
        // If editor is empty, replace placeholder; otherwise append
        if (el.textContent?.trim() === '' || el.innerHTML === '' || el.innerHTML === '<br>') {
          el.innerHTML = html
        } else {
          // Append at cursor position or end
          el.innerHTML += html
        }
        isUpdatingRef.current = true
        onChange(el.innerHTML)
        // Move cursor to end
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

    const execFormat = useCallback((command: FormatCommand) => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      document.execCommand(command, false)
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
      // Use microtask to reset flag after React re-render
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
          <button
            type="button"
            onClick={insertLink}
            className="h-7 w-7 flex items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: 'var(--color-text-secondary)' }}
            title="Insert link"
          >
            <Link size={14} />
          </button>
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
            // syncValue is used to prevent external overwrites during editing
            onFocus={syncValue}
          />
        </div>
      </div>
    )
  }
)
