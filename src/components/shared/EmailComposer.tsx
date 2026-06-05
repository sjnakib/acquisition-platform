'use client'

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Send, Loader2, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor, type RichTextEditorHandle } from '@/components/deals/RichTextEditor'
import { ContactSuggestInput } from '@/components/deals/ContactSuggestInput'

export interface EmailComposerHandle {
  insertHTML: (html: string) => void
  clear: () => void
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface MergeField {
  key: string
  label: string
  group: string
}

export interface TemplateOption {
  id: string
  name: string
  subject: string
  body: string
}

export interface AttachmentFile {
  id: string
  filename: string
  size_bytes: number
  mime_type: string
  publicUrl?: string
}

export interface ComposeSendData {
  to: string
  cc: string
  subject: string
  htmlBody: string
  contactId: string | null
}

export interface ComposeSendData {
  to: string
  cc: string
  subject: string
  htmlBody: string
  contactId: string | null
}

interface Props {
  // ── Mode ──
  mode: 'compose' | 'template-edit'

  // ── Compose mode props ──
  dealId?: string
  dealName?: string
  defaultTo?: string
  defaultCc?: string
  defaultSubject?: string
  onSend?: (data: ComposeSendData) => Promise<void>
  sending?: boolean

  // ── Template-edit mode props ──
  subjectTemplate?: string
  bodyTemplate?: string
  onSubjectChange?: (value: string) => void
  onBodyChange?: (html: string) => void
  mergeFields?: MergeField[]
  onMergeFieldInsert?: (key: string) => void

  // ── Attachments ──
  attachments?: AttachmentFile[]
  onAttach?: (files: FileList) => void
  onRemoveAttachment?: (id: string) => void

  // ── Templates ──
  availableTemplates?: TemplateOption[]
  onTemplateInsert?: (templateId: string) => void

  // ── Style overrides ──
  minHeight?: number
  placeholder?: string
  showCcToggle?: boolean
}

// ── Styles ──────────────────────────────────────────────────────────────────

const labelStyle = {
  fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 4,
} as const

const fieldStyle = {
  height: 34, fontSize: 13,
  background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-2)',
  borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-jetbrains-mono)', paddingLeft: 10,
} as const

// ── Component ───────────────────────────────────────────────────────────────

