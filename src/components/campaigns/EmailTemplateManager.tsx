'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Mail, Send, Loader2, CheckCircle, XCircle, AlertTriangle,
  Plus, Pencil, Trash2, Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/hooks/useAuth'
import { toast } from 'sonner'
import { EmailComposer, type MergeField } from '@/components/shared/EmailComposer'

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
  dealId: string; dealName: string; success: boolean; error?: string
}

interface Props {
  campaign: Campaign
  projectId: string
  leadsCount: number
  gmailConnected: boolean
  onCampaignUpdate: (data: Partial<Campaign>) => void
}

// ── Constants ───────────────────────────────────────────────────────────────

const BUILTIN_TYPES = [
  { value: 'outreach', label: 'Outreach (Built-in)' },
  { value: 'thank_you', label: 'Thank You (Built-in)' },
  { value: 'declination', label: 'Declination (Built-in)' },
]

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

// ── Styles ──────────────────────────────────────────────────────────────────

const sectionStyle = {
  background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-2)',
  borderRadius: 'var(--radius-lg)', padding: 20,
} as const

const mutedStyle = { fontSize: 13, color: 'var(--color-text-secondary)' } as const

// ── Component ───────────────────────────────────────────────────────────────

export function EmailTemplateManager({
  campaign, projectId, leadsCount, gmailConnected, onCampaignUpdate,
}: Props) {
  const { data: user } = useAuth()
  const queryClient = useQueryClient()

  // ── Template type state ──
  const [templateType, setTemplateType] = useState<string>(
    campaign.email_template_id ? `custom:${campaign.email_template_id}` : (campaign.email_template ?? 'outreach'),
  )
  const [subject, setSubject] = useState(campaign.email_subject_template ?? '')
  const [body, setBody] = useState(campaign.email_body_template ?? '')

  // ── Preview state ──
  const [previewDealId, setPreviewDealId] = useState<string>('')

  // ── Send state ──
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null)
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 })

  // ── Template CRUD dialog state ──
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // ── Custom templates ──
  const { data: customTemplates = [], refetch: refetchTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ['email-templates', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/templates?project_id=${encodeURIComponent(projectId)}`)
      if (!res.ok) return []
      return res.json()
    },
  })

  // ── Merge fields (imported only) ──
  const { data: importedFields = [] } = useQuery<FieldDef[]>({
    queryKey: ['field-definitions', projectId, 'imported'],
    queryFn: async () => {
      const res = await fetch(`/api/field-definitions?project_id=${encodeURIComponent(projectId)}&source=import`)
      if (!res.ok) return []
      return res.json()
    },
  })

  const mergeFields: MergeField[] = useMemo(() => [
    ...importedFields.map((f) => ({ key: f.key, label: f.label, group: 'Deal Fields' })),
    ...CONTACT_MERGE_FIELDS.map((f) => ({ ...f, group: 'Contact Fields' })),
    ...CAMPAIGN_MERGE_FIELDS.map((f) => ({ ...f, group: 'Campaign Info' })),
  ], [importedFields])

  // ── Available templates for EmailComposer pills ──
  const composerTemplates = useMemo(() =>
    customTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject_template,
      body: t.body_template,
    })),
  [customTemplates])

  // ── Persist to campaign (debounced) ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const scheduleSave = useCallback((updates: Partial<Campaign>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => onCampaignUpdate(updates), 800)
  }, [onCampaignUpdate])
  useEffect(() => { return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) } }, [])

  // ── Template type change ──
  const handleTypeChange = useCallback((value: string) => {
    setTemplateType(value)
    if (value.startsWith('custom:')) {
      const tplId = value.replace('custom:', '')
      const tpl = customTemplates.find((t) => t.id === tplId)
      scheduleSave({
        email_template_id: tplId,
        email_template: null,
        ...(tpl ? { email_subject_template: tpl.subject_template, email_body_template: tpl.body_template } : {}),
      })
      if (tpl) {
        setSubject(tpl.subject_template)
        setBody(tpl.body_template)
      }
    } else {
      scheduleSave({ email_template: value, email_template_id: null })
    }
  }, [customTemplates, scheduleSave])

  // ── Template CRUD ──
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
      await refetchTemplates()
      // Auto-select new template
      setTemplateType(`custom:${created.id}`)
      scheduleSave({ email_template_id: created.id, email_template: null })
    } catch {
      toast.error('Failed to create template')
    }
  }, [newTemplateName, projectId, subject, body, refetchTemplates, scheduleSave])

  const handleDeleteTemplate = useCallback(async (tplId: string) => {
    const tpl = customTemplates.find((t) => t.id === tplId)
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(tplId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success(`Template "${tpl?.name}" deleted`)
      if (templateType === `custom:${tplId}`) {
        setTemplateType('outreach')
        scheduleSave({ email_template: 'outreach', email_template_id: null })
      }
      await refetchTemplates()
    } catch {
      toast.error('Failed to delete template')
    }
  }, [customTemplates, templateType, refetchTemplates, scheduleSave])

  const handleRenameTemplate = useCallback(async (tplId: string) => {
    const name = editingName.trim()
    if (!name) return
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(tplId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to rename')
      toast.success('Template renamed')
      setEditingTemplateId(null)
      setEditingName('')
      await refetchTemplates()
    } catch {
      toast.error('Failed to rename template')
    }
  }, [editingName, refetchTemplates])

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
    queryKey: ['deals', { campaign_id: campaign.id, project_id: projectId, select: 'minimal', limit: 500 }],
    queryFn: async () => {
      const p = new URLSearchParams({ campaign_id: campaign.id, project_id: projectId, limit: '500', offset: '0' })
      const res = await fetch(`/api/deals?${p.toString()}`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.data ?? []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        deal_name: (d as Record<string, unknown>).deal_name as string | null,
      }))
    },
  })

  // ── Mass send ──
  const handleSend = useCallback(async () => {
    if (!gmailConnected) { toast.error('Gmail not connected for this project.'); return }
    setSending(true); setSendResults(null); setSendProgress({ sent: 0, total: 0 })

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
      if (!saveRes.ok) throw new Error('Failed to save template')
    } catch { toast.error('Failed to save template before sending'); setSending(false); return }

    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/send-emails`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Unknown error' })); throw new Error(err.error) }
      const result = await res.json()

      if (result.stillProcessing) {
        for (let attempt = 0; attempt < 12; attempt++) {
          await new Promise((r) => setTimeout(r, 2000))
          const statusRes = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/send-emails?status=progress&jobId=${encodeURIComponent(result.jobId)}`)
          if (!statusRes.ok) break
          const status = await statusRes.json()
          setSendProgress({ sent: status.sent ?? 0, total: status.total ?? 0 })
          if (!status.stillProcessing) break
        }
      }

      const finalRes = await fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/send-emails?status=results`)
      if (finalRes.ok) {
        const final = await finalRes.json()
        setSendResults(final.results ?? [])
        const sent = final.results?.filter((r: SendResult) => r.success).length ?? 0
        const failed = final.results?.filter((r: SendResult) => !r.success).length ?? 0
        toast.success(`Emails sent: ${sent} succeeded${failed > 0 ? `, ${failed} failed` : ''}`)
      }
      queryClient.invalidateQueries({ queryKey: ['deals', { campaign_id: campaign.id }] })
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to send emails') }
    finally { setSending(false) }
  }, [campaign, templateType, subject, body, projectId, gmailConnected, queryClient])

  const senderEmail = user?.email ?? 'owner@example.com'
  const mergedSubject = useMemo(() => resolveMergeFields(subject, previewDeal ?? null, campaign, senderEmail), [subject, previewDeal, campaign, senderEmail])
  const mergedBody = useMemo(() => resolveMergeFields(body, previewDeal ?? null, campaign, senderEmail), [body, previewDeal, campaign, senderEmail])

  return (
    <div style={sectionStyle}>
      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail className="h-3.5 w-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
          <Select value={templateType} onValueChange={handleTypeChange}>
            <SelectTrigger style={{
              height: 28, fontSize: 13, minWidth: 170,
              background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-2)',
              borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)',
            }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUILTIN_TYPES.map((bt) => (
                <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
              ))}
              {customTemplates.length > 0 && (
                <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Custom Templates
                </div>
              )}
              {customTemplates.map((t) => (
                <SelectItem key={t.id} value={`custom:${t.id}`}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowTemplateDialog(!showTemplateDialog)}
            style={{ height: 28, fontSize: 12, color: 'var(--color-text-secondary)' }}
          >
            <Settings className="h-3 w-3" style={{ marginRight: 4 }} />
            Manage
          </Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!gmailConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-md)', background: 'var(--color-warning)', fontSize: 12, color: 'var(--color-text-inverse)' }}>
              <AlertTriangle className="h-3 w-3" />Gmail not connected
            </div>
          )}
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !gmailConnected || leadsCount === 0}
            style={{ height: 32, fontSize: 13, gap: 6, background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? `Sending (${sendProgress.sent}/${sendProgress.total})` : `Send to ${leadsCount} leads`}
          </Button>
        </div>
      </div>

      {/* ── Template CRUD Dialog (inline panel) ── */}
      {showTemplateDialog && (
        <div style={{
          marginBottom: 16, border: '1px solid var(--color-surface-2)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-1)', padding: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12 }}>
            Manage Custom Templates
          </div>

          {/* Create new */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Input
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="New template name..."
              style={{ height: 30, fontSize: 13, flex: 1 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTemplate() }}
            />
            <Button size="sm" onClick={handleCreateTemplate} disabled={!newTemplateName.trim()}
              style={{ height: 30, fontSize: 12, gap: 4, background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}>
              <Plus className="h-3.5 w-3.5" />Create
            </Button>
          </div>

          {/* Existing templates list */}
          {customTemplates.length === 0 ? (
            <div style={mutedStyle}>No custom templates yet. Edit your email below and click Create to save it as a template.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {customTemplates.map((tpl) => (
                <div key={tpl.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  borderRadius: 'var(--radius-md)', background: 'var(--color-surface-0)',
                }}>
                  {editingTemplateId === tpl.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        style={{ height: 28, fontSize: 13, flex: 1 }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameTemplate(tpl.id) }}
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleRenameTemplate(tpl.id)} style={{ height: 28, fontSize: 11 }}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingTemplateId(null); setEditingName('') }} style={{ height: 28, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)' }}>{tpl.name}</span>
                      <button
                        type="button"
                        onClick={() => { setEditingTemplateId(tpl.id); setEditingName(tpl.name) }}
                        style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}
                        title="Rename"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Email Composer (template-edit mode) ── */}
      <div style={{ marginBottom: 14 }}>
        <EmailComposer
          mode="template-edit"
          subjectTemplate={subject}
          bodyTemplate={body}
          onSubjectChange={(v) => { setSubject(v); scheduleSave({ email_subject_template: v }) }}
          onBodyChange={(v) => { setBody(v); scheduleSave({ email_body_template: v }) }}
          mergeFields={mergeFields}
          availableTemplates={composerTemplates}
          minHeight={200}
          placeholder="Dear {owner_name},&#10;&#10;I am reaching out regarding {property_address}..."
        />
      </div>

      {/* ── Preview ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Preview with:</span>
          <Select value={previewDealId} onValueChange={setPreviewDealId}>
            <SelectTrigger style={{
              height: 28, fontSize: 12, minWidth: 180,
              background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-2)',
              borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)',
            }}>
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
          <div style={{ border: '1px dashed var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--color-canvas)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Preview</div>
            <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {mergedSubject || <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>(no subject)</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' as const, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: mergedBody || '<span style="color:var(--color-text-tertiary)">(no body)</span>' }}
            />
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              From: {senderEmail}
              {previewDeal.contacts[0] && <> · To: {previewDeal.contacts[0].name ?? previewDeal.contacts[0].email?.[0]}</>}
            </div>
          </div>
        ) : (
          <div style={{ border: '1px dashed var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 24, textAlign: 'center' as const }}>
            <span style={mutedStyle}>Select a deal to preview the merged email.</span>
          </div>
        )}
      </div>

      {/* ── Send results ── */}
      {sendResults && sendResults.length > 0 && (
        <div style={{ marginTop: 14, border: '1px solid var(--color-surface-2)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-surface-2)', background: 'var(--color-surface-1)', fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {sendResults.filter((r) => r.success).length === sendResults.length
              ? <CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--color-success)' }} />
              : sendResults.some((r) => r.success)
                ? <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--color-warning)' }} />
                : <XCircle className="h-3.5 w-3.5" style={{ color: 'var(--color-danger)' }} />
            }
            {sendResults.filter((r) => r.success).length} sent, {sendResults.filter((r) => !r.success).length} failed
          </div>
          <div style={{ maxHeight: 180, overflow: 'auto', padding: '4px 0' }}>
            {sendResults.map((r) => (
              <div key={r.dealId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 12 }}>
                {r.success
                  ? <CheckCircle className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                  : <XCircle className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--color-danger)' }} />
                }
                <span style={{ color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {r.dealName || 'Untitled Deal'}
                </span>
                {!r.success && r.error && (
                  <span style={{ color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
