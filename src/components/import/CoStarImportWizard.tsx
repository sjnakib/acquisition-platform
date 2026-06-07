'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImportPreviewTable } from '@/components/import/ImportPreviewTable'
import { FileDropZone } from '@/components/shared/FileDropZone'
import { useQuery } from '@tanstack/react-query'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Label } from '@/components/ui/label'
import { Tooltip } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import type { ColumnActionInput } from '@/lib/validations/import.schema'
import { detectAction } from '@/lib/import/mapping'

interface PreviousMappingData {
  source_headers: string[]
  column_mapping: Record<string, ColumnActionInput>
}

interface ImportStatus {
  status: string
  inserted: number | null
  skipped: number | null
  total_rows: number
  error_log: string[] | null
}

const uploadSchema = z.object({
  campaignId: z.string().uuid('Please select a campaign'),
  file: z.instanceof(File, { message: 'Please select an Excel file' }),
})

type UploadSchema = z.infer<typeof uploadSchema>

interface FieldDef {
  id: string
  key: string
  label: string
  data_type: string
  show_in_grid: boolean
  sort_order: number
}

interface Props {
  projectId?: string
  defaultCampaignId?: string
}

export function CoStarImportWizard({ projectId, defaultCampaignId }: Props) {
  const [step, setStep] = useState(1)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([])
  const [batchId, setBatchId] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, ColumnActionInput>>({})
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [mappingSaving, setMappingSaving] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()

  // Email validation dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailValidationResult, setEmailValidationResult] = useState<{
    totalEmails: number; invalidEmails: number; errors: string[]
  } | null>(null)

  // Poll import status in step 3
  useEffect(() => {
    if (step !== 3 || !batchId) return
    let active = true
    const poll = async () => {
      try {
        const res = await fetch(`/api/deals/import/${batchId}/status`)
        if (!res.ok) return
        const data: ImportStatus = await res.json()
        if (!active) return
        setImportStatus(data)
        if (data.status === 'done' || data.status === 'failed') {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        }
      } catch { /* retry on next tick */ }
    }
    poll()
    pollRef.current = setInterval(poll, 1500)
    return () => { active = false; if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [step, batchId])

  const { data: campaigns, isLoading: campaignsLoading, error: campaignsError } = useQuery({
    queryKey: ['campaigns', projectId],
    queryFn: async () => {
      const url = projectId ? `/api/campaigns?project_id=${projectId}` : '/api/campaigns'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch campaigns')
      return res.json() as Promise<Array<{ id: string; name: string; market: string }>>
    },
  })

  const { data: fieldDefs = [] } = useQuery<FieldDef[]>({
    queryKey: ['field-definitions', projectId],
    queryFn: async () => {
      const url = projectId
        ? `/api/field-definitions?project_id=${projectId}`
        : '/api/field-definitions'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch field definitions')
      return res.json()
    },
    enabled: !!projectId,
  })

  const { data: previousMapping } = useQuery<PreviousMappingData | null>({
    queryKey: ['previous-mapping', selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return null
      const res = await fetch(
        `/api/deals/import/previous-mapping?campaign_id=${selectedCampaignId}`,
      )
      if (!res.ok) throw new Error('Failed to fetch previous mapping')
      return res.json()
    },
    enabled: !!selectedCampaignId && step === 2,
  })

  const { control, handleSubmit, setValue, getValues, watch, formState: { errors, isSubmitting } } =
    useForm<UploadSchema>({
      resolver: zodResolver(uploadSchema),
      defaultValues: { campaignId: defaultCampaignId ?? '' },
    })

  const campaignId = watch('campaignId')
  const selectedFile = watch('file')

  // Auto-detect mapping when preview data + fieldDefs are ready
  const buildDefaultMapping = useCallback(
    (headers: string[], defs: FieldDef[]) => {
      const existingKeys = defs.map((fd) => fd.key)
      const map: Record<string, ColumnActionInput> = {}
      for (const h of headers) {
        map[h] = detectAction(h, existingKeys) as ColumnActionInput
      }
      // Ensure at least one column is mapped to deal_name if none was auto-detected
      const hasDealName = Object.values(map).some(
        (a) => a.action === 'field' && (a as { key: string }).key === 'deal_name',
      )
      if (!hasDealName && headers.length > 0) {
        map[headers[0]!] = { action: 'field', key: 'deal_name' }
      }
      return map
    },
    [],
  )

  const onUploadSubmit = async (data: UploadSchema) => {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('campaign_id', data.campaignId)
    try {
      const res = await fetch('/api/deals/import', { method: 'POST', body: formData })
      if (res.ok) {
        const result = await res.json()
        const headers: string[] = result.headers ?? []
        setPreviewData(result.preview)
        setPreviewHeaders(headers)
        setBatchId(result.batchId)
        setSelectedCampaignId(data.campaignId)
        setColumnMapping(buildDefaultMapping(headers, fieldDefs))
        toast.success('File uploaded')
        setStep(2)
      } else {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        toast.error(err.error || 'Upload failed')
      }
    } catch {
      toast.error('Network error — please try again')
    }
  }

  // --- Validation helpers (called before confirm) ---

  function validateMappings(
    mapping: Record<string, ColumnActionInput>,
    headers: string[],
  ): string[] {
    const errors: string[] = []
    const fieldKeys = new Set<string>()
    let hasDealName = false

    for (const header of headers) {
      const action = mapping[header]

      // Check: column has no mapping selected
      if (!action) {
        errors.push(`Column "${header}" has no mapping — choose a field or drop it.`)
        continue
      }

      if (action.action === 'drop') continue

      if (action.action === 'field') {
        if (!action.key?.trim()) {
          errors.push(`Column "${header}" is mapped to a field but the key is empty.`)
          continue
        }
        if (action.key === 'deal_name') hasDealName = true
        if (fieldKeys.has(action.key)) {
          errors.push(`"${action.key}" is mapped from multiple columns`)
        }
        fieldKeys.add(action.key)
      }

      if (action.action === 'new_field') {
        if (!action.key?.trim()) {
          errors.push(`Column "${header}" is set to create a new field but the key is empty.`)
        }
        if (!action.label?.trim()) {
          errors.push(`Column "${header}" is set to create a new field but the label is empty.`)
        }
        if (action.key === 'deal_name') hasDealName = true
        if (fieldKeys.has(action.key)) {
          errors.push(`"${action.key}" is mapped from multiple columns`)
        }
        fieldKeys.add(action.key)
      }

      if (action.action === 'email_target') continue
    }

    const nonDropped = headers.filter(
      (h) => mapping[h] && mapping[h]?.action !== 'drop',
    )

    if (nonDropped.length === 0) {
      errors.push('No columns mapped — at least one column must be mapped to "deal_name".')
    } else if (!hasDealName) {
      errors.push('No column mapped to "deal_name" — at least one column must identify the deal.')
    }

    return errors
  }

  function validateEmailCells(
    previewData: Record<string, unknown>[],
    mapping: Record<string, ColumnActionInput>,
  ): { valid: boolean; totalEmails: number; invalidEmails: number; errors: string[] } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let totalEmails = 0
    let invalidEmails = 0
    const errors: string[] = []

    for (const header of Object.keys(mapping)) {
      if (mapping[header]?.action !== 'email_target') continue

      for (const row of previewData) {
        const raw = row[header]
        if (raw === undefined || raw === null || raw === '') continue

        const parts = String(raw)
          .trim()
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)

        for (const part of parts) {
          totalEmails++
          if (!emailRegex.test(part)) {
            invalidEmails++
            if (errors.length < 10) {
              errors.push(`"${part}" in column "${header}"`)
            }
          }
        }
      }
    }

    return { valid: invalidEmails === 0, totalEmails, invalidEmails, errors }
  }

  // Shared import execution — called directly when no email issues, or from dialog
  const executeImport = useCallback(async () => {
    if (!batchId || !previewData) return

    setMappingSaving(true)
    setEmailDialogOpen(false)

    // Step A: save mapping
    const mappingBody: Record<string, unknown> = { mapping: columnMapping }
    if (projectId) mappingBody.project_id = projectId
    const mappingRes = await fetch(`/api/deals/import/${batchId}/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mappingBody),
    })
    if (!mappingRes.ok) {
      const err = await mappingRes.json().catch(() => ({ error: 'Failed to save column mapping' }))
      toast.error(err.error || 'Failed to save column mapping')
      setMappingSaving(false)
      return
    }
    const mappingResult = await mappingRes.json()
    if (mappingResult.warnings?.length) {
      toast.info('Mapping saved with warnings')
    }

    // Step B: confirm import
    const res = await fetch(`/api/deals/import/${batchId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: getValues('campaignId'),
        deals: previewData,
        mapping: columnMapping,
      }),
    })
    if (res.ok) {
      toast.success('Import started')
      setStep(3)
    } else {
      const err = await res.json().catch(() => ({ error: 'Import failed' }))
      toast.error(err.error || 'Import failed')
    }
    setMappingSaving(false)
  }, [batchId, previewData, columnMapping, projectId, getValues])

  const onConfirmImport = async () => {
    if (!batchId || !previewData) return

    // --- Pre-confirm validation ---
    const mappingErrors = validateMappings(columnMapping, previewHeaders)
    if (mappingErrors.length > 0) {
      mappingErrors.forEach((err) => toast.error(err))
      return
    }

    const emailValidation = validateEmailCells(previewData, columnMapping)
    if (!emailValidation.valid) {
      setEmailValidationResult(emailValidation)
      setEmailDialogOpen(true)
      return
    }

    await executeImport()
  }

  const descText = { color: 'var(--color-text-secondary)' } as const
  const errText = { color: 'var(--color-danger-text)' } as const
  const successColor = { color: 'var(--color-success-solid)' } as const
  const errColor = { color: 'var(--color-danger-solid)' } as const

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step {step} of 3</CardTitle>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <form onSubmit={handleSubmit(onUploadSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="campaignId">Campaign</Label>
              <Controller
                name="campaignId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="campaignId">
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaignsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading campaigns...
                        </SelectItem>
                      ) : campaignsError ? (
                        <SelectItem value="error" disabled>
                          Failed to load campaigns
                        </SelectItem>
                      ) : !campaigns || campaigns.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          No campaigns — create one first
                        </SelectItem>
                      ) : (
                        campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name} — {campaign.market}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.campaignId && (
                <p className="text-sm mt-1" style={errText}>
                  {errors.campaignId.message}
                </p>
              )}
            </div>
            <Tooltip
              content={!campaignId ? 'Select a campaign first, then choose a file to upload' : ''}
              position="top"
            >
              <div>
                <Label>Excel File</Label>
                {campaignId && (
                  <p className="text-sm mb-2" style={descText}>
                    CoStar property export — .xlsx, .xls, or .csv
                  </p>
                )}
                <FileDropZone
                  accept=".xlsx,.xls,.csv"
                  disabled={!campaignId}
                  value={selectedFile}
                  onChange={(file) => setValue('file', file as File, { shouldValidate: true })}
                />
                {errors.file && (
                  <p className="text-sm mt-1" style={errText}>
                    {errors.file.message}
                  </p>
                )}
                <p className="text-sm mt-2" style={descText}>
                  Expected: CoStar property export with columns for Property Name, Address, City,
                  State, Zip, Type, Units, Year Built, etc. The system auto-detects known column
                  names and maps them to deal fields.
                </p>
              </div>
            </Tooltip>
            <Button type="submit" disabled={isSubmitting || !campaignId || !selectedFile}>
              {isSubmitting ? 'Uploading...' : 'Upload and Preview'}
            </Button>
          </form>
        )}

        {step === 2 && previewData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className="font-bold text-lg"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Review &amp; Map Columns
                </h3>
                <p className="text-sm" style={descText}>
                  {previewData.length.toLocaleString()} records found. Configure how each column
                  should be imported, then confirm.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={onConfirmImport} disabled={mappingSaving}>
                  {mappingSaving ? 'Saving...' : 'Confirm Import'}
                </Button>
              </div>
            </div>

            <ImportPreviewTable
              data={previewData}
              headers={previewHeaders}
              mapping={columnMapping}
              fieldDefs={fieldDefs}
              previousMapping={previousMapping ?? null}
              batchId={batchId!}
              onChange={(header, action) =>
                setColumnMapping((prev) => ({ ...prev, [header]: action }))
              }
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {!importStatus || importStatus.status === 'running' ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <LoadingSpinner />
                <div className="text-center">
                  <h3
                    className="font-bold text-lg"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Importing...
                  </h3>
                  <p className="text-sm" style={descText}>
                    Processing {previewData?.length.toLocaleString() ?? '?'} deals. This may take a
                    moment.
                  </p>
                </div>
              </div>
            ) : importStatus.status === 'done' ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <div className="text-4xl" style={successColor}>
                  &#10003;
                </div>
                <h3
                  className="font-bold text-lg"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Import Complete
                </h3>
                <p className="text-sm" style={descText}>
                  {importStatus.inserted?.toLocaleString() ?? 0} of{' '}
                  {importStatus.total_rows.toLocaleString()} deals imported successfully.
                  {importStatus.skipped
                    ? ` (${importStatus.skipped.toLocaleString()} duplicates skipped)`
                    : ''}
                </p>
                <div className="flex gap-2 mt-4">
                  {selectedCampaignId && (
                    <Button
                      onClick={() => router.push(`/projects/${projectId}/campaigns/${selectedCampaignId}`)}
                    >
                      Go to Campaign
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(1)
                      setPreviewData(null)
                      setPreviewHeaders([])
                      setBatchId(null)
                      setSelectedCampaignId(null)
                      setImportStatus(null)
                      setColumnMapping({})
                    }}
                  >
                    Start New Import
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <div className="text-4xl" style={errColor}>
                  &#10007;
                </div>
                <h3
                  className="font-bold text-lg"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Import Failed
                </h3>
                <p className="text-sm" style={descText}>
                  {importStatus.inserted?.toLocaleString() ?? 0} of{' '}
                  {importStatus.total_rows.toLocaleString()} deals imported before failure.
                  {importStatus.skipped
                    ? ` (${importStatus.skipped.toLocaleString()} duplicates skipped)`
                    : ''}
                </p>
                {importStatus.error_log && importStatus.error_log.length > 0 && (
                  <pre
                    className="mt-2 max-h-32 overflow-auto rounded p-2 text-xs w-full"
                    style={{
                      background: 'var(--color-danger-bg)',
                      color: 'var(--color-danger-text)',
                    }}
                  >
                    {importStatus.error_log.join('\n')}
                  </pre>
                )}
                <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>
                  Back to Upload
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

        {/* Email validation dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invalid Email Addresses Found</DialogTitle>
              <DialogDescription>
                {emailValidationResult
                  ? `${emailValidationResult.invalidEmails} of ${emailValidationResult.totalEmails} email address(es) in the uploaded data are not valid email formats.`
                  : ''}
              </DialogDescription>
            </DialogHeader>

            {emailValidationResult && emailValidationResult.errors.length > 0 && (
              <div
                className="max-h-32 overflow-auto rounded p-3 text-xs space-y-1"
                style={{
                  background: 'var(--color-surface-1)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {emailValidationResult.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
                {emailValidationResult.invalidEmails > emailValidationResult.errors.length && (
                  <div style={{ color: 'var(--color-text-tertiary)' }}>
                    …and {emailValidationResult.invalidEmails - emailValidationResult.errors.length}{' '}
                    more
                  </div>
                )}
              </div>
            )}

            <p
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Invalid email addresses will be skipped during import. Only valid emails will be
              imported and tracked for outreach.
            </p>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEmailDialogOpen(false)
                  setEmailValidationResult(null)
                }}
              >
                Cancel Import
              </Button>
              <Button onClick={executeImport}>
                Continue Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </Card>
  )
}