export const EmailComposer = forwardRef<EmailComposerHandle, Props>(
  function EmailComposer({
    mode,
    dealId,
    defaultTo,
    defaultCc,
    defaultSubject,
    onSend,
    sending: externalSending,
    subjectTemplate = '',
    bodyTemplate = '',
    onSubjectChange,
    onBodyChange,
    mergeFields = [],
    onMergeFieldInsert,
    attachments = [],
    onAttach,
    onRemoveAttachment,
    availableTemplates = [],
    minHeight = 200,
    placeholder = 'Write your message...',
    showCcToggle = true,
  }: Props, ref) {
  // Compose mode state
  const [composeTo, setComposeTo] = useState(defaultTo ?? '')
  const [composeCc, setComposeCc] = useState(defaultCc ?? '')
  const [composeSubject, setComposeSubject] = useState(defaultSubject ?? '')
  const [composeBody, setComposeBody] = useState('')
  const [composeContactId, setComposeContactId] = useState<string | null>(null)
  const [showCc, setShowCc] = useState(false)
  const [sending, setSending] = useState(false)

  const editorRef = useRef<RichTextEditorHandle>(null)
  const subjectInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    insertHTML: (html: string) => editorRef.current?.insertHTML(html) ?? undefined,
    clear: () => editorRef.current?.clear() ?? undefined,
  }))

  const isCompose = mode === 'compose'

  // ── Handlers ──

  const handleSubjectChange = useCallback((value: string) => {
    if (isCompose) {
      setComposeSubject(value)
    } else {
      onSubjectChange?.(value)
    }
  }, [isCompose, onSubjectChange])

  const handleBodyChange = useCallback((html: string) => {
    if (isCompose) {
      setComposeBody(html)
    } else {
      onBodyChange?.(html)
    }
  }, [isCompose, onBodyChange])

  const handleMergeFieldClick = useCallback((key: string) => {
    if (onMergeFieldInsert) {
      onMergeFieldInsert(key)
    } else {
      // Fallback: insert into editor
      editorRef.current?.insertHTML(`{${key}}`)
    }
  }, [onMergeFieldInsert])

  const handleTemplateSelect = useCallback((templateId: string) => {
    const tpl = availableTemplates.find((t) => t.id === templateId)
    if (!tpl) return
    if (isCompose) {
      setComposeSubject(tpl.subject)
      editorRef.current?.clear()
      editorRef.current?.insertHTML(tpl.body)
    } else {
      onSubjectChange?.(tpl.subject)
      onBodyChange?.(tpl.body)
    }
  }, [availableTemplates, isCompose, onSubjectChange, onBodyChange])

  const handleSend = useCallback(async () => {
    if (!onSend) return
    setSending(true)
    try {
      await onSend({
        to: composeTo,
        cc: composeCc,
        subject: composeSubject,
        htmlBody: composeBody,
        contactId: composeContactId,
      })
      // Clear compose fields on success
      setComposeTo('')
      setComposeCc('')
      setComposeSubject('')
      setComposeBody('')
      setComposeContactId(null)
      editorRef.current?.clear()
    } finally {
      setSending(false)
    }
  }, [onSend, composeTo, composeCc, composeSubject, composeBody, composeContactId])

  const activeSending = externalSending ?? sending

  const subjectValue = isCompose ? composeSubject : subjectTemplate

  return (
    <div className="flex flex-col gap-4">
      {/* ── Templates (both modes) ── */}
      {availableTemplates.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginRight: 4 }}>Templates:</span>
          {availableTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleTemplateSelect(tpl.id)}
              style={{
                fontSize: 11, padding: '3px 10px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-3)',
                color: 'var(--color-accent)', cursor: 'pointer',
                fontFamily: 'var(--font-jetbrains-mono)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-3)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
            >
              {tpl.name}
            </button>
          ))}
        </div>
      )}

      {/* ── To field (compose only) ── */}
      {isCompose && dealId && (
        <div>
          <div style={labelStyle}>To</div>
          <ContactSuggestInput
            value={composeTo}
            onChange={setComposeTo}
            onSelect={(suggestion) => {
              setComposeTo(`"${suggestion.name}" <${suggestion.email}>`)
              setComposeContactId(suggestion.id)
            }}
            dealId={dealId}
            placeholder="Select a contact..."
            disabled={false}
          />
        </div>
      )}

      {/* ── Cc toggle (compose only) ── */}
      {isCompose && showCcToggle && (
        <div>
          {!showCc ? (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              style={{ fontSize: 12, color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              + Cc / Bcc
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Cc</div>
                <Input
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  placeholder="cc@example.com"
                  style={fieldStyle}
                />
              </div>
              <button
                type="button"
                onClick={() => { setShowCc(false); setComposeCc('') }}
                style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', marginTop: 12 }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Subject ── */}
      <div>
        <div style={labelStyle}>Subject</div>
        <Input
          ref={subjectInputRef}
          value={subjectValue}
          onChange={(e) => handleSubjectChange(e.target.value)}
          placeholder={isCompose ? 'Email subject...' : '{property_address} — Investment Opportunity'}
          style={fieldStyle}
        />
      </div>

      {/* ── Body ── */}
      <div>
        <div style={labelStyle}>Body</div>
        <RichTextEditor
          ref={editorRef}
          value={isCompose ? composeBody : bodyTemplate}
          onChange={handleBodyChange}
          placeholder={placeholder}
          minHeight={minHeight}
          showAttach={isCompose && !!onAttach}
          onAttach={isCompose ? onAttach : undefined}
        />
      </div>

      {/* ── Merge field palette (template-edit only) ── */}
      {!isCompose && mergeFields.length > 0 && (
        <div style={{
          background: 'var(--color-surface-1)', borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 8 }}>
            Merge Fields — click to insert at cursor
          </div>
          {groupMergeFields(mergeFields).map((group) => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginRight: 8 }}>
                {group.label}:
              </span>
              <span style={{ display: 'inline-flex', flexWrap: 'wrap' as const, gap: 4 }}>
                {group.fields.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleMergeFieldClick(f.key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 2,
                      padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface-2)', border: '1px solid var(--color-surface-3)',
                      fontSize: 11, color: 'var(--color-accent)', cursor: 'pointer',
                      fontFamily: 'var(--font-jetbrains-mono)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-3)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)' }}
                  >
                    {'{' + f.key + '}'}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Attachments (compose only) ── */}
      {isCompose && attachments.length > 0 && (
        <div style={{
          background: 'var(--color-surface-1)', borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
            Attachments ({attachments.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {attachments.map((att) => (
              <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-primary)', flex: 1 }}>
                  {att.filename} ({(att.size_bytes / 1024).toFixed(0)} KB)
                </span>
                {onRemoveAttachment && (
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(att.id)}
                    style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Send button (compose only) ── */}
      {isCompose && onSend && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            onClick={handleSend}
            disabled={activeSending || !composeTo.trim()}
            style={{
              height: 32, fontSize: 13, gap: 6,
              background: 'var(--color-accent)', color: 'var(--color-text-inverse)',
            }}
          >
            {activeSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {activeSending ? 'Sending...' : 'Send Email'}
          </Button>
        </div>
      )}
    </div>
  )
})

// ── Helper: group merge fields by their group label ──

function groupMergeFields(fields: MergeField[]): { label: string; fields: MergeField[] }[] {
  const map = new Map<string, MergeField[]>()
  for (const f of fields) {
    const group = map.get(f.group) ?? []
    group.push(f)
    if (!map.has(f.group)) map.set(f.group, group)
  }
  return [...map.entries()].map(([label, fields]) => ({ label, fields }))
}
