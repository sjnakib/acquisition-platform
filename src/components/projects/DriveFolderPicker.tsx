'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Folder, Link as LinkIcon, FolderPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface DriveFolderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSelect: (folderId: string) => Promise<void>
}

/**
 * Extracts a Google Drive folder ID from various URL formats.
 */
function extractFolderId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) {
    return input.trim()
  }
  try {
    const url = new URL(input.trim())
    const pathMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (pathMatch) return pathMatch[1]!
    const idParam = url.searchParams.get('id')
    if (idParam) return idParam
  } catch {
    // Not a URL, not a raw ID
  }
  return null
}

// Extend Window for Google Picker API
declare global {
  interface Window {
    google?: {
      picker: {
        DocsView: new (viewId?: string) => DocsView
        DocsViewMode: { LIST: string }
        ViewId: { FOLDERS: string }
        PickerBuilder: new () => PickerBuilder
      }
    }
    gapi?: {
      load: (api: string, callback: () => void) => void
      client: { setToken: (token: { access_token: string }) => void }
    }
  }
}

interface DocsView {
  setIncludeFolders: (include: boolean) => DocsView
  setSelectFolderEnabled: (enabled: boolean) => DocsView
  setParent: (parent: string) => DocsView
  setMode: (mode: string) => DocsView
}

interface PickerBuilder {
  addView: (view: DocsView) => PickerBuilder
  setOAuthToken: (token: string) => PickerBuilder
  setDeveloperKey: (key: string) => PickerBuilder
  setCallback: (fn: (data: PickerResponse) => void) => PickerBuilder
  build: () => Picker
}

interface Picker {
  setVisible: (visible: boolean) => void
  dispose: () => void
}

interface PickerResponse {
  action: string
  docs?: Array<{ id: string; name: string }>
}

export function DriveFolderPicker({ open, onOpenChange, projectId, onSelect }: DriveFolderPickerProps) {
  const [pickerLoading, setPickerLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

  // Create folder state
  const [newFolderName, setNewFolderName] = useState('')
  const scriptLoaded = useRef(false)
  const pickerRef = useRef<Picker | null>(null)

  // Reset state when dialog opens
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setManualUrl('')
      setUrlError(null)
      setNewFolderName('')
    }
  }

  // Load the Google API script once
  const loadGapi = useCallback((): Promise<void> => {
    if (scriptLoaded.current) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => {
        scriptLoaded.current = true
        resolve()
      }
      script.onerror = () => reject(new Error('Failed to load Google API'))
      document.head.appendChild(script)
    })
  }, [])

  const openPicker = useCallback(async () => {
    setPickerLoading(true)
    try {
      const tokenRes = await fetch(`/api/projects/${projectId}/drive/token`)
      if (!tokenRes.ok) {
        const json = await tokenRes.json()
        throw new Error(json.error ?? 'Failed to get access token')
      }
      const { accessToken } = await tokenRes.json()

      await loadGapi()

      // Pre-authenticate the gapi session for the Picker iframe
      await new Promise<void>((resolve) => {
        window.gapi!.load('client', () => {
          window.gapi!.client.setToken({ access_token: accessToken })
          resolve()
        })
      })

      window.gapi!.load('picker', () => {
        const google = window.google!
        // Default DocsView (not FOLDERS-only) so the native "+ New Folder" button appears.
        // setSelectFolderEnabled enables the "Select" button for any selected folder.
        // setIncludeFolders ensures folders are visible in the listing.
        const view = new google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setParent('root')
          .setMode(google.picker.DocsViewMode.LIST)

        const picker = new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setCallback(async (data: PickerResponse) => {
            if (data.action === 'picked' && data.docs?.[0]) {
              const folder = data.docs[0]
              setSaving(true)
              try {
                await onSelect(folder.id!)
                toast.success(`Working folder set to "${folder.name}"`)
                onOpenChange(false)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to set working folder')
              } finally {
                setSaving(false)
              }
            }
          })
          .build()

        pickerRef.current = picker
        picker.setVisible(true)
        setPickerLoading(false)
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open Drive Picker')
      setPickerLoading(false)
    }
  }, [projectId, onSelect, onOpenChange, loadGapi])

  // Cleanup picker on unmount
  useEffect(() => {
    return () => {
      pickerRef.current?.dispose()
    }
  }, [])

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/drive/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parentFolderId: 'root' }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to create folder')
      }
      return res.json() as Promise<{ folderId: string; name: string }>
    },
    onSuccess: async (folder) => {
      toast.success(`Folder "${folder.name}" created`)
      await onSelect(folder.folderId)
      toast.success(`Working folder set to "${newFolderName.trim()}"`)
      onOpenChange(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create folder'),
  })

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    createFolderMutation.mutate()
  }

  const handleManualSubmit = async () => {
    const folderId = extractFolderId(manualUrl)
    if (!folderId) {
      setUrlError('Invalid folder URL or ID. Paste a Google Drive folder URL or folder ID.')
      return
    }
    setUrlError(null)
    setSaving(true)
    try {
      await onSelect(folderId)
      toast.success('Working folder set')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set working folder')
    } finally {
      setSaving(false)
    }
  }

  const isBusy = pickerLoading || saving || createFolderMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-text-primary)' }}>Select Working Folder</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            All deal document folders will be created inside this folder on Google Drive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Browse existing folders */}
          <Button onClick={openPicker} disabled={isBusy} className="w-full">
            {pickerLoading ? <LoadingSpinner size="sm" /> : <Folder size={16} />}
            Browse Drive Folders
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            <span>— or create new —</span>
          </div>

          {/* Create new folder */}
          <div className="flex gap-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name (e.g. Acquire Documents)"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder() }}
              className="flex-1 h-8 text-[12px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)]"
            />
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={isBusy || !newFolderName.trim()}
              className="h-8 text-[11px]"
            >
              {createFolderMutation.isPending ? <LoadingSpinner size="sm" /> : <FolderPlus size={12} />}
              Create
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            <span>— or paste a folder link —</span>
          </div>

          {/* Manual URL input */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Input
                value={manualUrl}
                onChange={(e) => { setManualUrl(e.target.value); setUrlError(null) }}
                placeholder="https://drive.google.com/drive/folders/..."
                className="flex-1 h-8 text-[12px] bg-[var(--color-surface-1)] border-[var(--color-surface-3)]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualSubmit}
                disabled={isBusy || !manualUrl.trim()}
                className="h-8 text-[11px]"
              >
                <LinkIcon size={12} /> Set
              </Button>
            </div>
            {urlError && (
              <p className="text-[11px]" style={{ color: 'var(--color-danger-text)' }}>{urlError}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy} className="text-[12px]">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
