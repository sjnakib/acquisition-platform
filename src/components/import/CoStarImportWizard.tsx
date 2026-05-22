'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImportPreviewTable } from '@/components/import/ImportPreviewTable'
import { useQuery } from '@tanstack/react-query'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Label } from '@/components/ui/label'
import type { ColumnActionInput } from '@/lib/validations/import.schema'

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
}

/** Auto-detect action for a header based on naming patterns. */
function detectAction(header: string, fieldDefs: FieldDef[]): ColumnActionInput {
  const h = header.toLowerCase().trim().replace(/\s+/g, ' ')

  if (/email/i.test(h)) return { action: 'email_target' }

  // Check if an existing field_definitions key matches
  const key = header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const existing = fieldDefs.find((fd) => fd.key === key)
  if (existing) return { action: 'field', key: existing.key }

  // Default: auto-create a new field definition so imported columns appear in the grid
  return { action: 'new_field', key, label: header, dataType: 'text' }
}

export function CoStarImportWizard({ projectId }: Props) {
  const [step, setStep] = useState(1)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([])
  const [batchId, setBatchId] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, ColumnActionInput>>({})
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [mappingSaving, setMappingSaving] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const { control, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } =
    useForm<UploadSchema>({ resolver: zodResolver(uploadSchema) })

  // Auto-detect mapping when preview data + fieldDefs are ready
  const buildDefaultMapping = useCallback(
    (headers: string[], defs: FieldDef[]) => {
      const map: Record<string, ColumnActionInput> = {}
      for (const h of headers) {
        map[h] = detectAction(h, defs)
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
    setServerError(null)
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
        setStep(2)
      } else {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        setServerError(err.error || 'Upload failed')
      }
    } catch {
      setServerError('Network error — please try again')
    }
  }

  const onConfirmImport = async () => {
    if (!batchId || !previewData) return
    setMappingSaving(true)
    setServerError(null)

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
      setServerError(err.error || 'Failed to save column mapping')
      setMappingSaving(false)
      return
    }
    const mappingResult = await mappingRes.json()
    if (mappingResult.warnings?.length) {
      console.warn('Column mapping warnings:', mappingResult.warnings)
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
      setStep(3)
    } else {
      const err = await res.json().catch(() => ({ error: 'Import failed' }))
      setServerError(err.error || 'Import failed')
    }
    setMappingSaving(false)
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
            <div>
              <Label htmlFor="file">Excel File</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setValue('file', file, { shouldValidate: true })
                }}
              />
              {errors.file && (
                <p className="text-sm mt-1" style={errText}>
                  {errors.file.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Upload and Preview'}
            </Button>
            {serverError && <p className="text-sm" style={errText}>{serverError}</p>}
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
            {serverError && <p className="text-sm" style={errText}>{serverError}</p>}
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
                <Button
                  variant="outline"
                  className="mt-4"
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
    </Card>
  )
}
