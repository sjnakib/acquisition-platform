'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Folder, FolderOpen, File, FileText, Image, Table2,
  MoreHorizontal, Upload, FolderPlus, RefreshCw, Check, X,
  Trash2, Pencil, ExternalLink, LayoutList, LayoutGrid,
  ChevronDown, ChevronRight, ChevronUp, FolderUp, Plus, Link, Loader2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useIsTabActive } from '@/components/ui/tabs'
import { DriveBreadcrumb, type BreadcrumbSegment } from './DriveBreadcrumb'
import { formatDate } from '@/lib/utils'
import { traverseDirectory, supportsDirectoryDrop, type TraversedFile } from '@/lib/directory-traversal'
import { UploadPanel, type UploadItem } from '@/components/shared/UploadPanel'
import { useGoogleConnection } from '@/lib/hooks/useGoogleConnection'
import { GoogleReconnectDialog } from '@/components/shared/GoogleReconnectDialog'

// ── Types ──

interface DriveFileItem {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  size: string | null
  modifiedTime: string | null
  isFolder: boolean
}

type ViewMode = 'list' | 'grid'

// ── Helpers ──

function formatFileSize(size: string | null): string {
  if (!size) return ''
  const bytes = parseInt(size, 10)
  if (isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatStorageSize(bytes: number): string {
  if (bytes <= 0) return '0 GB'
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 10 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`
}

function formatFileFolderCount(filesCount: number, foldersCount: number): string {
  const parts: string[] = []
  parts.push(`${filesCount} file${filesCount !== 1 ? 's' : ''}`)
  if (foldersCount > 0) {
    parts.push(`${foldersCount} folder${foldersCount !== 1 ? 's' : ''}`)
  }
  return parts.join(' · ')
}

// Format relative time with custom styling
function relativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return formatDate(dateStr)
  }
}

/** Sort: folders first, then alphabetically by name (case-insensitive). */
function sortFoldersFirst(items: DriveFileItem[]): DriveFileItem[] {
  return [...items].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function getFileIcon(mimeType: string, isFolder: boolean) {
  if (isFolder) return { Icon: Folder, color: 'var(--accent)' }
  if (mimeType === 'application/pdf') return { Icon: FileText, color: 'var(--color-danger-solid)' }
  if (mimeType.startsWith('image/')) return { Icon: Image, color: 'var(--color-info-solid)' }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return { Icon: Table2, color: 'var(--color-success)' }
  if (mimeType.includes('document') || mimeType.includes('word'))
    return { Icon: FileText, color: 'var(--color-info-solid)' }
  return { Icon: File, color: 'var(--color-text-tertiary)' }
}

function typeLabel(mimeType: string, isFolder: boolean): string {
  if (isFolder) return 'Folder'
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return 'Spreadsheet'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Document'
  return 'File'
}

// ── Skeleton Loader ──

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
      <div className="w-[26px] h-[26px] rounded animate-pulse" style={{ background: 'var(--color-surface-2)' }} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-1/3 rounded animate-pulse" style={{ background: 'var(--color-surface-2)' }} />
        <div className="h-2.5 w-1/5 rounded animate-pulse" style={{ background: 'var(--color-surface-2)' }} />
      </div>
    </div>
  )
}

// ── Component ──

export function DriveFileManager({ dealId, dealName }: { dealId: string; dealName: string }) {
  const isActive = useIsTabActive()

  // Data state
  const [files, setFiles] = useState<DriveFileItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [dealFolderId, setDealFolderId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [showDeleteRoomConfirm, setShowDeleteRoomConfirm] = useState(false)

  // Folder upload (webkitdirectory)
  const folderUploadInputRef = useRef<HTMLInputElement>(null)

  // Navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbSegment[]>([])

  // Tree and checklist state
  const [folderContents, setFolderContents] = useState<Record<string, DriveFileItem[]>>({})
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [loadingFolderCounts, setLoadingFolderCounts] = useState<Set<string>>(new Set())
  const loadedFolderIdsRef = useRef<Set<string>>(new Set())

  // Internal Drag-and-Drop Move state
  const [activeDropFolderId, setActiveDropFolderId] = useState<string | null>(null)
  const draggedItemRef = useRef<DriveFileItem | null>(null)

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [showDeleteSelected, setShowDeleteSelected] = useState(false)
  const deletedSelectedItemsRef = useRef<DriveFileItem[]>([])

  // Upload — managed by UploadPanel
  const [uploadPanelItems, setUploadPanelItems] = useState<UploadItem[]>([])
  const activeXhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map())
  const parentFolderMapRef = useRef<Map<string, string>>(new Map()) // itemId → parentFolderId for retry
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderFileInputRef = useRef<HTMLInputElement>(null)
  const activeUploadFolderIdRef = useRef<string | null>(null)

  // New folder dialog
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingSubfolder, setCreatingSubfolder] = useState(false)
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)

  // Drag-drop (Desktop Upload)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const dragCounter = useRef(0)
  const [dragActive, setDragActive] = useState(false)

  // Rename
  const [renameTarget, setRenameTarget] = useState<DriveFileItem | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<DriveFileItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingItemIds, setDeletingItemIds] = useState<Set<string>>(new Set())
  const deletedRef = useRef<DriveFileItem | null>(null) // for undo

  // Menu
  const [menuFile, setMenuFile] = useState<DriveFileItem | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuAnchorRef = useRef<DOMRect | null>(null)

  // View mode (list view only)
  const viewMode: ViewMode = 'list'

  // Google Drive style "+ New" menu
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)

  // Highlight newly added items
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set())

  // Focus for keyboard
  const [focusIdx, setFocusIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Background Subfolder Counting ──

  const fetchFolderChildren = useCallback(async (folderId: string) => {
    if (loadedFolderIdsRef.current.has(folderId)) return
    loadedFolderIdsRef.current.add(folderId)

    try {
      const params = new URLSearchParams({ folderId })
      const res = await fetch(`/api/deals/${dealId}/drive/files?${params}`)
      if (res.ok) {
        const data = await res.json()
        const children = sortFoldersFirst(data.files ?? [])
        setFolderContents((prev) => ({ ...prev, [folderId]: children }))

        // Recursively trigger background fetches for any discovered subfolders that aren't cached
        const subfolders = children.filter((c: DriveFileItem) => c.isFolder)
        const subfoldersToFetch = subfolders.filter((sub: DriveFileItem) => !loadedFolderIdsRef.current.has(sub.id))

        if (subfoldersToFetch.length > 0) {
          setLoadingFolderCounts((prev) => {
            const next = new Set(prev)
            subfoldersToFetch.forEach((sub: DriveFileItem) => next.add(sub.id))
            return next
          })

          subfoldersToFetch.forEach((sub: DriveFileItem) => {
            fetchFolderChildren(sub.id)
          })
        }
      } else if (await checkAuthExpired(res)) {
        return
      }
    } catch (err) {
      loadedFolderIdsRef.current.delete(folderId)
      console.error('Failed to load subfolder children:', err)
    } finally {
      setLoadingFolderCounts((prev) => {
        const next = new Set(prev)
        next.delete(folderId)
        return next
      })
    }
  }, [dealId])

  const triggerBackgroundFolderFetches = useCallback((items: DriveFileItem[]) => {
    const folders = items.filter((f) => f.isFolder)
    if (folders.length === 0) return

    const foldersToFetch = folders.filter((f) => !loadedFolderIdsRef.current.has(f.id))
    if (foldersToFetch.length === 0) return

    setLoadingFolderCounts((prev) => {
      const next = new Set(prev)
      foldersToFetch.forEach((f) => next.add(f.id))
      return next
    })

    foldersToFetch.forEach((folder) => {
      fetchFolderChildren(folder.id)
    })
  }, [fetchFolderChildren])

  // ── Sync drive metadata to deals table after file loads ──
  const syncDriveMetadata = useCallback(async (files: DriveFileItem[], folderId: string | null) => {
    try {
      const fileCount = files.filter((f) => !f.isFolder).length
      const folderUrl = folderId ? `https://drive.google.com/drive/folders/${folderId}` : null
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_file_count: fileCount,
          drive_folder_url: folderUrl,
          drive_folder_id: folderId,
        }),
      })
    } catch {
      // Non-critical — don't show error to user
    }
  }, [dealId])

  // ── Fetch (Support Soft Refreshes) ──

  const fetchFiles = useCallback(async (folderId?: string | null, isSoft = false) => {
    setSelectedFileIds(new Set())
    if (isSoft) {
      setRefreshing(true)
    } else {
      setFolderContents({})
      setExpandedFolders(new Set())
      setLoadingFolderCounts(new Set())
      loadedFolderIdsRef.current.clear()
    }
    
    try {
      const targetId = folderId ?? currentFolderId ?? dealFolderId
      if (!targetId) {
        const dealRes = await fetch(`/api/deals/${dealId}`)
        const deal = await dealRes.json()
        if (deal?.drive_folder_id) {
          setDealFolderId(deal.drive_folder_id)
          setCurrentFolderId(deal.drive_folder_id)
          
          if (!isSoft) loadedFolderIdsRef.current.clear()
          
          const params = new URLSearchParams({ folderId: deal.drive_folder_id })
          const res = await fetch(`/api/deals/${dealId}/drive/files?${params}`)
          const data = await res.json()
          if (res.ok) {
            const fetchedFiles = data.files ?? []
            setFiles(fetchedFiles)
            setDealFolderId(data.dealFolderId)
            triggerBackgroundFolderFetches(fetchedFiles)
            syncDriveMetadata(fetchedFiles, data.dealFolderId ?? null)
          } else {
            if (await checkAuthExpired(res)) return
            toast.error(data.error ?? 'Failed to load files')
          }
        } else {
          setFiles([])
          setDealFolderId(null)
        }
        return
      }

      const params = new URLSearchParams({ folderId: targetId })
      const res = await fetch(`/api/deals/${dealId}/drive/files?${params}`)
      const data = await res.json()
      if (res.ok) {
        const fetchedFiles = data.files ?? []
        setFiles(fetchedFiles)
        setDealFolderId(data.dealFolderId)
        if (!folderId) setCurrentFolderId(data.dealFolderId)
        triggerBackgroundFolderFetches(fetchedFiles)
        if (!folderId) syncDriveMetadata(fetchedFiles, data.dealFolderId ?? null)
      } else {
        if (await checkAuthExpired(res)) return
        toast.error(data.error ?? 'Failed to load files')
      }
    } catch {
      toast.error('Failed to load files')
    } finally {
      setRefreshing(false)
    }
  }, [dealId, currentFolderId, dealFolderId, triggerBackgroundFolderFetches, syncDriveMetadata])

  const { data: dealData } = useQuery<{ drive_folder_id?: string | null; project_id?: string }>({
    queryKey: ['deal', dealId, 'drive', 'folder'],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}`)
      if (!res.ok) throw new Error('Failed to fetch deal')
      return res.json()
    },
    enabled: !!dealId,
  })

  // ── Storage quota ──
  const { data: storageQuota } = useQuery<{
    limit: string; usage: string; usageInDrive: string; usageInDriveTrash: string
  }>({
    queryKey: ['drive', 'storage', dealData?.project_id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${dealData!.project_id}/drive/storage`)
      if (!res.ok) throw new Error('Failed to fetch storage quota')
      return res.json()
    },
    enabled: !!dealData?.project_id && !!dealData?.drive_folder_id,
    refetchInterval: isActive ? 60_000 : false, // only poll when tab is visible
  })

  const loading = dealData === undefined

  // ── Google auth expiry detection ──
  const projectId = dealData?.project_id
  const { status: connStatus, reconnectUrl } = useGoogleConnection(projectId)
  const [authExpired, setAuthExpired] = useState(false)
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false)

  const checkAuthExpired = async (res: Response): Promise<boolean> => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data?.error === 'google_auth_expired') {
        setAuthExpired(true)
        return true
      }
    }
    return false
  }

  // Track initial fetch so it only runs once (preserved across tab switches via keepMounted)
  const initialFetchDoneRef = useRef(false)

  useEffect(() => {
    if (!dealData || !isActive || initialFetchDoneRef.current) return
    if (dealData.drive_folder_id) {
      initialFetchDoneRef.current = true
      setDealFolderId(dealData.drive_folder_id)
      if (!currentFolderId) setCurrentFolderId(dealData.drive_folder_id!)
      loadedFolderIdsRef.current.clear()

      const params = new URLSearchParams({ folderId: dealData.drive_folder_id })
      fetch(`/api/deals/${dealId}/drive/files?${params}`)
        .then(async (res) => {
          const data = await res.json()
          if (res.ok) {
            const fetchedFiles = data.files ?? []
            setFiles(fetchedFiles)
            setDealFolderId(data.dealFolderId)
            triggerBackgroundFolderFetches(fetchedFiles)
          } else {
            if (data.error === 'google_auth_expired') {
              setAuthExpired(true)
              return
            }
            toast.error(data.error ?? 'Failed to load files')
          }
        })
        .catch(() => toast.error('Failed to load files'))
    } else {
      setFiles([])
      setDealFolderId(null)
    }
  }, [dealData, dealId, isActive, triggerBackgroundFolderFetches])

  // Selection helpers moved below computed list rows to avoid TDZ issues

  // ── Deal folder ──

  const createDealFolder = async () => {
    setCreatingFolder(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/drive`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setDealFolderId(data.drive_folder_id)
        setCurrentFolderId(data.drive_folder_id)
        toast.success('Deal room created')
        await fetchFiles(data.drive_folder_id)
      } else {
        if (await checkAuthExpired(res)) return
        toast.error(data.error ?? 'Failed to create deal room')
      }
    } catch {
      toast.error('Failed to create deal room')
    } finally {
      setCreatingFolder(false)
    }
  }

  const deleteDealFolder = async () => {
    setDeletingFolder(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/drive`, { method: 'DELETE' })
      if (res.ok) {
        setDealFolderId(null)
        setCurrentFolderId(null)
        setFiles([])
        setBreadcrumb([])
        setFolderContents({})
        setExpandedFolders(new Set())
        toast.success('Deal room deleted')
      } else {
        const data = await res.json().catch(() => ({}))
        if (data.error === 'google_auth_expired') { setAuthExpired(true); return }
        toast.error(data.error ?? 'Failed to delete deal room')
      }
    } catch {
      toast.error('Failed to delete deal room')
    } finally {
      setDeletingFolder(false)
      setShowDeleteRoomConfirm(false)
    }
  }

  // ── Retry a single file upload (used by cancel/retry callbacks) ──────────

  const retrySingleFile = useCallback(
    (file: File, itemId: string, parentFolderId: string | null) => {
      const targetFolderId = parentFolderId ?? currentFolderId ?? dealFolderId
      if (!targetFolderId) {
        setUploadPanelItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, status: 'error', errorMessage: 'No target folder' }
              : item,
          ),
        )
        return
      }

      const markItem = (update: Partial<UploadItem>) => {
        setUploadPanelItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, ...update } : item)),
        )
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('folderId', targetFolderId)

      const xhr = new XMLHttpRequest()
      activeXhrMapRef.current.set(itemId, xhr)
      xhr.open('POST', `/api/deals/${dealId}/drive/files`)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          markItem({ progress: Math.round((event.loaded / event.total) * 100) })
        }
      }

      xhr.onload = () => {
        activeXhrMapRef.current.delete(itemId)
        if (xhr.status >= 200 && xhr.status < 300) {
          markItem({ progress: 100, status: 'completed' })
        } else {
          let errorMsg = 'Upload failed'
          try {
            const d = JSON.parse(xhr.responseText)
            errorMsg = d.error ?? errorMsg
          } catch {}
          markItem({ status: 'error', errorMessage: errorMsg })
        }
      }

      xhr.onerror = () => {
        activeXhrMapRef.current.delete(itemId)
        markItem({ status: 'error', errorMessage: 'Network error' })
      }

      xhr.send(formData)
    },
    [dealId, currentFolderId, dealFolderId],
  )

  // ── Shared folder-upload pipeline (webkitdirectory + drag-drop) ──────────

  const processFolderStructure = async (
    filesWithPaths: TraversedFile[],
    emptyFolderPaths: string[],
    rootFolderId: string,
  ) => {
    // ── Parse folder structure from relative paths ────────────────────────
    const folderPaths = new Set<string>()

    for (const f of filesWithPaths) {
      const parts = f.relativePath.split('/')
      for (let i = 0; i < parts.length - 1; i++) {
        folderPaths.add(parts.slice(0, i + 1).join('/'))
      }
    }

    // Merge explicitly-empty folders (from drag-drop traversal)
    for (const emptyPath of emptyFolderPaths) {
      folderPaths.add(emptyPath)
    }

    const sortedFolders = [...folderPaths].sort(
      (a, b) => a.split('/').length - b.split('/').length,
    )

    // ── Build UploadPanel items for folder creation ───────────────────────
    const folderItems: UploadItem[] = sortedFolders.map((path, i) => ({
      id: `folder-${Date.now()}-${i}`,
      name: path.split('/').pop()!,
      relativePath: path,
      progress: 0,
      status: 'uploading' as const,
      isFolderCreation: true,
    }))

    const fileItems: UploadItem[] = filesWithPaths.map((f, i) => ({
      id: `file-${Date.now()}-${i}`,
      name: f.file.name,
      relativePath: f.relativePath,
      size: f.file.size,
      file: f.file,
      progress: 0,
      status: 'uploading' as const,
    }))

    setUploadPanelItems((prev) => [...prev, ...folderItems, ...fileItems])

    const markItem = (id: string, update: Partial<UploadItem>) => {
      setUploadPanelItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...update } : item)),
      )
    }

    try {
      // ── Batch-create all folders (single round-trip) ────────────────────
      const folderIdMap = new Map<string, string>()

      if (sortedFolders.length > 0) {
        const foldersPayload = sortedFolders.map((path) => {
          const parts = path.split('/')
          const name = parts[parts.length - 1]!
          const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
          return { name, parentPath }
        })

        const res = await fetch(`/api/deals/${dealId}/drive/folders/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folders: foldersPayload, parentFolderId: rootFolderId }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (data.error === 'google_auth_expired') { setAuthExpired(true); return }
          throw new Error(data.error ?? 'Batch folder creation failed')
        }

        const data = await res.json() as { folders: Record<string, string> }
        for (const [path, folderId] of Object.entries(data.folders)) {
          folderIdMap.set(path, folderId)
          setNewlyAddedIds((prev) => {
            const next = new Set(prev)
            next.add(folderId)
            return next
          })
          setTimeout(() => {
            setNewlyAddedIds((prev) => {
              const next = new Set(prev)
              next.delete(folderId)
              return next
            })
          }, 4000)
        }

        // Mark all folder items as completed
        for (const item of folderItems) {
          markItem(item.id, { progress: 100, status: 'completed' })
        }
      }

      // ── Group files by their parent folder ────────────────────────────────
      const filesByParent = new Map<string, File[]>()

      for (const f of filesWithPaths) {
        const parts = f.relativePath.split('/')
        const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null
        const parentId = folderPath ? folderIdMap.get(folderPath)! : rootFolderId

        const batch = filesByParent.get(parentId)
        if (batch) {
          batch.push(f.file)
        } else {
          filesByParent.set(parentId, [f.file])
        }
      }

      // ── Filter out files that already exist in their target folders ──────
      const skippedNames: string[] = []
      const filteredPaths: TraversedFile[] = []
      const filteredFileItems: UploadItem[] = []

      for (let i = 0; i < filesWithPaths.length; i++) {
        const f = filesWithPaths[i]!
        const parts = f.relativePath.split('/')
        const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null
        const parentId = folderPath ? folderIdMap.get(folderPath)! : rootFolderId
        const isRootFolder = parentId === rootFolderId
        const targetContents = isRootFolder ? files : (folderContents[parentId] ?? [])
        const alreadyExists = targetContents.some(
          (existing) => existing.name.toLowerCase() === f.file.name.toLowerCase(),
        )

        if (alreadyExists) {
          skippedNames.push(f.file.name)
        } else {
          filteredPaths.push(f)
          filteredFileItems.push(fileItems[i]!)
        }
      }

      // Remove skipped items from the panel
      if (skippedNames.length > 0) {
        const skippedSet = new Set(skippedNames.map((n) => n.toLowerCase()))
        setUploadPanelItems((prev) =>
          prev.filter(
            (item) =>
              !(item.status === 'uploading' && skippedSet.has(item.name.toLowerCase())),
          ),
        )
        toast.warning(
          skippedNames.length === 1
            ? `"${skippedNames[0]}" already exists — skipped`
            : `${skippedNames.length} file(s) already exist — skipped`,
        )
      }
      if (filteredPaths.length === 0) {
        setUploadPanelItems((prev) =>
          prev.filter((item) => !(item.status === 'uploading' && item.isFolderCreation)),
        )
        fetchFiles()
        return
      }

      // ── Upload all files with global concurrency semaphore ─────────────────
      const CONCURRENCY = 6
      const totalFiles = filteredPaths.length

      // Build work queue by zipping filteredPaths with their pre-created UploadItems.
      interface WorkItem {
        file: File
        parentId: string
        itemId: string
      }
      const queue: WorkItem[] = []
      for (let i = 0; i < filteredPaths.length; i++) {
        const f = filteredPaths[i]!
        const item = filteredFileItems[i]!
        if (!item) continue
        const parts = f.relativePath.split('/')
        const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null
        const parentId = folderPath ? folderIdMap.get(folderPath)! : rootFolderId
        parentFolderMapRef.current.set(item.id, parentId)
        queue.push({ file: f.file, parentId, itemId: item.id })
      }

      let inFlight = 0
      let failures = 0

      const uploadSingle = (work: WorkItem): Promise<boolean> => {
        return new Promise((resolve) => {
          const formData = new FormData()
          formData.append('file', work.file)
          formData.append('folderId', work.parentId)

          const xhr = new XMLHttpRequest()
          activeXhrMapRef.current.set(work.itemId, xhr)
          xhr.open('POST', `/api/deals/${dealId}/drive/files`)

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const pct = Math.round((event.loaded / event.total) * 100)
              markItem(work.itemId, { progress: pct })
            }
          }

          xhr.onload = () => {
            activeXhrMapRef.current.delete(work.itemId)
            if (xhr.status >= 200 && xhr.status < 300) {
              markItem(work.itemId, { progress: 100, status: 'completed' })
              try {
                const d = JSON.parse(xhr.responseText)
                if (d.file?.id) {
                  const fileId = d.file.id
                  setNewlyAddedIds((prev) => {
                    const next = new Set(prev)
                    next.add(fileId)
                    return next
                  })
                  setTimeout(() => {
                    setNewlyAddedIds((prev) => {
                      const next = new Set(prev)
                      next.delete(fileId)
                      return next
                    })
                  }, 4000)
                }
              } catch {}
              resolve(true)
            } else {
              let errorMsg = 'Upload failed'
              try {
                const d = JSON.parse(xhr.responseText)
                errorMsg = d.error ?? errorMsg
              } catch {}
              markItem(work.itemId, { status: 'error', errorMessage: errorMsg })
              failures++
              resolve(false)
            }
          }

          xhr.onerror = () => {
            activeXhrMapRef.current.delete(work.itemId)
            markItem(work.itemId, { status: 'error', errorMessage: 'Network error' })
            failures++
            resolve(false)
          }

          xhr.send(formData)
        })
      }

      await new Promise<void>((resolve) => {
        const processNext = () => {
          while (inFlight < CONCURRENCY && queue.length > 0) {
            const work = queue.shift()!
            inFlight++
            uploadSingle(work).then(() => {
              inFlight--
              if (queue.length === 0 && inFlight === 0) {
                resolve()
              } else {
                processNext()
              }
            })
          }
          if (queue.length === 0 && inFlight === 0) {
            resolve()
          }
        }
        processNext()
      })

      if (failures > 0) {
        toast.warning(`Uploaded ${totalFiles - failures} / ${totalFiles} files. ${failures} failed.`)
      } else if (totalFiles > 0) {
        toast.success(
          `Uploaded ${totalFiles} file${totalFiles !== 1 ? 's' : ''} in ${sortedFolders.length} folder${sortedFolders.length !== 1 ? 's' : ''}`,
        )
      } else if (sortedFolders.length > 0) {
        toast.success(`Created ${sortedFolders.length} folder${sortedFolders.length !== 1 ? 's' : ''}`)
      }
      fetchFiles()
    } catch (err) {
      // Mark all in-progress items as error
      setUploadPanelItems((prev) =>
        prev.map((item) =>
          item.status === 'uploading'
            ? { ...item, status: 'error' as const, errorMessage: err instanceof Error ? err.message : 'Failed' }
            : item,
        ),
      )
      toast.error(err instanceof Error ? err.message : 'Folder upload failed')
    }
  }

  // ── Folder upload (webkitdirectory) ──────────────────────────────────────

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) {
      toast.error('No files found. To create an empty folder, use the New Folder button.', { duration: 5000 })
      if (folderUploadInputRef.current) folderUploadInputRef.current.value = ''
      return
    }

    const targetFolderId = currentFolderId ?? dealFolderId
    if (!targetFolderId) {
      toast.error('No deal room. Create one first.')
      if (folderUploadInputRef.current) folderUploadInputRef.current.value = ''
      return
    }

    const allFiles = Array.from(fileList)
    const filesWithPaths: TraversedFile[] = allFiles.map((file) => ({
      relativePath: file.webkitRelativePath,
      file,
    }))

    // webkitdirectory only surfaces files — empty folders cannot be detected
    const emptyFolderPaths: string[] = []

    if (folderUploadInputRef.current) folderUploadInputRef.current.value = ''
    await processFolderStructure(filesWithPaths, emptyFolderPaths, targetFolderId)
  }

  // ── Navigation (Soft Loader Enabled) ──

  const navigateTo = (folderId: string, folderName: string) => {
    setBreadcrumb((prev) => [...prev, { id: folderId, name: folderName }])
    setCurrentFolderId(folderId)
    setFocusIdx(-1)
    fetchFiles(folderId, true) // soft refresh!
  }

  const navigateBreadcrumb = (segment: BreadcrumbSegment | null) => {
    setFocusIdx(-1)
    if (segment === null) {
      setBreadcrumb([])
      setCurrentFolderId(dealFolderId)
      fetchFiles(dealFolderId, true) // soft refresh!
    } else {
      const idx = breadcrumb.findIndex((s) => s.id === segment.id)
      setBreadcrumb((prev) => prev.slice(0, idx + 1))
      setCurrentFolderId(segment.id)
      fetchFiles(segment.id, true) // soft refresh!
    }
  }

  const navigateUp = () => {
    if (breadcrumb.length === 0) return
    const last = breadcrumb[breadcrumb.length - 1]
    if (last) {
      setBreadcrumb((prev) => prev.slice(0, -1))
      setCurrentFolderId(last.id)
      setFocusIdx(-1)
      fetchFiles(last.id, true) // soft refresh!
    }
  }

  // ── Tree Expansion ──

  const toggleFolderExpanded = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
        if (!folderContents[folderId]) {
          fetchFolderChildren(folderId)
        }
      }
      return next
    })
  }

  // ── Internal File Moving (Drag & Drop) ──

  const handleDragStart = (e: React.DragEvent, item: DriveFileItem) => {
    draggedItemRef.current = item
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-internal-move', item.id)
    e.dataTransfer.setData('text/plain', item.id)
  }

  const handleDragEnd = () => {
    draggedItemRef.current = null
    setActiveDropFolderId(null)
  }

  const handleDragOverFolder = (e: React.DragEvent, folder: DriveFileItem) => {
    const isInternal = e.dataTransfer.types.includes('application/x-internal-move')
    const isExternal = e.dataTransfer.types.includes('Files')
    if (!isInternal && !isExternal) return
    if (isInternal && draggedItemRef.current?.id === folder.id) return
    
    e.preventDefault()
    e.stopPropagation()
    if (isExternal) {
      e.dataTransfer.dropEffect = 'copy'
    }
    if (activeDropFolderId !== folder.id) {
      setActiveDropFolderId(folder.id)
    }
  }

  const handleDragLeaveFolder = (e: React.DragEvent, folder: DriveFileItem) => {
    e.preventDefault()
    e.stopPropagation()
    if (activeDropFolderId === folder.id) {
      setActiveDropFolderId(null)
    }
  }

  const handleDropOnFolder = async (e: React.DragEvent, folder: DriveFileItem) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveDropFolderId(null)
    // Reset drag overlay state — main onDrop is prevented by stopPropagation above
    dragCounter.current = 0
    setDragActive(false)

    const isInternal = e.dataTransfer.types.includes('application/x-internal-move')
    if (isInternal) {
      const draggedId = e.dataTransfer.getData('application/x-internal-move') || draggedItemRef.current?.id
      if (!draggedId || draggedId === folder.id) return

      const draggedItem = draggedItemRef.current
      if (!draggedItem) return

      // Check for name collision in the destination folder
      const destContents = folderContents[folder.id] ?? []
      const nameCollision = destContents.some(
        (f) => f.name.toLowerCase() === draggedItem.name.toLowerCase(),
      )
      if (nameCollision) {
        toast.warning(
          `"${draggedItem.name}" already exists in "${folder.name}" — move cancelled`,
        )
        return
      }

      const previousFiles = files
      const previousContents = folderContents

      // Optimistic UI updates
      if (files.some((f) => f.id === draggedId)) {
        setFiles((prev) => prev.filter((f) => f.id !== draggedId))
        setFolderContents((prev) => {
          const currentChildren = prev[folder.id] ?? []
          if (currentChildren.some((c) => c.id === draggedId)) return prev
          return {
            ...prev,
            [folder.id]: [...currentChildren, draggedItem],
          }
        })
      } else {
        let oldParentId: string | undefined
        Object.keys(folderContents).forEach((pId) => {
          if (folderContents[pId]?.some((c) => c.id === draggedId)) {
            oldParentId = pId
          }
        })

        if (oldParentId && oldParentId !== folder.id) {
          setFolderContents((prev) => {
            const nextContents = { ...prev }
            nextContents[oldParentId!] = nextContents[oldParentId!]?.filter((c) => c.id !== draggedId) ?? []
            nextContents[folder.id] = [...(nextContents[folder.id] ?? []), draggedItem]
            return nextContents
          })
        }
      }

      const loadingToastId = toast.loading(`Moving "${draggedItem.name}" to "${folder.name}"...`)

      try {
        const res = await fetch(`/api/deals/${dealId}/drive/files`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: draggedId, newParentFolderId: folder.id }),
        })

        toast.dismiss(loadingToastId)

        if (res.ok) {
          toast.success(`Moved "${draggedItem.name}" to "${folder.name}"`)
          fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh
        } else {
          setFiles(previousFiles)
          setFolderContents(previousContents)
          const data = await res.json()
          if (data.error === 'google_auth_expired') { setAuthExpired(true); return }
          toast.error(data.error ?? 'Failed to move item')
        }
      } catch {
        toast.dismiss(loadingToastId)
        setFiles(previousFiles)
        setFolderContents(previousContents)
        toast.error('Failed to move item')
      }
    } else {
      // External file dropped onto subfolder!
      if (supportsDirectoryDrop() && e.dataTransfer.items.length > 0) {
        let hasDirectory = false
        const entries: { entry: FileSystemEntry; item: DataTransferItem }[] = []

        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i]!
          const entry = item.webkitGetAsEntry()
          if (entry) {
            entries.push({ entry, item })
            if (entry.isDirectory) hasDirectory = true
          }
        }

        if (hasDirectory) {
          const allFiles: TraversedFile[] = []
          const allEmptyFolders: string[] = []

          for (const { entry } of entries) {
            if (entry.isDirectory) {
              const result = await traverseDirectory(
                entry as FileSystemDirectoryEntry,
                entry.name,
              )
              allFiles.push(...result.files)
              allEmptyFolders.push(...result.emptyFolderPaths)
            } else if (entry.isFile) {
              const fileEntry = entry as FileSystemFileEntry
              const file = await new Promise<File>((resolve, reject) => {
                fileEntry.file(resolve, reject)
              })
              allFiles.push({ relativePath: entry.name, file })
            }
          }

          if (allFiles.length > 0 || allEmptyFolders.length > 0) {
            await processFolderStructure(allFiles, allEmptyFolders, folder.id)
          }
          return
        }
      }

      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files, folder.id)
      }
    }
  }

  // ── Upload (Parallel & Granular Progress) ──

  const handleUpload = async (fileList: FileList | File[], folderIdOverride?: string) => {
    const fileArr = Array.from(fileList)
    if (fileArr.length === 0) return

    const targetFolderId = folderIdOverride ?? currentFolderId ?? dealFolderId
    if (!targetFolderId) {
      toast.error('No folder target resolved for upload')
      return
    }

    // Resolve existing names in the target folder
    const isTargetCurrent = targetFolderId === (currentFolderId ?? dealFolderId)
    const targetContents = isTargetCurrent ? files : (folderContents[targetFolderId] ?? [])
    const existingNames = new Set(targetContents.map((f) => f.name.toLowerCase()))

    // Filter out files that already exist in the target folder
    const duplicates: string[] = []
    const filteredFiles = fileArr.filter((f) => {
      if (existingNames.has(f.name.toLowerCase())) {
        duplicates.push(f.name)
        return false
      }
      return true
    })

    if (duplicates.length > 0) {
      toast.warning(
        duplicates.length === 1
          ? `"${duplicates[0]}" already exists in this folder — skipped`
          : `${duplicates.length} file(s) already exist in this folder — skipped`,
      )
    }
    if (filteredFiles.length === 0) return

    // Register items in the UploadPanel
    const newItems: UploadItem[] = filteredFiles.map((f, i) => ({
      id: `flat-${Date.now()}-${i}`,
      name: f.name,
      size: f.size,
      file: f,
      progress: 0,
      status: 'uploading' as const,
    }))
    setUploadPanelItems((prev) => [...prev, ...newItems])

    const markItem = (id: string, update: Partial<UploadItem>) => {
      setUploadPanelItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...update } : item)),
      )
    }

    // Upload with concurrency-limited semaphore
    const CONCURRENCY = 6
    const queue = filteredFiles.map((file, i) => ({ file, itemId: newItems[i]!.id }))
    let inFlight = 0
    let failures = 0

    const uploadSingle = (file: File, itemId: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folderId', targetFolderId)

        const xhr = new XMLHttpRequest()
        activeXhrMapRef.current.set(itemId, xhr)
        xhr.open('POST', `/api/deals/${dealId}/drive/files`)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100)
            markItem(itemId, { progress: pct })
          }
        }

        xhr.onload = () => {
          activeXhrMapRef.current.delete(itemId)
          if (xhr.status >= 200 && xhr.status < 300) {
            markItem(itemId, { progress: 100, status: 'completed' })
            try {
              const d = JSON.parse(xhr.responseText)
              if (d.file?.id) {
                const fileId = d.file.id
                setNewlyAddedIds((prev) => {
                  const next = new Set(prev)
                  next.add(fileId)
                  return next
                })
                setTimeout(() => {
                  setNewlyAddedIds((prev) => {
                    const next = new Set(prev)
                    next.delete(fileId)
                    return next
                  })
                }, 4000)
              }
            } catch {}
            resolve(true)
          } else {
            let errorMsg = 'Upload failed'
            try {
              const d = JSON.parse(xhr.responseText)
              errorMsg = d.error ?? errorMsg
            } catch {}
            markItem(itemId, { status: 'error', errorMessage: errorMsg })
            failures++
            resolve(false)
          }
        }

        xhr.onerror = () => {
          activeXhrMapRef.current.delete(itemId)
          markItem(itemId, { status: 'error', errorMessage: 'Network error' })
          failures++
          resolve(false)
        }

        xhr.send(formData)
      })
    }

    await new Promise<void>((resolve) => {
      const processNext = () => {
        while (inFlight < CONCURRENCY && queue.length > 0) {
          const work = queue.shift()!
          inFlight++
          uploadSingle(work.file, work.itemId).then(() => {
            inFlight--
            if (queue.length === 0 && inFlight === 0) {
              resolve()
            } else {
              processNext()
            }
          })
        }
        if (queue.length === 0 && inFlight === 0) {
          resolve()
        }
      }
      processNext()
    })

    const successCount = filteredFiles.length - failures
    if (failures > 0) {
      toast.warning(`${successCount} / ${filteredFiles.length} file(s) uploaded. ${failures} failed.`)
    } else if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully`)
    }
    fetchFiles(currentFolderId ?? dealFolderId, true)
  }

  // Helper to trigger upload picker on a folder
  const triggerFolderUpload = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    activeUploadFolderIdRef.current = folderId
    folderFileInputRef.current?.click()
  }

  // Helper to trigger dialog for folder creation inside folders
  const triggerCreateSubfolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setNewFolderParentId(folderId)
    setShowNewFolder(true)
  }

  const closeNewFolderDialog = () => {
    setShowNewFolder(false)
    setNewFolderName('')
    setNewFolderParentId(null)
  }

  // Resolve subfolder parent name inside dialog description
  const parentFolderItem = useMemo(() => {
    if (!newFolderParentId) return null
    let found = files.find((f) => f.id === newFolderParentId) || null
    if (!found) {
      Object.keys(folderContents).forEach((pId) => {
        const child = folderContents[pId]?.find((c) => c.id === newFolderParentId)
        if (child) found = child
      })
    }
    return found
  }, [newFolderParentId, files, folderContents])

  // ── Drag-drop (Desktop Upload) ──

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    // Ignore internal move drags
    if (e.dataTransfer.types.includes('application/x-internal-move')) return

    dragCounter.current++
    if (dragCounter.current === 1) setDragActive(true)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.dataTransfer.types.includes('application/x-internal-move')) {
      e.dataTransfer.dropEffect = 'none'
    }
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setDragActive(false)
  }, [])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current = 0
    setDragActive(false)

    // Ignore internal move drops (handled by per-item drop handlers)
    if (e.dataTransfer.types.includes('application/x-internal-move')) return

    const targetFolderId = currentFolderId ?? dealFolderId
    if (!targetFolderId) {
      toast.error('No deal room. Create one first.')
      return
    }

    // Attempt directory-aware drop via webkitGetAsEntry
    if (supportsDirectoryDrop() && e.dataTransfer.items.length > 0) {
      let hasDirectory = false
      const entries: { entry: FileSystemEntry; item: DataTransferItem }[] = []

      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i]!
        const entry = item.webkitGetAsEntry()
        if (entry) {
          entries.push({ entry, item })
          if (entry.isDirectory) hasDirectory = true
        }
      }

      if (hasDirectory) {
        const allFiles: TraversedFile[] = []
        const allEmptyFolders: string[] = []

        for (const { entry } of entries) {
          if (entry.isDirectory) {
            const result = await traverseDirectory(
              entry as FileSystemDirectoryEntry,
              entry.name,
            )
            allFiles.push(...result.files)
            allEmptyFolders.push(...result.emptyFolderPaths)
          } else if (entry.isFile) {
            // Standalone file in the drop — add relativePath = just the name
            const fileEntry = entry as FileSystemFileEntry
            const file = await new Promise<File>((resolve, reject) => {
              fileEntry.file(resolve, reject)
            })
            allFiles.push({ relativePath: entry.name, file })
          }
        }

        if (allFiles.length > 0 || allEmptyFolders.length > 0) {
          await processFolderStructure(allFiles, allEmptyFolders, targetFolderId)
        }
        return
      }
    }

    // Fallback: flat file upload (no directory entries found or API unavailable)
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, dealFolderId, dealId])

  // ── Folder ──

  const createSubfolder = async () => {
    if (!newFolderName.trim()) return
    setCreatingSubfolder(true)
    
    const parentFolderId = newFolderParentId ?? currentFolderId ?? dealFolderId
    if (!parentFolderId) {
      toast.error('Parent folder target not resolved')
      setCreatingSubfolder(false)
      return
    }

    // Check for existing folder with the same name
    const parentIsCurrent = parentFolderId === (currentFolderId ?? dealFolderId)
    const siblings = parentIsCurrent ? files : (folderContents[parentFolderId] ?? [])
    const nameExists = siblings.some(
      (f) => f.isFolder && f.name.toLowerCase() === newFolderName.trim().toLowerCase(),
    )
    if (nameExists) {
      toast.warning(`A folder named "${newFolderName.trim()}" already exists here`)
      setCreatingSubfolder(false)
      return
    }

    try {
      const res = await fetch(`/api/deals/${dealId}/drive/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parentFolderId }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Folder "${newFolderName.trim()}" created`)
        closeNewFolderDialog()
        if (data.id) {
          const folderId = data.id
          setNewlyAddedIds((prev) => {
            const next = new Set(prev)
            next.add(folderId)
            return next
          })
          setTimeout(() => {
            setNewlyAddedIds((prev) => {
              const next = new Set(prev)
              next.delete(folderId)
              return next
            })
          }, 4000)
        }
        // If parent folder differs from current view, invalidate its cached children
        // so the tree view re-fetches when the user expands/navigates to it.
        if (parentFolderId && parentFolderId !== (currentFolderId ?? dealFolderId)) {
          loadedFolderIdsRef.current.delete(parentFolderId)
          setFolderContents((prev) => {
            const next = { ...prev }
            delete next[parentFolderId]
            return next
          })
        }
        fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh
      } else {
        const data = await res.json()
        if (data.error === 'google_auth_expired') { setAuthExpired(true); return }
        toast.error(data.error ?? 'Failed to create folder')
      }
    } catch {
      toast.error('Failed to create folder')
    } finally {
      setCreatingSubfolder(false)
    }
  }

  // ── Rename (optimistic) ──

  const startRename = (file: DriveFileItem) => {
    setRenameTarget(file)
    setRenameValue(file.name)
    setMenuFile(null)
  }

  const confirmRename = async () => {
    if (!renameTarget) return
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === renameTarget.name) { setRenameTarget(null); return }

    // Check for name collision in the same folder
    const isInRoot = files.some((f) => f.id === renameTarget.id)
    const siblings = isInRoot
      ? files
      : Object.values(folderContents).find((items) =>
          items.some((c) => c.id === renameTarget.id),
        ) ?? []
    const nameCollision = siblings.some(
      (f) => f.id !== renameTarget.id && f.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (nameCollision) {
      toast.warning(`"${trimmed}" already exists in this folder — rename cancelled`)
      setRenameTarget(null)
      return
    }

    // Optimistic update
    const previous = files
    setFiles((prev) => prev.map((f) => f.id === renameTarget.id ? { ...f, name: trimmed } : f))
    setRenameTarget(null)
    setRenaming(true)

    try {
      const res = await fetch(`/api/deals/${dealId}/drive/files`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: renameTarget.id, name: trimmed }),
      })
      if (res.ok) {
        toast.success(`Renamed to "${trimmed}"`)
        fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh to sync
      } else {
        setFiles(previous)
        const data = await res.json()
        if (data.error === 'google_auth_expired') { setAuthExpired(true); return }
        toast.error(data.error ?? 'Failed to rename')
      }
    } catch {
      setFiles(previous)
      toast.error('Failed to rename')
    } finally {
      setRenaming(false)
    }
  }

  // ── Delete (optimistic with Server-Side Undo) ──

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    const previous = files
    setDeleteTarget(null)
    deletedRef.current = target

    // Mark as animating out — add red flash + scale-down animation
    setDeletingItemIds((prev) => new Set(prev).add(target.id))
    setDeleting(true)

    // Wait for animation to play (350ms), then remove from state + call API
    await new Promise((r) => setTimeout(r, 360))

    setFiles((prev) => prev.filter((f) => f.id !== target.id))
    setDeletingItemIds((prev) => {
      const next = new Set(prev)
      next.delete(target.id)
      return next
    })

    try {
      const res = await fetch(`/api/deals/${dealId}/drive/files?fileId=${target.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`"${target.name}" moved to trash`, {
          action: {
            label: 'Undo',
            onClick: () => undoDelete(),
          },
        })
        // No soft refresh — optimistic removal is correct.
        // Google Drive eventual consistency can briefly return trashed files
        // in a listing, which would undo the optimistic removal.
      } else {
        setFiles(previous)
        const data = await res.json()
        if (data.error === 'google_auth_expired') { setAuthExpired(true); return }
        toast.error(data.error ?? 'Failed to delete')
      }
    } catch {
      setFiles(previous)
      toast.error('Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  const undoDelete = async () => {
    if (!deletedRef.current) return
    const target = deletedRef.current

    // Check for name collision before restoring
    const nameCollision = files.some(
      (f) => f.id !== target.id && f.name.toLowerCase() === target.name.toLowerCase(),
    )
    if (nameCollision) {
      toast.warning(`"${target.name}" already exists in this folder — cannot restore`)
      deletedRef.current = null
      return
    }

    // Put back in files list optimistically
    setFiles((prev) => {
      const exists = prev.find((f) => f.id === target.id)
      return exists ? prev : [...prev, target]
    })
    
    const loadingToastId = toast.loading(`Restoring "${target.name}"...`)
    
    try {
      const res = await fetch(`/api/deals/${dealId}/drive/files`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: target.id, trashed: false }),
      })
      
      toast.dismiss(loadingToastId)
      
      if (res.ok) {
        toast.success(`"${target.name}" restored successfully`)
        deletedRef.current = null
        fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh
      } else {
        // Rollback
        setFiles((prev) => prev.filter((f) => f.id !== target.id))
        const data = await res.json()
        toast.error(data.error ?? `Failed to restore file`)
      }
    } catch {
      toast.dismiss(loadingToastId)
      setFiles((prev) => prev.filter((f) => f.id !== target.id))
      toast.error(`Failed to restore file`)
    }
  }

  const confirmDeleteSelected = async () => {
    if (selectedFileIds.size === 0) return
    const idsToDelete = Array.from(selectedFileIds)

    // Find files currently shown that are being deleted (for optimistic updates and undo)
    const targets = selectableItems.filter((f) => selectedFileIds.has(f.id))
    deletedSelectedItemsRef.current = targets

    const previousFiles = files
    const previousFolderContents = folderContents

    // Mark all as animating out
    setDeletingItemIds((prev) => {
      const next = new Set(prev)
      idsToDelete.forEach((id) => next.add(id))
      return next
    })
    setSelectedFileIds(new Set())
    setShowDeleteSelected(false)
    setDeletingSelected(true)

    // Wait for animation to play
    await new Promise((r) => setTimeout(r, 360))

    // Remove from state after animation — use cached idsToDelete, not selectedFileIds (already cleared)
    const deleteSet = new Set(idsToDelete)
    setFiles((prev) => prev.filter((f) => !deleteSet.has(f.id)))
    setFolderContents((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((key) => {
        const val = next[key]
        if (val) {
          next[key] = val.filter((f) => !deleteSet.has(f.id))
        }
      })
      return next
    })
    setDeletingItemIds((prev) => {
      const next = new Set(prev)
      idsToDelete.forEach((id) => next.delete(id))
      return next
    })

    try {
      const res = await fetch(`/api/deals/${dealId}/drive/files?fileIds=${idsToDelete.join(',')}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`${targets.length} item(s) moved to trash`, {
          action: {
            label: 'Undo',
            onClick: () => undoDeleteSelected(),
          },
        })
        // No soft refresh — optimistic removal is correct (see confirmDelete)
      } else {
        setFiles(previousFiles)
        setFolderContents(previousFolderContents)
        const data = await res.json()
        if (data.error === 'google_auth_expired') { setAuthExpired(true); return }
        toast.error(data.error ?? 'Failed to delete selected items')
      }
    } catch {
      setFiles(previousFiles)
      setFolderContents(previousFolderContents)
      toast.error('Failed to delete selected items')
    } finally {
      setDeletingSelected(false)
    }
  }

  const undoDeleteSelected = async () => {
    const targets = deletedSelectedItemsRef.current
    if (targets.length === 0) return
    const idsToRestore = targets.map((f) => f.id)

    // Check for name collisions
    const existingNames = new Set(files.map((f) => f.name.toLowerCase()))
    const colliding = targets.filter((t) => existingNames.has(t.name.toLowerCase()))
    if (colliding.length > 0) {
      toast.warning(
        colliding.length === 1
          ? `"${colliding[0]!.name}" already exists — cannot restore`
          : `${colliding.length} item(s) already exist — cannot restore`,
      )
      deletedSelectedItemsRef.current = []
      return
    }

    const loadingToastId = toast.loading(`Restoring ${targets.length} item(s)...`)

    try {
      const res = await fetch(`/api/deals/${dealId}/drive/files`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: idsToRestore, trashed: false }),
      })

      toast.dismiss(loadingToastId)

      if (res.ok) {
        toast.success(`Restored successfully`)
        deletedSelectedItemsRef.current = []
        fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh
      } else {
        const data = await res.json()
        if (data.error === 'google_auth_expired') { setAuthExpired(true); return }
        toast.error(data.error ?? 'Failed to restore items')
        fetchFiles(currentFolderId ?? dealFolderId, true)
      }
    } catch {
      toast.dismiss(loadingToastId)
      toast.error('Failed to restore items')
      fetchFiles(currentFolderId ?? dealFolderId, true)
    }
  }

  // ── Close menus on outside click ──

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFile(null)
      }
    }
    if (menuFile) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuFile])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setIsNewMenuOpen(false)
      }
    }
    if (isNewMenuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isNewMenuOpen])

  const copyDealRoomLink = useCallback(() => {
    if (!dealFolderId) {
      toast.error('No deal room created yet')
      return
    }
    const url = `https://drive.google.com/drive/folders/${dealFolderId}`
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Deal room Google Drive link copied to clipboard'))
      .catch(() => toast.error('Failed to copy link'))
  }, [dealFolderId])

  const expandAllFolders = useCallback(() => {
    const allFolderIds = new Set<string>()
    const collect = (items: DriveFileItem[]) => {
      items.forEach(item => {
        if (item.isFolder) {
          allFolderIds.add(item.id)
          const children = folderContents[item.id]
          if (children) collect(children)
        }
      })
    }
    collect(files)
    setExpandedFolders(allFolderIds)
  }, [files, folderContents])

  // ── Keyboard ──

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (renameTarget) return // don't intercept while renaming
    if (e.key === 'Escape') { navigateUp(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, listRows.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < listRows.length) {
      const row = listRows[focusIdx]
      if (row) {
        const { item: f } = row
                if (f.isFolder) {
          toggleFolderExpanded(f.id, e as unknown as React.MouseEvent)
        } else {
          window.open(f.webViewLink ?? '#', '_blank')
        }
      }
      return
    }
    if (e.key === 'Delete' && focusIdx >= 0 && focusIdx < listRows.length) {
      const row = listRows[focusIdx]
      if (row) {
        const { item: f } = row
        setDeleteTarget(f)
      }
      return
    }
    if (e.key === 'F2' && focusIdx >= 0 && focusIdx < listRows.length) {
      e.preventDefault()
      const row = listRows[focusIdx]
      if (row) {
        const { item: f } = row
        startRename(f)
      }
    }
  }

  // ── Computed list rows (for flat tree mapping) ──

  const { folderCount, fileCount } = useMemo(() => {
    let folders = 0
    let filesCount = 0
    const visited = new Set<string>()

    const countRecursive = (items: DriveFileItem[]) => {
      for (const item of items) {
        if (visited.has(item.id)) continue
        visited.add(item.id)
        if (item.isFolder) {
          folders++
          const children = folderContents[item.id]
          if (children) countRecursive(children)
        } else {
          filesCount++
        }
      }
    }

    countRecursive(files)
    return { folderCount: folders, fileCount: filesCount }
  }, [files, folderContents])

  // Combined root list (no inline upload items — UploadPanel handles progress)
  const renderedItems = useMemo(() => sortFoldersFirst(files), [files])

  // Flat tree rows for list view
  const listRows = useMemo(() => {
    const rows: Array<{
      item: DriveFileItem
      depth: number
      parentFolderId?: string
      isLastChild?: boolean
      ancestorsIsLast?: boolean[]
    }> = []

    const traverse = (
      items: DriveFileItem[],
      depth: number,
      parentId: string | undefined,
      ancestorsIsLast: boolean[]
    ) => {
      items.forEach((item, idx) => {
        const isLast = idx === items.length - 1
        rows.push({
          item,
          depth,
          parentFolderId: parentId,
          isLastChild: isLast,
          ancestorsIsLast,
        })

        if (item.isFolder && expandedFolders.has(item.id)) {
          const children = folderContents[item.id] ?? []
          traverse(children, depth + 1, item.id, [...ancestorsIsLast, isLast])
        }
      })
    }

    traverse(renderedItems, 0, undefined, [])
    return rows
  }, [renderedItems, expandedFolders, folderContents])

  // ── Multi-Selection Helpers ──

  const handleToggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const selectableItems = useMemo(() => {
    if (viewMode === 'list') {
      return listRows.map((r) => r.item)
    } else {
      const items: DriveFileItem[] = [...renderedItems]
      renderedItems.forEach((item) => {
        if (item.isFolder && expandedFolders.has(item.id)) {
          const children = folderContents[item.id] ?? []
          items.push(...children)
        }
      })
      return items
    }
  }, [viewMode, listRows, renderedItems, expandedFolders, folderContents])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedFileIds(new Set(selectableItems.map((item) => item.id)))
    } else {
      setSelectedFileIds(new Set())
    }
  }, [selectableItems])

  // ── Render: loading ──

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: 'var(--color-surface-2)' }}>
          <div className="h-5 w-32 rounded animate-pulse bg-[var(--color-surface-2)]" />
          <div className="h-7 w-24 rounded animate-pulse bg-[var(--color-surface-2)]" />
        </div>
        <div className="rounded-lg border divide-y overflow-hidden" style={{ borderColor: 'var(--color-surface-2)' }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  // ── Render: auth expired ──

  if (authExpired || connStatus === 'expired') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 border border-dashed rounded-lg" style={{ borderColor: 'var(--color-surface-3)' }}>
        <AlertTriangle size={32} style={{ color: 'var(--color-warning-text)' }} />
        <div className="text-center space-y-1.5 px-4">
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Google Connection Expired
          </h3>
          <p className="text-[11px] max-w-[340px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
            Your Google authorization has expired. Reconnect to access Drive files.
          </p>
        </div>
        <Button onClick={() => setReconnectDialogOpen(true)} size="sm"
          style={{ background: 'var(--accent)', color: 'var(--color-text-inverse)' }}>
          Reconnect Google Account
        </Button>
        <GoogleReconnectDialog
          open={reconnectDialogOpen}
          onOpenChange={setReconnectDialogOpen}
          reconnectUrl={reconnectUrl || `/api/auth/google?projectId=${projectId}`}
          onDismiss={() => setAuthExpired(false)}
        />
      </div>
    )
  }

  // ── Render: no deal folder ──

  if (!dealFolderId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 border border-dashed rounded-lg" style={{ borderColor: 'var(--color-surface-3)' }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200"
          style={{ background: 'var(--color-surface-1)' }}
        >
          <Folder size={32} style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
        <div className="text-center space-y-1.5 px-4">
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            No deal room
          </h3>
          <p className="text-[11px] max-w-[340px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
            Create a Google Drive deal room for &quot;{dealName}&quot; to upload, organize, and view files.
          </p>
        </div>
        <Button onClick={createDealFolder} disabled={creatingFolder} size="sm" className="mt-1 bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] hover:opacity-90">
          {creatingFolder ? <LoadingSpinner size="sm" /> : <FolderPlus size={14} />}
          Create Deal Room
        </Button>
      </div>
    )
  }

  // ── Render: main ──

  return (
    <div
      ref={containerRef}
      className="space-y-4 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b select-none" style={{ borderColor: 'var(--color-surface-2)' }}>
        {/* Left Side: Navigation & Copy Link */}
        <div className="flex items-center gap-2">
          <DriveBreadcrumb
            segments={breadcrumb}
            onNavigate={navigateBreadcrumb}
            dealFolderName={dealName}
            dealFolderId={dealFolderId}
          />
          {dealFolderId && (
            <button
              onClick={copyDealRoomLink}
              className="flex items-center justify-center p-1.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] transition-colors cursor-pointer"
              title="Copy Google Drive folder link"
            >
              <Link size={13} />
            </button>
          )}
          {(folderCount > 0 || fileCount > 0) && (
            <span className="text-[11px] select-none font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-1)] text-[var(--color-text-secondary)]">
              {formatFileFolderCount(fileCount, folderCount)}
            </span>
          )}
        </div>

        {/* Right Side: Action Clusters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Action 1: Refresh (leftmost on the right side) */}
          <button 
            onClick={() => fetchFiles(currentFolderId ?? dealFolderId, true)} 
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors" 
            style={{ color: 'var(--color-text-secondary)' }}
            title="Refresh"
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {/* Divider */}
          <div className="h-5 w-[1px] bg-[var(--color-surface-3)] hidden sm:block" />

          {/* Action 2: Expand / Collapse All (only when folders exist) */}
          {folderCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={expandedFolders.size > 0 ? () => setExpandedFolders(new Set()) : expandAllFolders}
              className="h-8 w-8 p-0 flex items-center justify-center rounded-md border-[var(--color-surface-3)] hover:bg-[var(--color-surface-1)]"
              title={expandedFolders.size > 0 ? "Collapse all folders" : "Expand all folders"}
            >
              {expandedFolders.size > 0 ? (
                <FolderOpen size={14} style={{ color: 'var(--color-text-secondary)' }} />
              ) : (
                <Folder size={14} style={{ color: 'var(--color-text-secondary)' }} />
              )}
            </Button>
          )}

          {/* Divider — only when folders AND selections exist */}
          {folderCount > 0 && <div className="h-5 w-[1px] bg-[var(--color-surface-3)] hidden sm:block" />}

          {/* Action 3: Selection Group (Select All + Delete Selected) */}
          <div className="flex items-center gap-1.5">
            {selectableItems.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 rounded-md border h-8 select-none bg-[var(--color-surface-0)]" style={{ borderColor: 'var(--color-surface-3)' }}>
                <Checkbox
                  id="select-all-checkbox"
                  checked={
                    selectedFileIds.size > 0 && 
                    selectableItems.every((item) => selectedFileIds.has(item.id))
                  }
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  className="border-[var(--color-surface-3)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)] h-3.5 w-3.5"
                />
                <label htmlFor="select-all-checkbox" className="text-[11px] font-semibold cursor-pointer select-none" style={{ color: 'var(--color-text-secondary)' }}>
                  Select All
                </label>
              </div>
            )}

            {selectedFileIds.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteSelected(true)}
                className="h-8 text-[11px] gap-1.5 bg-[var(--color-danger-solid)] border-none text-[var(--color-text-inverse)] hover:opacity-90 animate-in fade-in zoom-in-95 duration-100"
              >
                <Trash2 size={12} />
                <span>Delete Selected ({selectedFileIds.size})</span>
              </Button>
            )}
          </div>

          {/* Divider — only when selectable items exist */}
          {selectableItems.length > 0 && (
            <div className="h-5 w-[1px] bg-[var(--color-surface-3)] hidden sm:block" />
          )}

          {/* Action 4: Google Drive Style "+ New" Dropdown */}
          <div className="relative" ref={newMenuRef}>
            <Button
              onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
              className="h-8 text-[11px] gap-1.5 bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] hover:opacity-90 font-semibold shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>New</span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isNewMenuOpen ? 'rotate-180' : ''}`} />
            </Button>
            
            {isNewMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 z-50 w-44 rounded-md border py-1 shadow-lg bg-[var(--color-surface-0)] border-[var(--color-surface-2)] animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  onClick={() => { setIsNewMenuOpen(false); setShowNewFolder(true) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--color-surface-1)] transition-colors text-left cursor-pointer"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <FolderPlus size={14} className="text-[var(--color-text-secondary)]" />
                  <span>New Folder</span>
                </button>
                <button
                  onClick={() => { setIsNewMenuOpen(false); fileInputRef.current?.click() }}
                  disabled={uploadPanelItems.some((i) => i.status === 'uploading')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--color-surface-1)] disabled:opacity-50 transition-colors text-left cursor-pointer"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <Upload size={14} className="text-[var(--color-text-secondary)]" />
                  <span>File Upload</span>
                </button>
                <button
                  onClick={() => { setIsNewMenuOpen(false); folderUploadInputRef.current?.click() }}
                  disabled={uploadPanelItems.some((i) => i.status === 'uploading')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[var(--color-surface-1)] disabled:opacity-50 transition-colors text-left cursor-pointer"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <FolderUp size={14} className="text-[var(--color-text-secondary)]" />
                  <span>Folder Upload</span>
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-[1px] bg-[var(--color-surface-3)] hidden sm:block" />

          {/* Action 5: Isolated Danger Zone */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDeleteRoomConfirm(true)}
            disabled={deletingFolder}
            className="h-8 text-[11px] gap-1.5 border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] active:scale-[0.98] transition-all font-medium"
            style={{ color: 'var(--color-danger-text)', borderColor: 'var(--color-danger-border)' }}
          >
            <Trash2 size={12} />
            Delete Deal Room
          </Button>

          {/* Hidden inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = '' }}
          />
          <input
            ref={folderUploadInputRef}
            type="file"
            /* @ts-expect-error webkitdirectory is a non-standard but widely supported attribute */
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFolderUpload}
          />
          <input
            ref={folderFileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && activeUploadFolderIdRef.current) {
                handleUpload(e.target.files, activeUploadFolderIdRef.current)
              }
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* ── Drop zone container ── */}
      <div
        ref={dropZoneRef}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="relative rounded-lg border transition-all duration-150 min-h-[160px] overflow-hidden"
        style={{
          borderColor: dragActive ? 'var(--color-accent)' : 'var(--color-surface-2)',
          background: 'transparent',
        }}
      >
        {/* CSS highlight & zoom transitions */}
        <style>{`
          @keyframes highlight-flash {
            0% { background-color: var(--color-success-bg); border-color: var(--color-success-border); transform: scale(1.01); }
            15% { background-color: var(--color-success-bg); border-color: var(--color-success-border); transform: scale(1.01); }
            100% { background-color: var(--color-surface-0); border-color: var(--color-surface-3); transform: scale(1); }
          }
          .animate-highlight-flash {
            animation: highlight-flash 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        {/* ── Drag overlay (Desktop Upload) — only shown when folder is empty ── */}
        {dragActive && files.length === 0 && (
          <div 
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-all duration-150 pointer-events-none"
            style={{
              background: 'rgba(30, 91, 63, 0.08)',
              backdropFilter: 'blur(2px)',
              borderColor: 'var(--color-accent)',
            }}
          >
            <div className="flex flex-col items-center justify-center p-6 rounded-xl border bg-[var(--color-surface-0)] shadow-lg max-w-[280px]" style={{ borderColor: 'var(--color-surface-3)' }}>
              <Upload className="animate-bounce" size={32} style={{ color: 'var(--color-accent)' }} />
              <span className="text-[13px] font-semibold mt-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
                Drop files or folders here to upload
              </span>
              <span className="text-[11px] mt-1 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                Files will be saved in Google Drive
              </span>
            </div>
          </div>
        )}

        {/* ── Empty folder ── */}
        {listRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 select-none">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-surface-1)' }}
            >
              <Upload size={20} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Drag & Drop files here, or click upload
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                Files are stored directly in your Google Drive
              </p>
            </div>
          </div>
        )}

        {/* ── List view (Tree View with Inline Expand/Collapse, Guide Lines, Checklists & Outlines) ── */}
        {listRows.length > 0 && (
          <div className="space-y-1.5 p-2 animate-in fade-in duration-200" style={{ borderColor: 'var(--color-surface-2)' }}>
            {listRows.map(({ item: file, depth, parentFolderId, isLastChild, ancestorsIsLast }, idx) => {
              const { Icon, color } = getFileIcon(file.mimeType, file.isFolder)
              const isFocused = focusIdx === idx
              const isExpanded = expandedFolders.has(file.id)
              const isLoadingCount = loadingFolderCounts.has(file.id)
              
              const children = folderContents[file.id] ?? []
              const childFoldersCount = children.filter((c) => c.isFolder).length
              const childFilesCount = children.filter((c) => !c.isFolder).length
              const isCollected = children.length > 0

              const isFolderChecklist = file.isFolder
              const isTargetFolderActive = activeDropFolderId === file.id
              const isNewlyAdded = newlyAddedIds.has(file.id)

              const isDeleting = deletingItemIds.has(file.id)

              return (
                <div
                  key={file.id}
                  className={`flex items-center ${isDeleting ? 'animate-item-delete' : 'animate-in fade-in slide-in-from-top-1 duration-200 ease-out'}`}
                >
                  {/* Tree branch line connector */}
                  {depth > 0 && (
                    <div className="flex self-stretch select-none pointer-events-none mr-1.5">
                      {Array.from({ length: depth }).map((_, d) => {
                        const isLastConnector = d === depth - 1
                        const ancestorLast = ancestorsIsLast?.[d] ?? false

                        if (isLastConnector) {
                          return (
                            <div key={d} className="relative w-6 self-stretch">
                              <div 
                                className="absolute left-3 w-[1px] bg-[var(--color-surface-3)]" 
                                style={{
                                  top: '0px',
                                  bottom: isLastChild ? '50%' : '0px',
                                }}
                              />
                              <div className="absolute top-1/2 left-3 w-3 h-[1px] bg-[var(--color-surface-3)]" />
                            </div>
                          )
                        }

                        return (
                          <div key={d} className="relative w-6 self-stretch">
                            {!ancestorLast && (
                              <div className="absolute left-3 top-0 bottom-0 w-[1px] bg-[var(--color-surface-3)]" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Card item container */}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, file)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => { if (file.isFolder) handleDragOverFolder(e, file) }}
                    onDragLeave={(e) => { if (file.isFolder) handleDragLeaveFolder(e, file) }}
                    onDrop={(e) => { if (file.isFolder) handleDropOnFolder(e, file) }}
                    className={`group flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer relative shadow-xs
                      ${isNewlyAdded
                        ? 'animate-highlight-flash z-10'
                        : isTargetFolderActive 
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)] scale-[1.015] shadow-sm z-10' 
                          : isFocused
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)] scale-[1.005]' 
                            : 'border-[var(--color-surface-3)] bg-[var(--color-surface-0)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-bg)] hover:-translate-y-0.5 hover:shadow-sm'
                      }
                    `}
                    onClick={(e) => {
                      if (renameTarget?.id === file.id) return
                      if (file.isFolder) {
                        toggleFolderExpanded(file.id, e)
                      } else {
                        window.open(file.webViewLink ?? '#', '_blank')
                      }
                    }}
                    onContextMenu={(e) => { e.preventDefault(); setMenuFile(file) }}
                    tabIndex={-1}
                  >
                    {/* Multi-select checkbox */}
                    <div 
                      className={`flex-shrink-0 transition-opacity duration-150 mr-1.5 ${
                        selectedFileIds.has(file.id) 
                          ? 'opacity-100 pointer-events-auto' 
                          : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedFileIds.has(file.id)}
                        onCheckedChange={(checked) => handleToggleSelect(file.id, !!checked)}
                        className="border-[var(--color-surface-3)] bg-[var(--color-surface-0)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)] h-3.5 w-3.5"
                      />
                    </div>

                    {/* Tree chevron for expansion */}
                    {file.isFolder ? (
                      <button
                        onClick={(e) => toggleFolderExpanded(file.id, e)}
                        className="w-[18px] h-[18px] flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors text-[var(--color-text-secondary)]"
                      >
                        {isExpanded ? (
                          <ChevronDown size={13} />
                        ) : (
                          <ChevronRight size={13} />
                        )}
                      </button>
                    ) : (
                      <div className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0">
                        {deletingItemIds.has(file.id) ? (
                          <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
                        ) : (
                          <div
                            className="w-[16px] h-[16px] rounded-full border flex items-center justify-center"
                            style={{ borderColor: 'var(--color-text-tertiary)' }}
                          >
                            <Check size={9} strokeWidth={2.5} style={{ color: 'var(--color-text-tertiary)' }} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Checklist checkbox indicator for folders */}
                    {isFolderChecklist && (
                      <div className="flex-shrink-0" onClick={(e) => toggleFolderExpanded(file.id, e)}>
                        {isLoadingCount ? (
                          <LoadingSpinner size="sm" />
                        ) : isCollected ? (
                          <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center bg-[var(--color-success)] text-[var(--color-text-inverse)] shadow-xs mr-0.5">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-[18px] h-[18px] rounded-full border border-[var(--color-surface-3)] bg-transparent hover:border-[var(--color-accent)] mr-0.5" />
                        )}
                      </div>
                    )}

                    {/* Folder / File Icon */}
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                      <Icon size={15} style={{ color }} />
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      {renameTarget?.id === file.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameTarget(null) }}
                            onBlur={() => confirmRename()}
                            className="h-7 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
                          />
                          {renaming && <LoadingSpinner size="sm" />}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {file.name}
                          </span>
                          {file.isFolder && (
                            <span className="text-[9px] py-0.5 px-1.5 rounded bg-[var(--color-surface-1)] text-[var(--color-text-tertiary)] select-none">
                              {isLoadingCount ? 'loading...' : formatFileFolderCount(childFilesCount, childFoldersCount)}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {!file.isFolder && (
                        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          <span>{typeLabel(file.mimeType, file.isFolder)}</span>
                          {file.size && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{formatFileSize(file.size)}</span>
                            </>
                          )}
                          {file.modifiedTime && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{relativeTime(file.modifiedTime)}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>


                    {/* Actions */}
                    <div className="flex-shrink-0 relative w-20 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {renameTarget?.id === file.id ? (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={confirmRename}
                            disabled={renaming}
                            className="p-1 rounded transition-colors hover:bg-[var(--color-success-bg)]"
                            style={{ color: 'var(--color-success)' }}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setRenameTarget(null)}
                            className="p-1 rounded transition-colors hover:bg-[var(--color-surface-2)]"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Direct folder upload button */}
                          {file.isFolder && (
                            <button
                              className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--color-surface-2)]"
                              style={{ color: 'var(--color-text-secondary)' }}
                              onClick={(e) => triggerFolderUpload(file.id, e)}
                              title="Upload directly to folder"
                            >
                              <Upload size={12} />
                            </button>
                          )}
                          {/* Subfolder creation button */}
                          {file.isFolder && (
                            <button
                              className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--color-surface-2)]"
                              style={{ color: 'var(--color-text-secondary)' }}
                              onClick={(e) => triggerCreateSubfolder(file.id, e)}
                              title="New Subfolder"
                            >
                              <FolderPlus size={12} />
                            </button>
                          )}
                          <button
                            className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--color-surface-2)]"
                            style={{ color: 'var(--color-text-secondary)' }}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              menuAnchorRef.current = rect
                              setMenuFile(menuFile?.id === file.id ? null : file)
                            }}
                          >
                            <MoreHorizontal size={13} />
                          </button>
                        </>
                      )}
                      {/* Dropdown — portaled to body to avoid overflow clipping */}
                      {menuFile?.id === file.id && typeof document !== 'undefined' &&
                        createPortal(
                          <div
                            ref={menuRef}
                            className="fixed z-50 w-36 rounded-md border py-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
                            style={{
                              background: 'var(--color-surface-0)',
                              borderColor: 'var(--color-surface-2)',
                              top: menuAnchorRef.current?.bottom ?? 0,
                              left: menuAnchorRef.current?.right ? menuAnchorRef.current.right - 144 : 0,
                            }}
                          >
                            <button
                              onClick={() => startRename(file)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--color-surface-1)] transition-colors"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              <Pencil size={11} /> Rename
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(file); setMenuFile(null) }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--color-danger-bg)] transition-colors"
                              style={{ color: 'var(--color-danger-text)' }}
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                            {!file.isFolder && file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--color-surface-1)] transition-colors block"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                <ExternalLink size={11} /> Open Drive
                              </a>
                            )}
                          </div>,
                          document.body,
                        )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Storage usage bar ── */}
      {dealFolderId && storageQuota && (() => {
        const limit = parseInt(storageQuota.limit, 10) || 0
        const driveUsage = parseInt(storageQuota.usageInDrive, 10) || 0
        const trashUsage = parseInt(storageQuota.usageInDriveTrash, 10) || 0
        const pct = limit > 0 ? Math.min((driveUsage / limit) * 100, 100) : 0
        const fillColor =
          pct > 90 ? 'var(--color-danger-solid)' :
          pct > 75 ? 'var(--color-warning-solid)' :
          'var(--color-accent)'

        return (
          <div
            className="group relative flex items-center gap-3 px-1 pb-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {/* Thin progress track + fill */}
            <div
              className="h-[3px] rounded-full flex-1 overflow-hidden"
              style={{ background: 'var(--color-surface-1)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: fillColor,
                  transitionDuration: '600ms',
                  transitionTimingFunction: 'var(--ease-fluid)',
                }}
              />
            </div>

            {/* Label */}
            <span className="text-[10px] font-medium shrink-0 select-none">
              {formatStorageSize(driveUsage)} of {formatStorageSize(limit)} used
            </span>

            {/* Tooltip on hover */}
            <div
              className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-40 px-3 py-2 rounded-md text-[10px] leading-relaxed whitespace-nowrap"
              style={{
                background: 'var(--color-surface-0)',
                border: '1px solid var(--color-surface-2)',
                boxShadow: 'var(--shadow-md)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <div>Drive: {formatStorageSize(driveUsage)}</div>
              {trashUsage > 0 && <div>Trash: {formatStorageSize(trashUsage)}</div>}
              <div>Free: {formatStorageSize(Math.max(0, limit - driveUsage))}</div>
            </div>
          </div>
        )
      })()}

      {/* ── New Folder Dialog ── */}
      <Dialog open={showNewFolder} onOpenChange={(open) => { if (!open) closeNewFolderDialog() }}>
        <DialogContent className="sm:max-w-[380px]" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }} className="text-sm font-semibold">New Folder</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }} className="text-[11px]">
              Create a subfolder inside {parentFolderItem ? `"${parentFolderItem.name}"` : breadcrumb.length > 0 ? `"${breadcrumb[breadcrumb.length - 1]!.name}"` : `"${dealName}"`}.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') createSubfolder() }}
            className="bg-[var(--color-surface-1)] border-[var(--color-surface-3)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] text-[12px] h-8"
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeNewFolderDialog} className="text-[11px] h-8 border-[var(--color-surface-3)]">Cancel</Button>
            <Button onClick={createSubfolder} disabled={creatingSubfolder || !newFolderName.trim()} className="text-[11px] h-8 bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] hover:opacity-90">
              {creatingSubfolder ? <LoadingSpinner size="sm" /> : <FolderPlus size={12} />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-[400px]" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }} className="text-sm font-semibold">
              {deleteTarget?.isFolder ? 'Delete folder?' : 'Delete file?'}
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }} className="text-[11px]">
              {deleteTarget?.isFolder
                ? `"${deleteTarget?.name}" and its contents will be moved to Google Drive trash.`
                : `"${deleteTarget?.name}" will be moved to Google Drive trash.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting} className="text-[11px] h-8 border-[var(--color-surface-3)]">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="text-[11px] h-8 bg-[var(--color-danger-solid)] border-none text-[var(--color-text-inverse)] hover:opacity-90">
              {deleting ? <LoadingSpinner size="sm" /> : <Trash2 size={12} />}
              Move to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Batch Delete Confirmation ── */}
      <Dialog open={showDeleteSelected} onOpenChange={(open) => { if (!open) setShowDeleteSelected(false) }}>
        <DialogContent className="sm:max-w-[400px]" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }} className="text-sm font-semibold">
              Delete selected items?
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }} className="text-[11px]">
              Are you sure you want to delete the {selectedFileIds.size} selected item(s)? They will be moved to Google Drive trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteSelected(false)} disabled={deletingSelected} className="text-[11px] h-8 border-[var(--color-surface-3)]">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteSelected} disabled={deletingSelected} className="text-[11px] h-8 bg-[var(--color-danger-solid)] border-none text-[var(--color-text-inverse)] hover:opacity-90">
              {deletingSelected ? <LoadingSpinner size="sm" /> : <Trash2 size={12} />}
              Move to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Deal Room confirmation ──────────────────────────────── */}
      <Dialog open={showDeleteRoomConfirm} onOpenChange={(open) => { if (!open) setShowDeleteRoomConfirm(false) }}>
        <DialogContent className="sm:max-w-[400px]" style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }} className="text-sm font-semibold">
              Delete Deal Room?
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--color-text-secondary)' }} className="text-[11px]">
              This will move the Google Drive folder for &quot;{dealName}&quot; to trash. Files can be recovered from Google Drive trash within 30 days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteRoomConfirm(false)} disabled={deletingFolder} className="text-[11px] h-8 border-[var(--color-surface-3)]">Cancel</Button>
            <Button variant="destructive" onClick={deleteDealFolder} disabled={deletingFolder} className="text-[11px] h-8 bg-[var(--color-danger-solid)] border-none text-[var(--color-text-inverse)] hover:opacity-90">
              {deletingFolder ? <LoadingSpinner size="sm" /> : <Trash2 size={12} />}
              Delete Deal Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Upload progress panel (portal to body — avoids scroll/transform containment) ── */}
      {typeof document !== 'undefined' &&
        createPortal(
          <UploadPanel
            items={uploadPanelItems}
            onDismiss={(id) => {
              activeXhrMapRef.current.delete(id)
              parentFolderMapRef.current.delete(id)
              setUploadPanelItems((prev) => prev.filter((item) => item.id !== id))
            }}
            onDismissAll={() => {
              activeXhrMapRef.current.clear()
              parentFolderMapRef.current.clear()
              setUploadPanelItems([])
            }}
            onCancel={(id) => {
              const xhr = activeXhrMapRef.current.get(id)
              if (xhr) {
                xhr.abort()
                activeXhrMapRef.current.delete(id)
              }
              parentFolderMapRef.current.delete(id)
              setUploadPanelItems((prev) => prev.filter((item) => item.id !== id))
            }}
            onRetry={(id) => {
              setUploadPanelItems((prev) =>
                prev.map((item) =>
                  item.id === id
                    ? { ...item, progress: 0, status: 'uploading' as const, errorMessage: undefined }
                    : item,
                ),
              )
              // Re-upload the single file
              const item = uploadPanelItems.find((i) => i.id === id)
              if (item?.file) {
                retrySingleFile(item.file, item.id, parentFolderMapRef.current.get(id) ?? null)
              }
            }}
            onRetryAll={() => {
              const errored = uploadPanelItems.filter((i) => i.status === 'error' && i.file)
              setUploadPanelItems((prev) =>
                prev.map((item) =>
                  item.status === 'error' && item.file
                    ? { ...item, progress: 0, status: 'uploading' as const, errorMessage: undefined }
                    : item,
                ),
              )
              for (const item of errored) {
                retrySingleFile(item.file!, item.id, parentFolderMapRef.current.get(item.id) ?? null)
              }
            }}
          />,
          document.body,
        )}
    </div>
  )
}
