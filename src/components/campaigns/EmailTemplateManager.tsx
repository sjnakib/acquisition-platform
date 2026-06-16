'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Mail, Send, Loader2, CheckCircle, XCircle, AlertTriangle,
  Search, Info, HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/hooks/useAuth'
import { toast } from 'sonner'
import { EmailComposer, type MergeField, type EmailComposerHandle } from '@/components/shared/EmailComposer'
import { type GoogleConnectionStatus } from '@/lib/hooks/useGoogleConnection'

// ── Types ───────────────────────────────────────────────────────────────────

interface Campaign {
  id: string; name: string; email_template: string | null
  email_template_id: string | null
  email_subject_template: string | null; email_body_template: string | null
}

interface FieldDef {
  id: string; key: string; label: string; data_type: string; source?: string | null
}

interface EmailTemplate {
  id: string; name: string; subject_template: string; body_template: string
  project_id: string; created_at: string
}

interface Contact {
  id: string; name: string | null; company: string | null; email: string[] | null
  phone_office: string | null; phone_cell: string | null; is_primary: boolean | null
}

interface PreviewDeal {
  id: string; deal_name: string | null
  deal_fields: { value: string | null; field_definitions: { key: string; label: string; data_type: string } | null }[]
  contacts: Contact[]
}

interface SendResult {
  dealId: string; dealName: string; recipient: string; success: boolean; error?: string
}

interface Props {
  campaign: Campaign
  projectId: string
  leadsCount: number
  gmailConnected: boolean
  onCampaignUpdate: (data: Partial<Campaign>) => void
  /** Called when the API returns google_auth_expired during send. */
  onAuthExpired?: () => void
  connectionStatus?: GoogleConnectionStatus
}

// ── Constants ───────────────────────────────────────────────────────────────

const BUILTIN_TYPES = [
  { value: 'outreach', label: 'Outreach' },
  { value: 'thank_you', label: 'Thank You' },
  { value: 'declination', label: 'Declination' },
]

const BUILTIN_DEFAULTS: Record<string, { subject: string; body: string }> = {
  outreach: {
    subject: '{property_address} — Investment Opportunity',
    body: 'Dear {contact_name},<br><br>I am reaching out regarding {property_address}. We are active acquirers in this market and would love to connect.<br><br>Best regards,<br>{sender_name}'
  },
  thank_you: {
    subject: 'Thank You — {property_address}',
    body: 'Dear {contact_name},<br><br>Thank you for your time and for providing the information regarding {property_address}. We appreciate the opportunity to review the materials.<br><br>We will be in touch with next steps shortly.<br><br>Best regards,<br>{sender_name}'
  },
  declination: {
    subject: 'Update — {property_address}',
    body: 'Dear {contact_name},<br><br>After careful review, we have decided to pass on {property_address} at this time. We appreciate you sharing the details with us.<br><br>We wish you the best with the sale.<br><br>Best regards,<br>{sender_name}'
  }
}

const CONTACT_MERGE_FIELDS = [
  { key: 'contact_name', label: 'Contact Name' },
  { key: 'contact_email', label: 'Contact Email' },
  { key: 'contact_phone', label: 'Contact Phone' },
  { key: 'contact_company', label: 'Contact Company' },
]

const CAMPAIGN_MERGE_FIELDS = [
  { key: 'campaign_name', label: 'Campaign Name' },
  { key: 'sender_name', label: 'Sender Name' },
]

