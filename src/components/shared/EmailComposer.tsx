'use client'

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Send, Loader2, X, FileText, Paperclip, ChevronDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor, type RichTextEditorHandle } from '@/components/deals/RichTextEditor'
import { RecipientChipsInput, isValidEmail, parseRecipient } from '@/components/deals/RecipientChipsInput'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// Helper to parse comma-separated emails, respecting quotes and brackets
function parseEmailList(str: string): string[] {
  if (!str) return []
  const result: string[] = []
  let current = ''
  let inQuotes = false
  let bracketDepth = 0
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === '<') {
      bracketDepth++
      current += char
    } else if (char === '>') {
      bracketDepth = Math.max(0, bracketDepth - 1)
      current += char
    } else if (char === ',' && !inQuotes && bracketDepth === 0) {
      const trimmed = current.trim()
      if (trimmed) result.push(trimmed)
      current = ''
    } else {
      current += char
    }
  }
  const trimmed = current.trim()
  if (trimmed) result.push(trimmed)
  return result
}

export interface EmailComposerHandle {
  insertHTML: (html: string) => void
  clear: () => void
  getDraftData: () => { to: string; cc: string; bcc: string; subject: string; htmlBody: string; contactId: string | null }
  focusBodyAtStart: () => void
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
  bcc?: string
  subject: string
  htmlBody: string
  contactId: string | null
  scheduledAt?: string
}

interface Props {
  // ── Mode ──
  mode: 'compose' | 'template-edit'