function resolveMergeFields(template: string, deal: PreviewDeal | null, campaign: Campaign, senderEmail: string): string {
  let result = template
  if (!deal) return result
  for (const df of deal.deal_fields) {
    const key = df.field_definitions?.key
    if (key) result = result.replaceAll(`{${key}}`, df.value ?? '')
  }
  // Fallback for legacy {deal_name} -> mapped to address field value
  const addressField = deal.deal_fields.find((f) => f.field_definitions?.key === 'address')
  if (addressField) {
    result = result.replaceAll('{deal_name}', addressField.value ?? '')
  }
  // Fallback for legacy {units} -> mapped to unit_count field value
  const unitsField = deal.deal_fields.find((f) => f.field_definitions?.key === 'unit_count')
  if (unitsField) {
    result = result.replaceAll('{units}', unitsField.value ?? '')
  }
  const primaryContact = deal.contacts.find((c) => c.is_primary) ?? deal.contacts[0]
  for (const cf of CONTACT_MERGE_FIELDS) {
    let value = ''
    if (primaryContact) {
      if (cf.key === 'contact_name') value = primaryContact.name ?? ''
      if (cf.key === 'contact_email') value = primaryContact.email?.[0] ?? ''
      if (cf.key === 'contact_phone') value = primaryContact.phone_cell ?? primaryContact.phone_office ?? ''
      if (cf.key === 'contact_company') value = primaryContact.company ?? ''
    }
    result = result.replaceAll(`{${cf.key}}`, value)
  }
  result = result.replaceAll('{campaign_name}', campaign.name)
  result = result.replaceAll('{sender_name}', senderEmail)
  return result
}

// ── Component ───────────────────────────────────────────────────────────────

export function EmailTemplateManager({
  campaign, projectId, leadsCount, gmailConnected, onAuthExpired, onCampaignUpdate, connectionStatus,
}: Props) {
  const { data: user } = useAuth()
  const queryClient = useQueryClient()
  const composerRef = useRef<EmailComposerHandle>(null)

  // ── Template type state ──
  const [templateType, setTemplateType] = useState<string>(
    campaign.email_template_id ? `custom:${campaign.email_template_id}` : (campaign.email_template ?? 'outreach'),
  )
  const [subject, setSubject] = useState(campaign.email_subject_template ?? '')
  const [body, setBody] = useState(campaign.email_body_template ?? '')

  // ── Split screen helper state ──
  const [helperTab, setHelperTab] = useState<'preview' | 'merge_fields'>('preview')
  const [mergeFieldSearch, setMergeFieldSearch] = useState('')

  // ── Preview state ──
  const [previewDealId, setPreviewDealId] = useState<string>('')

  // ── Send state ──
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null)
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 })
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [sendComplete, setSendComplete] = useState(false)

  // ── Template CRUD state ──
  const [newTemplateName, setNewTemplateName] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // ── Custom templates ──
  const { data: customTemplates = [], refetch: refetchTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/templates?project_id=${encodeURIComponent(projectId)}`)
      if (!res.ok) return []
      return res.json()
    },
  })

  // ── Merge fields (imported + system + manual) ──
  const { data: dealFields = [] } = useQuery<FieldDef[]>({
    queryKey: ['field-definitions', projectId, 'deals-merge'],
    queryFn: async () => {
      const res = await fetch(`/api/field-definitions?project_id=${encodeURIComponent(projectId)}`)
      if (!res.ok) return []
      return res.json()
    },
  })

  const mergeFields: MergeField[] = useMemo(() => [
    ...dealFields.map((f) => ({ key: f.key, label: f.label, group: 'Deal Fields' })),
    ...CONTACT_MERGE_FIELDS.map((f) => ({ ...f, group: 'Contact Fields' })),
    ...CAMPAIGN_MERGE_FIELDS.map((f) => ({ ...f, group: 'Campaign Info' })),
  ], [dealFields])

  const filteredMergeFields = useMemo(() => {
    if (!mergeFieldSearch.trim()) return mergeFields
    const q = mergeFieldSearch.toLowerCase()
    return mergeFields.filter(
      (f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    )
  }, [mergeFields, mergeFieldSearch])

  const groupedMergeFields = useMemo(() => {
    const map = new Map<string, MergeField[]>()
    for (const f of filteredMergeFields) {
      const group = map.get(f.group) ?? []
      group.push(f)
      if (!map.has(f.group)) map.set(f.group, group)
    }
    return Array.from(map.entries())
  }, [filteredMergeFields])


  // ── Active Template and Saved content tracking ──
  const activeTemplate = useMemo(() => {
    if (templateType.startsWith('custom:')) {
      const tplId = templateType.replace('custom:', '')
      return customTemplates.find((t) => t.id === tplId)
    }
    return null
  }, [templateType, customTemplates])

  const savedSubject = useMemo(() => {
    if (activeTemplate) {
      return activeTemplate.subject_template
    }
    return campaign.email_subject_template ?? BUILTIN_DEFAULTS[templateType]?.subject ?? ''
  }, [activeTemplate, campaign.email_subject_template, templateType])

  const savedBody = useMemo(() => {
    if (activeTemplate) {
      return activeTemplate.body_template
    }
    return campaign.email_body_template ?? BUILTIN_DEFAULTS[templateType]?.body ?? ''
  }, [activeTemplate, campaign.email_body_template, templateType])

  // ── Dirty State Checking ──
  const isDirty = useMemo(() => {
    const normalize = (html: string) => {
      if (!html) return ''
      const cleaned = html.replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, '').replace(/<br\s*\/?>/g, '').trim()
      return cleaned === '' ? '' : html
    }
    return subject !== savedSubject || normalize(body) !== normalize(savedBody)
  }, [subject, savedSubject, body, savedBody])

  // ── Synchronize state when template selection updates ──
  const currentTemplateKey = templateType.startsWith('custom:')
    ? templateType
    : `builtin:${templateType}`

  const [loadedTemplateKey, setLoadedTemplateKey] = useState<string>('')
  const prevSavedSubjectRef = useRef(savedSubject)
  const prevSavedBodyRef = useRef(savedBody)

  useEffect(() => {
    const isTemplateSwitch = currentTemplateKey !== loadedTemplateKey
    const isInitialLoad = loadedTemplateKey === ''

    if (isTemplateSwitch || isInitialLoad || (subject === prevSavedSubjectRef.current && body === prevSavedBodyRef.current)) {
      setSubject(savedSubject)
      setBody(savedBody)
      setLoadedTemplateKey(currentTemplateKey)
    }

    prevSavedSubjectRef.current = savedSubject
    prevSavedBodyRef.current = savedBody
  }, [currentTemplateKey, savedSubject, savedBody, loadedTemplateKey, subject, body])

  // ── Template type change ──
  const handleTypeChange = useCallback(async (value: string) => {
    if (value === 'create_new') {
      setShowCreateDialog(true)
      return
    }

    if (subject !== savedSubject || body !== savedBody) {
      const confirm = window.confirm("You have unsaved changes in the current template. Do you want to discard them and switch templates?")
      if (!confirm) return
    }

    setTemplateType(value)
    if (value.startsWith('custom:')) {
      const tplId = value.replace('custom:', '')
      const tpl = customTemplates.find((t) => t.id === tplId)
      await onCampaignUpdate({
        email_template_id: tplId,
        email_template: null,
        email_subject_template: tpl?.subject_template ?? '',
        email_body_template: tpl?.body_template ?? '',
      })
    } else {
      const defaultTpl = BUILTIN_DEFAULTS[value]
      await onCampaignUpdate({
        email_template: value,
        email_template_id: null,
        email_subject_template: defaultTpl?.subject ?? '',
        email_body_template: defaultTpl?.body ?? '',
      })
    }
  }, [customTemplates, onCampaignUpdate, subject, body, savedSubject, savedBody])

  // ── Save & Discard changes ──
  const handleSaveChanges = useCallback(async () => {
    try {
      if (templateType.startsWith('custom:')) {
        const tplId = templateType.replace('custom:', '')
        const res = await fetch(`/api/templates/${encodeURIComponent(tplId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject_template: subject, body_template: body }),
        })
        if (!res.ok) throw new Error('Failed to update template')
        await refetchTemplates()
      }

      await onCampaignUpdate({
        email_subject_template: subject,
        email_body_template: body,
      })

      toast.success('Changes saved successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes')
    }
  }, [templateType, subject, body, refetchTemplates, onCampaignUpdate])

  const handleDiscardChanges = useCallback(() => {
    setSubject(savedSubject)
    setBody(savedBody)
    toast.success('Changes discarded')
  }, [savedSubject, savedBody])

  // ── Template Creation ──
  const handleCreateTemplate = useCallback(async () => {
    const name = newTemplateName.trim()
    if (!name) return
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name, subject_template: subject, body_template: body }),
      })
      if (!res.ok) throw new Error('Failed to create template')
      const created = await res.json()
      toast.success(`Template "${name}" created`)
      setNewTemplateName('')
      setShowCreateDialog(false)
      await refetchTemplates()

      // Auto-select new template
      await onCampaignUpdate({
        email_template_id: created.id,
        email_template: null,
        email_subject_template: subject,
        email_body_template: body,
      })
      setTemplateType(`custom:${created.id}`)
    } catch {
      toast.error('Failed to create template')
    }
  }, [newTemplateName, projectId, subject, body, refetchTemplates, onCampaignUpdate])

  // ── Preview ──
  const { data: firstDealId } = useQuery<string | null>({
    queryKey: ['deals', { campaign_id: campaign.id, project_id: projectId, limit: 1 }],
    queryFn: async () => {
      const p = new URLSearchParams({ campaign_id: campaign.id, project_id: projectId, limit: '1', offset: '0' })
      const res = await fetch(`/api/deals?${p.toString()}`)
      if (!res.ok) return null
      const json = await res.json()
      return json.data?.[0]?.id ?? null
    },
  })
  const effectivePreviewDealId = previewDealId || firstDealId || ''

  const { data: previewDeal } = useQuery<PreviewDeal>({
    queryKey: ['deal', effectivePreviewDealId],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${encodeURIComponent(effectivePreviewDealId)}`)
      if (!res.ok) throw new Error('Failed to fetch deal')
      return res.json()
    },
    enabled: effectivePreviewDealId !== '' && effectivePreviewDealId !== '__first__',
  })

  const { data: campaignDeals = [] } = useQuery<{ id: string; deal_name: string | null }[]>({
    queryKey: ['deals', { campaign_id: campaign.id, project_id: projectId, select: 'minimal', limit: 5 }],
    queryFn: async () => {
      const p = new URLSearchParams({ campaign_id: campaign.id, project_id: projectId, limit: '5', offset: '0' })
      const res = await fetch(`/api/deals?${p.toString()}`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.data ?? []).map((d: Record<string, unknown>) => {
        const dealFields = (d.deal_fields ?? []) as { value: string | null; field_definitions: { key: string } | null }[]
        const addressField = dealFields.find((f) => f.field_definitions?.key === 'address')
        return {
          id: d.id as string,
          deal_name: addressField?.value ?? 'Untitled Deal',
        }
      })
    },
  })

  // ── Merge field insert callback ──
  const handleMergeFieldClick = useCallback((key: string) => {
    composerRef.current?.insertHTML(`{${key}}`)
  }, [])

  // ── Mass send ──
  const handleSend = useCallback(async () => {
    if (!gmailConnected) { toast.error('Gmail not connected for this project.'); return }
    setSending(true)
    setSendResults(null)
    setSendProgress({ sent: 0, total: 0 })
    setSendComplete(false)
    setShowSendDialog(true)

    try {
      const saveRes = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_template: templateType.startsWith('custom:') ? null : templateType,
          email_template_id: templateType.startsWith('custom:') ? templateType.replace('custom:', '') : null,
          email_subject_template: subject,
          email_body_template: body,
        }),
      })
      if (!saveRes.ok) {
        const errBody = await saveRes.json().catch(() => ({}))
        const msg = (errBody as Record<string, unknown>).error
          ?? (errBody as Record<string, unknown>).details
          ?? `Failed to save template (HTTP ${saveRes.status})`
        throw new Error(String(msg))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template before sending')
      setSending(false)
      setShowSendDialog(false)
      return
    }

    try {
      let currentJobId: string | undefined
      const allResults: SendResult[] = []

      // Loop: send batches, re-POSTing if the API returns stillProcessing for large campaigns
      for (let batch = 0; batch < 30; batch++) {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/send-emails`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, jobId: currentJobId }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as Record<string, unknown>).detail as string || (err as Record<string, unknown>).error as string || 'Unknown error')
        }
        const result = await res.json()

        // If the API returned an error or no emails were queued, surface it immediately
        if (result.error && result.total === 0) {
          setSendResults([{ dealId: '', dealName: result.detail as string || result.error as string, recipient: '', success: false, error: result.detail as string || result.error as string }])
          setSendComplete(true)
          setSending(false)
          return
        }

        currentJobId = result.jobId as string
        if (result.total > 0) {
          setSendProgress({ sent: result.sent ?? 0, total: result.total })
        }

        // Poll for progress while stillProcessing
        if (result.stillProcessing) {
          for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise((r) => setTimeout(r, 3000))
            const statusRes = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/send-emails?status=progress&jobId=${encodeURIComponent(currentJobId)}`)
            if (!statusRes.ok) break
            const status = await statusRes.json()
            setSendProgress({ sent: status.sent ?? 0, total: status.total ?? 0 })

            // Results may come through progress polling
            if (status.results) {
              const newResults = (status.results as SendResult[]).filter(
                (r) => !allResults.some((a) => a.dealId === r.dealId && a.recipient === r.recipient),
              )
              allResults.push(...newResults)
            }

            if (!status.stillProcessing) {
              // Merge final results
              if (status.results) {
                setSendResults(status.results as SendResult[])
              } else {
                setSendResults(allResults)
              }
              setSendComplete(true)
              queryClient.invalidateQueries({ queryKey: ['deals', { campaign_id: campaign.id }] })
              setSending(false)
              return
            }
          }
          // Poll loop ended but still processing — re-POST to continue
          continue
        }

        // No stillProcessing — all done in this batch
        if (result.results) {
          allResults.push(...(result.results as SendResult[]))
        }
        setSendResults(allResults)
        setSendComplete(true)
        queryClient.invalidateQueries({ queryKey: ['deals', { campaign_id: campaign.id }] })
        setSending(false)
        return
      }

      // Exhausted batch retries
      setSendResults(allResults.length > 0 ? allResults : [{ dealId: '', dealName: 'Send incomplete', recipient: '', success: false, error: 'Maximum send batches reached. Some emails may not have been sent.' }])
      setSendComplete(true)
    } catch (err) {
      if (err instanceof Error && err.message.includes('google_auth_expired')) {
        onAuthExpired?.()
        toast.error('Google authentication expired. Please reconnect.')
        return
      }
      setSendResults([{ dealId: '', dealName: 'Send failed', recipient: '', success: false, error: err instanceof Error ? err.message : 'Failed to send emails' }])
      setSendComplete(true)
    } finally { setSending(false) }
  }, [campaign, templateType, subject, body, projectId, gmailConnected, queryClient])

  const senderEmail = user?.email ?? 'owner@example.com'
  const mergedSubject = useMemo(() => resolveMergeFields(subject, previewDeal ?? null, campaign, senderEmail), [subject, previewDeal, campaign, senderEmail])
  const mergedBody = useMemo(() => resolveMergeFields(body, previewDeal ?? null, campaign, senderEmail), [body, previewDeal, campaign, senderEmail])

  // Pre-group send results by deal for the report dialog
  const groupedSendResults = useMemo(() => {
    if (!sendResults) return []
    const groups = new Map<string, SendResult[]>()
    for (const r of sendResults) {
      const key = r.dealId || '__error__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    return Array.from(groups.entries())
  }, [sendResults])

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] rounded-[var(--radius-lg)] p-5">
      {/* ── Top Utility Header ── */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-2)] mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Template:</span>
          <Select value={templateType} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-8 text-xs min-w-[210px] bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] font-medium">
              <SelectValue placeholder="Select email template..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-[9px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.06em] select-none">
                READY TEMPLATES
              </div>
              {BUILTIN_TYPES.map((bt) => (
                <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
              ))}
              {customTemplates.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[9px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.06em] select-none border-t border-[var(--color-surface-2)] mt-1.5 pt-1.5">
                    CUSTOM TEMPLATES
                  </div>
                  {customTemplates.map((t) => (
                    <SelectItem key={t.id} value={`custom:${t.id}`}>{t.name}</SelectItem>
                  ))}
                </>
              )}
              <SelectItem value="create_new" className="text-[var(--accent)] font-semibold border-t border-[var(--color-surface-2)] mt-1.5 pt-1.5 cursor-pointer">
                + Create New Template...
              </SelectItem>
            </SelectContent>
          </Select>

          {isDirty && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <Button
                size="sm"
                onClick={handleSaveChanges}
                className="h-8 text-xs bg-[var(--accent)] text-[var(--color-text-inverse)] hover:opacity-95 font-medium px-3"
              >
                Save Changes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDiscardChanges}
                className="h-8 text-xs border-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)] font-medium px-3"
              >
                Discard
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!gmailConnected && (
            connectionStatus === 'expired' ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-xs text-[var(--color-warning-text)] font-semibold animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning-text)]" />
                <span>Gmail Connection Expired — Reconnect to Send</span>
                <button
                  type="button"
                  onClick={onAuthExpired}
                  className="underline ml-1 font-bold hover:opacity-90 cursor-pointer"
                  style={{ color: 'var(--color-warning-text)' }}
                >
                  Reconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-xs text-[var(--color-warning-text)] font-medium animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5" />Connect Gmail Account to Send
              </div>
            )
          )}
          {gmailConnected && leadsCount === 0 && (
            <span className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> No leads to send — import deals or move them to Lead stage
            </span>
          )}
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !gmailConnected || leadsCount === 0}
            className="h-9 px-4 text-xs font-semibold gap-2 bg-[var(--accent)] text-[var(--color-text-inverse)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] hover:opacity-95 transition-opacity"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send to {leadsCount} lead{leadsCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      {/* ── Main Workspace split screen ── */}
      <div className="flex-1 min-h-0 flex gap-6">
        {/* Left pane: Editor (60%) */}
        <div className="w-3/5 min-w-0 flex flex-col h-full">
          <div className="flex-1 min-h-0 flex flex-col">
            <EmailComposer
              ref={composerRef}
              mode="template-edit"
              subjectTemplate={subject}
              bodyTemplate={body}
              onSubjectChange={setSubject}
              onBodyChange={setBody}
              mergeFields={mergeFields}
              minHeight={320}
              placeholder="Dear {owner_name},&#10;&#10;I am reaching out regarding {property_address}..."
              hideMergeFields={true}
              className="flex-1 min-h-0"
            />
          </div>
        </div>

        {/* Right pane: Helper panel (40%) */}
        <div className="w-2/5 min-w-[290px] flex flex-col border border-[var(--color-surface-2)] rounded-[var(--radius-lg)] bg-[var(--color-surface-0)] overflow-hidden h-full shadow-[var(--shadow-xs)]">
          {/* Subtabs header */}
          <div className="relative flex border-b border-[var(--color-surface-2)] bg-[var(--color-surface-1)]">
            {/* Sliding active tab indicator */}
            <div
              className="absolute top-0 bottom-0 left-0 w-1/2 bg-[var(--color-surface-0)] border-t-2 border-t-[var(--accent)] pointer-events-none"
              style={{
                transform: `translateX(${helperTab === 'preview' ? '0%' : '100%'})`,
                transition: 'transform 220ms var(--ease-premium)',
              }}
            />
            <button
              type="button"
              onClick={() => setHelperTab('preview')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-center border-r border-[var(--color-surface-2)] relative z-10 transition-colors duration-200 ${helperTab === 'preview'
                ? 'text-[var(--accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]/50'
                }`}
            >
              Live Preview
            </button>
            <button
              type="button"
              onClick={() => setHelperTab('merge_fields')}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-center relative z-10 transition-colors duration-200 ${helperTab === 'merge_fields'
                ? 'text-[var(--accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]/50'
                }`}
            >
              Merge Fields
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col">
            {helperTab === 'preview' && (
              <div className="flex-1 flex flex-col h-full animate-tab-entrance">
                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                  <span className="text-xs text-[var(--color-text-tertiary)] font-medium">Preview with deal:</span>
                  <Select value={effectivePreviewDealId} onValueChange={setPreviewDealId}>
                    <SelectTrigger className="h-7 text-xs flex-1 max-w-[200px] bg-[var(--color-surface-0)] border border-[var(--color-surface-2)]">
                      <SelectValue placeholder="Select a deal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaignDeals.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.deal_name ?? 'Untitled Deal'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {previewDeal ? (
                  <div className="flex-1 flex flex-col border border-[var(--color-surface-2)] rounded-[var(--radius-md)] bg-[var(--color-canvas)] overflow-hidden shadow-[var(--shadow-xs)] min-h-[300px]">
                    {/* Simulated email header */}
                    <div className="bg-[var(--color-surface-1)] border-b border-[var(--color-surface-2)] p-3 text-xs text-[var(--color-text-secondary)] space-y-1 flex-shrink-0 min-w-0">
                      <div className="flex min-w-0"><span className="w-12 flex-shrink-0 text-[var(--color-text-tertiary)] font-medium">From:</span> <span className="font-mono min-w-0 truncate">{senderEmail}</span></div>
                      <div className="flex min-w-0">
                        <span className="w-12 flex-shrink-0 text-[var(--color-text-tertiary)] font-medium">To:</span>
                        <span className="font-semibold text-[var(--color-text-primary)] min-w-0 truncate">
                          {previewDeal.contacts[0] ? `"${previewDeal.contacts[0].name ?? 'Contact'}" <${previewDeal.contacts[0].email?.[0] ?? ''}>` : '(No contact set)'}
                        </span>
                      </div>
                      <div className="flex items-start min-w-0">
                        <span className="w-12 flex-shrink-0 text-[var(--color-text-tertiary)] font-medium mt-0.5">Subject:</span>
                        <span className="font-semibold text-[var(--color-text-primary)] flex-1 min-w-0 line-clamp-2">{mergedSubject || '(no subject)'}</span>
                      </div>
                    </div>
                    {/* Email body render */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[var(--color-surface-0)] min-h-0">
                      <div
                        className="text-[13px] text-[var(--color-text-primary)] space-y-3 leading-relaxed break-words outline-none"
                        style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        dangerouslySetInnerHTML={{ __html: mergedBody || '<span class="text-[var(--color-text-tertiary)] italic">(no body)</span>' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[var(--color-surface-3)] rounded-[var(--radius-md)] p-6 text-center text-[var(--color-text-tertiary)] min-h-[300px]">
                    <HelpCircle className="h-8 w-8 mb-2 opacity-50 text-[var(--color-text-tertiary)]" />
                    <span className="text-xs">Select a deal to preview the merged email.</span>
                  </div>
                )}
              </div>
            )}

            {helperTab === 'merge_fields' && (
              <div className="flex-1 flex flex-col h-full animate-tab-entrance">
                <div className="relative mb-3 flex-shrink-0">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                  <Input
                    value={mergeFieldSearch}
                    onChange={(e) => setMergeFieldSearch(e.target.value)}
                    placeholder="Search merge fields..."
                    className="h-8 pl-8 text-xs bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] rounded-[var(--radius-sm)]"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
                  {groupedMergeFields.map(([label, fields]) => (
                    <div key={label} className="space-y-1.5">
                      <h4 className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.06em] mb-1">
                        {label}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {fields.map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => handleMergeFieldClick(f.key)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-1)] border border-[var(--color-surface-2)] text-[10px] font-mono text-[var(--accent)] hover:bg-[var(--color-surface-2)] hover:text-[var(--accent)] active:scale-[0.98] transition-all cursor-pointer"
                            title={`Insert ${f.label}`}
                          >
                            {'{' + f.key + '}'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {groupedMergeFields.length === 0 && (
                    <div className="text-center py-8 text-xs text-[var(--color-text-tertiary)]">
                      No matching fields found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Send progress & results dialog ── */}
      <Dialog open={showSendDialog} onOpenChange={(open) => { if (!open && !sending) { setShowSendDialog(false); setSendComplete(false); setSendResults(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {sendComplete ? 'Send Report' : 'Sending Emails'}
            </DialogTitle>
            <DialogDescription>
              {sendComplete
                ? `Campaign: ${campaign.name}`
                : `Sending outreach emails to ${leadsCount} lead${leadsCount !== 1 ? 's' : ''}…`}
            </DialogDescription>
          </DialogHeader>

          {/* Progress phase */}
          {!sendComplete && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                <span style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>
                  {sendProgress.total > 0
                    ? `Sending ${sendProgress.sent} of ${sendProgress.total}…`
                    : 'Preparing…'}
                </span>
              </div>
              {sendProgress.total > 0 && (
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--color-surface-2)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((sendProgress.sent / sendProgress.total) * 100)}%`,
                      background: 'var(--color-accent)',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Results phase */}
          {sendComplete && sendResults && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const succeeded = sendResults.filter((r) => r.success).length
                  const failed = sendResults.filter((r) => !r.success).length
                  const allOk = failed === 0 && succeeded > 0
                  const mixed = succeeded > 0 && failed > 0
                  return (
                    <>
                      {allOk ? (
                        <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--color-success-solid)' }} />
                      ) : mixed ? (
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--color-warning-solid)' }} />
                      ) : (
                        <XCircle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--color-danger-solid)' }} />
                      )}
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {succeeded} succeeded
                        {failed > 0 && `, ${failed} failed`}
                      </span>
                    </>
                  )
                })()}
              </div>

              {/* Per-email breakdown */}
              <div
                className="max-h-64 overflow-auto rounded border"
                style={{
                  borderColor: 'var(--color-surface-2)',
                  background: 'var(--color-surface-0)',
                }}
              >
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--color-text-tertiary)', fontWeight: 500, width: 28 }}></th>
                      <th className="text-left px-0 py-2" style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>Deal</th>
                      <th className="text-left px-0 py-2" style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>Recipient</th>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--color-text-tertiary)', fontWeight: 500, width: 120 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedSendResults.map(([dealId, results]) => {
                      const dealName = results[0]?.dealName || 'Untitled Deal'
                      return results.map((r, ri) => (
                        <tr
                          key={`${dealId}-${ri}-${r.recipient}`}
                          style={{
                            borderBottom: '1px solid var(--color-surface-1)',
                          }}
                        >
                          <td className="px-3 py-2">
                            {r.success ? (
                              <CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--color-success-solid)' }} />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" style={{ color: 'var(--color-danger-solid)' }} />
                            )}
                          </td>
                          <td className="px-0 py-2" style={{ color: 'var(--color-text-primary)', maxWidth: 140 }}>
                            <div className="truncate" title={dealName}>
                              {ri === 0 ? dealName : ''}
                            </div>
                          </td>
                          <td className="px-0 py-2" style={{ color: 'var(--color-text-secondary)', maxWidth: 170, fontFamily: 'var(--font-jetbrains-mono)', fontSize: 11 }}>
                            <div className="truncate" title={r.recipient}>{r.recipient}</div>
                          </td>
                          <td className="px-3 py-2">
                            {r.success ? (
                              <span style={{ color: 'var(--color-success-text)' }}>Sent</span>
                            ) : (
                              <span
                                style={{ color: 'var(--color-danger-text)' }}
                                title={r.error}
                              >
                                {r.error || 'Failed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant={sendComplete ? 'default' : 'outline'}
              onClick={() => { setShowSendDialog(false); setSendComplete(false); setSendResults(null) }}
              disabled={!sendComplete}
            >
              {sendComplete ? 'Close' : 'Sending…'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Template Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Enter a name for your new email template. The current subject and body in the editor will be saved as the template content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="template-name" className="text-xs font-semibold text-[var(--color-text-secondary)]">Template Name</label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Follow-up outreach..."
                className="h-9 text-xs bg-[var(--color-surface-0)] border border-[var(--color-surface-2)] rounded-[var(--radius-md)]"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTemplate() }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowCreateDialog(false); setNewTemplateName('') }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={!newTemplateName.trim()}
              className="bg-[var(--accent)] text-[var(--color-text-inverse)] hover:opacity-95"
            >
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