  // ── Compose mode props ──
  dealId?: string
  dealName?: string
  defaultTo?: string
  defaultCc?: string
  defaultBcc?: string
  defaultSubject?: string
  defaultBody?: string
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
  hideMergeFields?: boolean
  className?: string
  onDiscard?: () => void
  isReply?: boolean
  isForward?: boolean
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

interface PendingAdd {
  field: 'to' | 'cc' | 'bcc'
  emailStr: string
  emailOnly: string
  nextEmails: string[]
}

interface PendingSend {
  type: 'send' | 'schedule'
  scheduledDate?: Date
  untrackedEmails: string[]
}

// ── Component ───────────────────────────────────────────────────────────────

export const EmailComposer = forwardRef<EmailComposerHandle, Props>(
  function EmailComposer({
    mode,
    dealId,
    defaultTo,
    defaultCc,
    defaultBcc,
    defaultSubject,
    defaultBody,
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
    hideMergeFields = false,
    className,
    onDiscard,
    isReply = false,
    isForward = false,
  }: Props, ref) {
    // Compose mode state
    const [composeTo, setComposeTo] = useState<string[]>(() => parseEmailList(defaultTo ?? ''))
    const [composeCc, setComposeCc] = useState<string[]>(() => parseEmailList(defaultCc ?? ''))
    const [composeBcc, setComposeBcc] = useState<string[]>(() => parseEmailList(defaultBcc ?? ''))
    const [composeSubject, setComposeSubject] = useState(defaultSubject ?? '')
    const [composeBody, setComposeBody] = useState(defaultBody ?? '')
    const [composeContactId, setComposeContactId] = useState<string | null>(null)
    const [showCc, setShowCc] = useState(() => parseEmailList(defaultCc ?? '').length > 0)
    const [showBcc, setShowBcc] = useState(() => parseEmailList(defaultBcc ?? '').length > 0)
    const [sending, setSending] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [showScheduleMenu, setShowScheduleMenu] = useState(false)
    const [showCustomPicker, setShowCustomPicker] = useState(false)
    const [customDate, setCustomDate] = useState('')

    // Tracked emails warning state
    const [trackedEmails, setTrackedEmails] = useState<Set<string>>(new Set())
    const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null)
    const [pendingSend, setPendingSend] = useState<PendingSend | null>(null)
    const [addingContact, setAddingContact] = useState(false)

    // Load tracked contacts
    const fetchTrackedEmails = useCallback(async () => {
      if (!dealId || mode !== 'compose') {
        setTrackedEmails(new Set())
        return
      }
      try {
        const res = await fetch(`/api/deals/${dealId}/contacts?all=true`)
        if (res.ok) {
          const contacts = await res.json()
          const emails = new Set<string>()
          for (const c of contacts) {
            if (c.email) {
              for (const e of c.email) {
                if (e) emails.add(e.trim().toLowerCase())
              }
            }
          }
          setTrackedEmails(emails)
        }
      } catch (err) {
        console.error('Failed to load tracked contacts:', err)
      }
    }, [dealId, mode])

    useEffect(() => {
      fetchTrackedEmails()
    }, [fetchTrackedEmails])

    useEffect(() => {
      window.addEventListener('contacts-updated', fetchTrackedEmails)
      return () => window.removeEventListener('contacts-updated', fetchTrackedEmails)
    }, [fetchTrackedEmails])

    const isEmailTracked = useCallback((email: string) => {
      return trackedEmails.has(email.trim().toLowerCase())
    }, [trackedEmails])

    const handleAddContact = useCallback(async (emailStr: string) => {
      if (!dealId) return null
      const { name, email } = parseRecipient(emailStr)
      setAddingContact(true)
      try {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deal_id: dealId,
            name: name || email,
            email: [email],
          }),
        })
        if (res.ok) {
          const contact = await res.json()
          toast.success(`Contact tracked: ${email}`)
          setTrackedEmails(prev => {
            const next = new Set(prev)
            next.add(email.trim().toLowerCase())
            return next
          })
          window.dispatchEvent(new CustomEvent('contacts-updated'))
          return contact
        } else {
          const json = await res.json()
          toast.error(json.error ?? 'Failed to track contact')
        }
      } catch {
        toast.error('Failed to track contact')
      } finally {
        setAddingContact(false)
      }
      return null
    }, [dealId])

    const handleEmailsChange = useCallback((field: 'to' | 'cc' | 'bcc', nextEmails: string[]) => {
      const prevEmails = field === 'to' ? composeTo : field === 'cc' ? composeCc : composeBcc
      const setter = field === 'to' ? setComposeTo : field === 'cc' ? setComposeCc : setComposeBcc

      if (nextEmails.length <= prevEmails.length) {
        setter(nextEmails)
        return
      }

      const addedEmailStr = nextEmails.find(e => !prevEmails.includes(e))
      if (!addedEmailStr) {
        setter(nextEmails)
        return
      }

      const { email } = parseRecipient(addedEmailStr)
      const valid = isValidEmail(email)

      if (valid && dealId && !isEmailTracked(email)) {
        setPendingAdd({
          field,
          emailStr: addedEmailStr,
          emailOnly: email,
          nextEmails,
        })
      } else {
        setter(nextEmails)
      }
    }, [composeTo, composeCc, composeBcc, dealId, isEmailTracked])

    const handleConfirmAddTracked = async () => {
      if (!pendingAdd) return
      const contact = await handleAddContact(pendingAdd.emailStr)
      if (contact) {
        const setter = pendingAdd.field === 'to' ? setComposeTo : pendingAdd.field === 'cc' ? setComposeCc : setComposeBcc
        setter(pendingAdd.nextEmails)
        setPendingAdd(null)
      }
    }

    const handleConfirmAddUntracked = () => {
      if (!pendingAdd) return
      const setter = pendingAdd.field === 'to' ? setComposeTo : pendingAdd.field === 'cc' ? setComposeCc : setComposeBcc
      setter(pendingAdd.nextEmails)
      setPendingAdd(null)
    }

    const handleCancelAdd = () => {
      setPendingAdd(null)
    }

    const editorRef = useRef<RichTextEditorHandle>(null)
    const subjectInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Sync defaults to state on parent re-renders (e.g. switching between reply and forward inline)
    useEffect(() => {
      setComposeTo(parseEmailList(defaultTo ?? ''))
    }, [defaultTo])

    useEffect(() => {
      const parsed = parseEmailList(defaultCc ?? '')
      setComposeCc(parsed)
      if (parsed.length > 0) {
        setShowCc(true)
      }
    }, [defaultCc])

    useEffect(() => {
      const parsed = parseEmailList(defaultBcc ?? '')
      setComposeBcc(parsed)
      if (parsed.length > 0) {
        setShowBcc(true)
      }
    }, [defaultBcc])

    useEffect(() => {
      setComposeSubject(defaultSubject ?? '')
    }, [defaultSubject])

    useEffect(() => {
      setComposeBody(defaultBody ?? '')
      if (defaultBody) {
        editorRef.current?.clear()
        editorRef.current?.insertHTML(defaultBody)
        if (isForward) {
          editorRef.current?.focusAtStart()
        }
      } else {
        editorRef.current?.clear()
      }
    }, [defaultBody, isForward])

    useImperativeHandle(ref, () => ({
      insertHTML: (html: string) => editorRef.current?.insertHTML(html) ?? undefined,
      clear: () => editorRef.current?.clear() ?? undefined,
      getDraftData: () => ({
        to: composeTo.join(', '),
        cc: composeCc.join(', '),
        bcc: composeBcc.join(', '),
        subject: composeSubject,
        htmlBody: composeBody,
        contactId: composeContactId,
      }),
      focusBodyAtStart: () => editorRef.current?.focusAtStart() ?? undefined,
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

    const proceedSend = useCallback(async () => {
      if (!onSend) return
      setSending(true)
      try {
        await onSend({
          to: composeTo.join(', '),
          cc: composeCc.join(', '),
          bcc: composeBcc.join(', '),
          subject: composeSubject,
          htmlBody: composeBody,
          contactId: composeContactId,
        })
        setComposeTo([])
        setComposeCc([])
        setComposeBcc([])
        setComposeSubject('')
        setComposeBody('')
        setComposeContactId(null)
        editorRef.current?.clear()
      } finally {
        setSending(false)
      }
    }, [onSend, composeTo, composeCc, composeBcc, composeSubject, composeBody, composeContactId])

    const proceedScheduleSend = useCallback(async (date: Date) => {
      if (!onSend) return
      setSending(true)
      try {
        await onSend({
          to: composeTo.join(', '),
          cc: composeCc.join(', '),
          bcc: composeBcc.join(', '),
          subject: composeSubject,
          htmlBody: composeBody,
          contactId: composeContactId,
          scheduledAt: date.toISOString(),
        })
        setComposeTo([])
        setComposeCc([])
        setComposeBcc([])
        setComposeSubject('')
        setComposeBody('')
        setComposeContactId(null)
        editorRef.current?.clear()
      } finally {
        setSending(false)
      }
    }, [onSend, composeTo, composeCc, composeBcc, composeSubject, composeBody, composeContactId])

    const getUntrackedRecipients = useCallback(() => {
      if (!dealId) return []
      const untracked: string[] = []
      const allRecipients = [...composeTo, ...composeCc, ...composeBcc]
      for (const rawEmail of allRecipients) {
        const { email } = parseRecipient(rawEmail)
        if (isValidEmail(email) && !isEmailTracked(email)) {
          if (!untracked.includes(email)) {
            untracked.push(email)
          }
        }
      }
      return untracked
    }, [composeTo, composeCc, composeBcc, dealId, isEmailTracked])

    const handleSend = useCallback(async () => {
      if (!onSend) return
      const untracked = getUntrackedRecipients()
      if (untracked.length > 0) {
        setPendingSend({
          type: 'send',
          untrackedEmails: untracked
        })
        return
      }
      await proceedSend()
    }, [onSend, getUntrackedRecipients, proceedSend])

    const handleScheduleSend = useCallback(async (date: Date) => {
      if (!onSend) return
      const untracked = getUntrackedRecipients()
      if (untracked.length > 0) {
        setPendingSend({
          type: 'schedule',
          scheduledDate: date,
          untrackedEmails: untracked
        })
        return
      }
      await proceedScheduleSend(date)
    }, [onSend, getUntrackedRecipients, proceedScheduleSend])

    const handleConfirmSendTracked = useCallback(async () => {
      if (!pendingSend) return
      setAddingContact(true)
      try {
        const successEmails: string[] = []
        for (const email of pendingSend.untrackedEmails) {
          const res = await fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deal_id: dealId,
              name: email,
              email: [email],
            }),
          })
          if (res.ok) {
            successEmails.push(email)
          } else {
            const json = await res.json()
            toast.error(json.error ?? `Failed to track contact: ${email}`)
            setAddingContact(false)
            return
          }
        }
        
        toast.success(successEmails.length === 1 ? 'Contact tracked' : `${successEmails.length} contacts tracked`)
        setTrackedEmails(prev => {
          const next = new Set(prev)
          for (const e of successEmails) {
            next.add(e.trim().toLowerCase())
          }
          return next
        })
        window.dispatchEvent(new CustomEvent('contacts-updated'))

        const type = pendingSend.type
        const date = pendingSend.scheduledDate
        setPendingSend(null)

        if (type === 'schedule' && date) {
          await proceedScheduleSend(date)
        } else {
          await proceedSend()
        }
      } catch {
        toast.error('Failed to track contacts')
      } finally {
        setAddingContact(false)
      }
    }, [pendingSend, dealId, proceedSend, proceedScheduleSend])

    const handleConfirmSendUntracked = useCallback(async () => {
      if (!pendingSend) return
      const type = pendingSend.type
      const date = pendingSend.scheduledDate
      setPendingSend(null)

      if (type === 'schedule' && date) {
        await proceedScheduleSend(date)
      } else {
        await proceedSend()
      }
    }, [pendingSend, proceedSend, proceedScheduleSend])

    const handleCancelSend = useCallback(() => {
      setPendingSend(null)
    }, [])

    const handleDragEnter = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (isCompose && onAttach) {
        setIsDragging(true)
      }
    }, [isCompose, onAttach])

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (isCompose && onAttach && e.dataTransfer.files?.length) {
        onAttach(e.dataTransfer.files)
      }
    }, [isCompose, onAttach])

    const activeSending = externalSending ?? sending

    const subjectValue = isCompose ? composeSubject : subjectTemplate

    return (
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn("flex flex-col gap-3 relative rounded-xl p-1", className)}
      >
        {/* Drag over overlay */}
        {isDragging && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all"
            style={{
              background: 'var(--color-surface-1)',
              opacity: 0.95,
              borderColor: 'var(--color-accent)',
            }}
          >
            <div className="flex flex-col items-center gap-2 p-6 rounded-lg bg-[var(--color-surface-0)] border shadow-md">
              <Paperclip className="h-8 w-8 text-[var(--color-accent)] animate-bounce" />
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                Drop files to attach
              </p>
            </div>
          </div>
        )}

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

        {/* ── To, Cc, Bcc fields (compose, reply, forward modes) ── */}
        {isCompose && dealId && (
          <div className="flex flex-col gap-2">
            <RecipientChipsInput
              label="To"
              emails={composeTo}
              onChange={(emails) => handleEmailsChange('to', emails)}
              dealId={dealId}
              placeholder="Recipients..."
              showCcLink={showCcToggle && !showCc}
              showBccLink={showCcToggle && !showBcc}
              onCcClick={() => setShowCc(true)}
              onBccClick={() => setShowBcc(true)}
            />

            {showCc && (
              <RecipientChipsInput
                label="Cc"
                emails={composeCc}
                onChange={(emails) => handleEmailsChange('cc', emails)}
                dealId={dealId}
                placeholder="Cc..."
              />
            )}

            {showBcc && (
              <RecipientChipsInput
                label="Bcc"
                emails={composeBcc}
                onChange={(emails) => handleEmailsChange('bcc', emails)}
                dealId={dealId}
                placeholder="Bcc..."
              />
            )}
          </div>
        )}

        {/* ── Subject ── */}
        {!isReply && !isForward && (
          <div>
            {!isCompose && <div style={labelStyle}>Subject</div>}
            {isCompose ? (
              <Input
                ref={subjectInputRef}
                value={subjectValue}
                onChange={(e) => handleSubjectChange(e.target.value)}
                placeholder="Subject"
                className="w-full px-1 py-2 text-[13px] bg-transparent border-t-0 border-l-0 border-r-0 border-b rounded-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--color-accent)]"
                style={{
                  borderColor: 'var(--color-surface-2)',
                  color: 'var(--color-text-primary)',
                }}
              />
            ) : (
              <Input
                ref={subjectInputRef}
                value={subjectValue}
                onChange={(e) => handleSubjectChange(e.target.value)}
                placeholder={isCompose ? 'Email subject...' : '{property_address} — Investment Opportunity'}
                style={fieldStyle}
              />
            )}
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 flex flex-col">
          {!isCompose && <div style={labelStyle}>Body</div>}
          <RichTextEditor
            ref={editorRef}
            value={isCompose ? composeBody : bodyTemplate}
            onChange={handleBodyChange}
            placeholder={placeholder}
            minHeight={minHeight}
            showAttach={isCompose && !!onAttach}
            onAttach={isCompose ? onAttach : undefined}
            borderless={isCompose}
          />
        </div>

        {/* ── Merge field palette (template-edit only) ── */}
        {!isCompose && !hideMergeFields && mergeFields.length > 0 && (
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

        {/* ── Attachments List ── */}
        {isCompose && attachments.length > 0 && (
          <div style={{
            background: 'var(--color-surface-1)', borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
          }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
              Attachments ({attachments.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px]"
                  style={{
                    background: 'var(--color-surface-0)',
                    borderColor: 'var(--color-surface-3)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <FileText size={12} style={{ color: 'var(--color-text-secondary)' }} />
                  <span className="truncate max-w-[150px]">{att.filename}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10, fontFamily: 'var(--font-jetbrains-mono)' }}>
                    ({(att.size_bytes / 1024).toFixed(0)} KB)
                  </span>
                  {onRemoveAttachment && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      className="ml-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger-text)] cursor-pointer"
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom Action Row (compose only) ── */}
        {isCompose && onSend && (
          <div className="flex items-center justify-between border-t pt-3 relative" style={{ borderColor: 'var(--color-surface-2)' }}>
            {/* Left side actions (Send, Schedule Send, Attachments) */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Button
                  onClick={handleSend}
                  disabled={activeSending || composeTo.length === 0}
                  className="rounded-r-none h-8 text-[13px] gap-1.5"
                  style={{
                    background: 'var(--color-accent)',
                    color: 'var(--color-text-inverse)',
                    borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  {activeSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {activeSending ? 'Sending...' : 'Send'}
                </Button>
                <Button
                  onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                  disabled={activeSending || composeTo.length === 0}
                  className="rounded-l-none h-8 px-2"
                  style={{
                    background: 'var(--color-accent)',
                    color: 'var(--color-text-inverse)',
                  }}
                  title="Schedule send"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>

                {/* Schedule Send Dropdown Menu */}
                {showScheduleMenu && (
                  <div
                    className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border shadow-lg z-50 p-2"
                    style={{
                      background: 'var(--color-surface-0)',
                      borderColor: 'var(--color-surface-2)',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    <div className="text-[11px] font-semibold px-2 py-1 mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      Schedule Send
                    </div>
                    {getSchedulePresets().map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setShowScheduleMenu(false)
                          handleScheduleSend(preset.date)
                        }}
                        className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-[var(--color-surface-2)] rounded transition-colors flex justify-between items-center"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <span>{preset.label}</span>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                          {preset.timeLabel}
                        </span>
                      </button>
                    ))}
                    <div className="border-t my-1" style={{ borderColor: 'var(--color-surface-2)' }} />
                    <button
                      type="button"
                      onClick={() => setShowCustomPicker(true)}
                      className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-[var(--color-surface-2)] rounded transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Pick date & time...
                    </button>
                  </div>
                )}

                {/* Custom Date-Time Picker Modal */}
                {showCustomPicker && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                    <div
                      className="w-85 rounded-xl border p-4 shadow-xl flex flex-col gap-3"
                      style={{
                        background: 'var(--color-surface-0)',
                        borderColor: 'var(--color-surface-2)',
                      }}
                    >
                      <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Schedule send
                      </h4>
                      <Input
                        type="datetime-local"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] rounded-lg border bg-[var(--color-surface-1)]"
                        style={{
                          borderColor: 'var(--color-surface-2)',
                          color: 'var(--color-text-primary)',
                          fontFamily: 'var(--font-jetbrains-mono)',
                        }}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCustomPicker(false)}
                          style={{ height: 32 }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (customDate) {
                              setShowCustomPicker(false)
                              setShowScheduleMenu(false)
                              handleScheduleSend(new Date(customDate))
                            }
                          }}
                          disabled={!customDate}
                          style={{
                            height: 32,
                            background: 'var(--color-accent)',
                            color: 'var(--color-text-inverse)',
                          }}
                        >
                          Schedule
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {onAttach && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-2)] transition-colors"
                    style={{ color: 'var(--color-text-secondary)', cursor: 'pointer', border: 'none', background: 'none' }}
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
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

            {/* Right side actions (Discard) */}
            <div>
              {onDiscard && (
                <button
                  type="button"
                  onClick={onDiscard}
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--color-surface-2)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)', cursor: 'pointer', border: 'none', background: 'none' }}
                  title="Discard draft"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Dialog for adding single untracked recipient */}
        <Dialog open={!!pendingAdd} onOpenChange={(open) => !open && handleCancelAdd()}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--color-text-primary)' }}>
                Untracked Email Address
              </DialogTitle>
              <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-semibold text-[var(--color-text-primary)]">{pendingAdd?.emailOnly}</span> is not currently a tracked contact for this deal.
                <br /><br />
                You won&apos;t be able to see their replies in the inbox unless you add them to tracked emails. Would you like to add and track them?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={handleCancelAdd} disabled={addingContact}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleConfirmAddUntracked}
                disabled={addingContact}
                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-surface-3)' }}
              >
                Add Untracked
              </Button>
              <Button
                onClick={handleConfirmAddTracked}
                disabled={addingContact}
                style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
              >
                {addingContact ? <LoadingSpinner size="sm" /> : 'Add & Track'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog for sending with untracked recipients */}
        <Dialog open={!!pendingSend} onOpenChange={(open) => !open && handleCancelSend()}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--color-text-primary)' }}>
                Untracked Recipients Found
              </DialogTitle>
              <DialogDescription style={{ color: 'var(--color-text-secondary)' }} className="space-y-3">
                <div>
                  The following recipient(s) are not currently tracked contacts for this deal:
                </div>
                <ul className="list-disc pl-5 font-mono text-[12px] max-h-[100px] overflow-y-auto" style={{ color: 'var(--color-text-primary)' }}>
                  {pendingSend?.untrackedEmails.map((email) => (
                    <li key={email}>{email}</li>
                  ))}
                </ul>
                <div>
                  You won&apos;t be able to see their replies in the inbox unless you add them to tracked emails.
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4">
              <Button variant="outline" onClick={handleCancelSend} disabled={addingContact}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleConfirmSendUntracked}
                disabled={addingContact}
                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-surface-3)' }}
              >
                Send Untracked
              </Button>
              <Button
                onClick={handleConfirmSendTracked}
                disabled={addingContact}
                style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
              >
                {addingContact ? <LoadingSpinner size="sm" /> : 'Add & Track'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
)

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

function getSchedulePresets(): { label: string; date: Date; timeLabel: string }[] {
  const now = new Date()
  
  // Tomorrow morning (8:00 AM)
  const tomMorning = new Date(now)
  tomMorning.setDate(tomMorning.getDate() + 1)
  tomMorning.setHours(8, 0, 0, 0)
  
  // Tomorrow afternoon (1:00 PM)
  const tomAfternoon = new Date(now)
  tomAfternoon.setDate(tomAfternoon.getDate() + 1)
  tomAfternoon.setHours(13, 0, 0, 0)
  
  // Monday morning (8:00 AM)
  const monday = new Date(now)
  const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7
  monday.setDate(monday.getDate() + daysUntilMonday)
  monday.setHours(8, 0, 0, 0)
  
  const fmtDate = (d: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
  }

  return [
    { label: 'Tomorrow morning', date: tomMorning, timeLabel: `${fmtDate(tomMorning)} 8:00 AM` },
    { label: 'Tomorrow afternoon', date: tomAfternoon, timeLabel: `${fmtDate(tomAfternoon)} 1:00 PM` },
    { label: 'Monday morning', date: monday, timeLabel: `${fmtDate(monday)} 8:00 AM` },
  ]
}
