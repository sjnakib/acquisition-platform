'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Folder, FolderOpen, File, FileText, Image, Table2,
  MoreHorizontal, Upload, FolderPlus, RotateCw, Check, X,
  Trash2, Pencil, ExternalLink, LayoutList, LayoutGrid,
  ChevronDown, ChevronRight, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { DriveBreadcrumb, type BreadcrumbSegment } from './DriveBreadcrumb'
import { formatDate } from '@/lib/utils'

// ── Types ──

interface DriveFileItem {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  size: string | null
  modifiedTime: string | null
  isFolder: boolean
  isUploading?: boolean
  progress?: number
  status?: 'uploading' | 'completed' | 'error'
}

interface UploadEntry {
  name: string
  progress: number // 0–100
  status: 'uploading' | 'completed' | 'error'
  targetFolderId?: string
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

function formatFileFolderCount(filesCount: number, foldersCount: number): string {
  const parts: string[] = []
  if (filesCount > 0 || foldersCount === 0) {
    parts.push(`${filesCount} file${filesCount !== 1 ? 's' : ''}`)
  }
  if (foldersCount > 0) {
    parts.push(`${foldersCount} folder${foldersCount !== 1 ? 's' : ''}`)
  }
  return parts.join(' / ')
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
  // Data state
  const [files, setFiles] = useState<DriveFileItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [dealFolderId, setDealFolderId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)

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

  // Upload
  const [uploads, setUploads] = useState<UploadEntry[]>([])
  const [uploading, setUploading] = useState(false)
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
  const deletedRef = useRef<DriveFileItem | null>(null) // for undo

  // Menu
  const [menuFile, setMenuFile] = useState<DriveFileItem | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('list')

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
        const children = data.files ?? []
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
          } else {
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
      } else {
        toast.error(data.error ?? 'Failed to load files')
      }
    } catch {
      toast.error('Failed to load files')
    } finally {
      setRefreshing(false)
    }
  }, [dealId, currentFolderId, dealFolderId, triggerBackgroundFolderFetches])

  const { data: dealData } = useQuery<{ drive_folder_id?: string | null }>({
    queryKey: ['deal', dealId, 'drive', 'folder'],
    queryFn: async () => {
      const res = await fetch(`/api/deals/${dealId}`)
      if (!res.ok) throw new Error('Failed to fetch deal')
      return res.json()
    },
    enabled: !!dealId,
  })

  const loading = dealData === undefined

  useEffect(() => {
    if (!dealData) return
    if (dealData.drive_folder_id) {
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
            toast.error(data.error ?? 'Failed to load files')
          }
        })
        .catch(() => toast.error('Failed to load files'))
    } else {
      setFiles([])
      setDealFolderId(null)
    }
  }, [dealData, dealId, triggerBackgroundFolderFetches])

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
        toast.success('Deal folder created')
        await fetchFiles(data.drive_folder_id)
      } else {
        toast.error(data.error ?? 'Failed to create deal folder')
      }
    } catch {
      toast.error('Failed to create deal folder')
    } finally {
      setCreatingFolder(false)
    }
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
    if (item.isUploading) { e.preventDefault(); return }
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
    if (!draggedItemRef.current) return
    if (draggedItemRef.current.id === folder.id) return
    
    e.preventDefault()
    e.stopPropagation()
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

    const draggedId = e.dataTransfer.getData('application/x-internal-move') || draggedItemRef.current?.id
    if (!draggedId || draggedId === folder.id) return

    const draggedItem = draggedItemRef.current
    if (!draggedItem) return

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
          [folder.id]: [...currentChildren, { ...draggedItem, isUploading: false }],
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
          nextContents[folder.id] = [...(nextContents[folder.id] ?? []), { ...draggedItem, isUploading: false }]
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
        toast.error(data.error ?? 'Failed to move item')
      }
    } catch {
      toast.dismiss(loadingToastId)
      setFiles(previousFiles)
      setFolderContents(previousContents)
      toast.error('Failed to move item')
    }
  }

  // ── Upload (Parallel & Granular Progress) ──

  const handleUpload = async (fileList: FileList | File[], folderIdOverride?: string) => {
    const fileArr = Array.from(fileList)
    if (fileArr.length === 0) return

    setUploading(true)
    
    const targetFolderId = folderIdOverride ?? currentFolderId ?? dealFolderId
    if (!targetFolderId) {
      toast.error('No folder target resolved for upload')
      setUploading(false)
      return
    }

    // Initialize uploads state
    const initialUploads: UploadEntry[] = fileArr.map((f) => ({
      name: f.name,
      progress: 0,
      status: 'uploading',
      targetFolderId,
    }))
    setUploads(initialUploads)

    // Function to handle XHR upload for a single file
    const uploadSingleFile = (file: File, index: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folderId', targetFolderId)

        const xhr = new XMLHttpRequest()
        xhr.open('POST', `/api/deals/${dealId}/drive/files`)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            setUploads((prev) =>
              prev.map((e, idx) => idx === index ? { ...e, progress: percent } : e)
            )
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploads((prev) =>
              prev.map((e, idx) => idx === index ? { ...e, progress: 100, status: 'completed' } : e)
            )
            resolve(true)
          } else {
            let errorMsg = 'Upload failed'
            try {
              const data = JSON.parse(xhr.responseText)
              errorMsg = data.error ?? errorMsg
            } catch {}
            setUploads((prev) =>
              prev.map((e, idx) => idx === index ? { ...e, status: 'error' } : e)
            )
            toast.error(`Failed to upload "${file.name}": ${errorMsg}`)
            resolve(false)
          }
        }

        xhr.onerror = () => {
          setUploads((prev) =>
            prev.map((e, idx) => idx === index ? { ...e, status: 'error' } : e)
          )
          toast.error(`Upload error on "${file.name}"`)
          resolve(false)
        }

        xhr.send(formData)
      })
    }

    // Trigger uploads in parallel
    const results = await Promise.all(fileArr.map((f, i) => uploadSingleFile(f, i)))
    const successCount = results.filter(Boolean).length

    // Refresh after showing completion status briefly
    setTimeout(() => {
      setUploads([])
      setUploading(false)
    }, 1200)

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully`)
    }
    fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh
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

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current = 0
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
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

    try {
      const res = await fetch(`/api/deals/${dealId}/drive/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parentFolderId }),
      })
      if (res.ok) {
        toast.success(`Folder "${newFolderName.trim()}" created`)
        closeNewFolderDialog()
        fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh
      } else {
        const data = await res.json()
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
    setFiles((prev) => prev.filter((f) => f.id !== target.id))
    setDeleteTarget(null)
    deletedRef.current = target
    setDeleting(true)

    try {
      const res = await fetch(`/api/deals/${dealId}/drive/files?fileId=${target.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`"${target.name}" moved to trash`, {
          action: {
            label: 'Undo',
            onClick: () => undoDelete(),
          },
        })
        fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh
      } else {
        setFiles(previous)
        const data = await res.json()
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

    // Optimistic UI updates
    setFiles((prev) => prev.filter((f) => !selectedFileIds.has(f.id)))
    setFolderContents((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((key) => {
        const val = next[key]
        if (val) {
          next[key] = val.filter((f) => !selectedFileIds.has(f.id))
        }
      })
      return next
    })

    setSelectedFileIds(new Set())
    setShowDeleteSelected(false)
    setDeletingSelected(true)

    try {
      const res = await fetch(`/api/deals/${dealId}/drive/files?fileIds=${idsToDelete.join(',')}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(`${targets.length} item(s) moved to trash`, {
          action: {
            label: 'Undo',
            onClick: () => undoDeleteSelected(),
          },
        })
        fetchFiles(currentFolderId ?? dealFolderId, true) // soft refresh
      } else {
        setFiles(previousFiles)
        setFolderContents(previousFolderContents)
        const data = await res.json()
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
        toast.error(data.error ?? 'Failed to restore items')
        fetchFiles(currentFolderId ?? dealFolderId, true)
      }
    } catch {
      toast.dismiss(loadingToastId)
      toast.error('Failed to restore items')
      fetchFiles(currentFolderId ?? dealFolderId, true)
    }
  }

  // ── Close menu on outside click ──

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFile(null)
      }
    }
    if (menuFile) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuFile])

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
        if (!f.isUploading) {
          if (f.isFolder) {
            toggleFolderExpanded(f.id, e as unknown as React.MouseEvent)
          } else {
            window.open(f.webViewLink ?? '#', '_blank')
          }
        }
      }
      return
    }
    if (e.key === 'Delete' && focusIdx >= 0 && focusIdx < listRows.length) {
      const row = listRows[focusIdx]
      if (row) {
        const { item: f } = row
        if (!f.isUploading) setDeleteTarget(f)
      }
      return
    }
    if (e.key === 'F2' && focusIdx >= 0 && focusIdx < listRows.length) {
      e.preventDefault()
      const row = listRows[focusIdx]
      if (row) {
        const { item: f } = row
        if (!f.isUploading) startRename(f)
      }
    }
  }

  // ── Computed list rows (for flat tree mapping) ──

  const folderCount = useMemo(() => files.filter((f) => f.isFolder).length, [files])
  const fileCount = useMemo(() => files.filter((f) => !f.isFolder).length, [files])

  // Combined root list
  const renderedItems = useMemo(() => {
    const uploadItems: DriveFileItem[] = uploads
      .filter((u) => u.targetFolderId === (currentFolderId ?? dealFolderId))
      .map((u, idx) => ({
        id: `uploading-${idx}-${u.name}`,
        name: u.name,
        mimeType: '',
        webViewLink: null,
        size: null,
        modifiedTime: null,
        isFolder: false,
        isUploading: true,
        progress: u.progress,
        status: u.status,
      }))
    return [...uploadItems, ...files]
  }, [files, uploads, currentFolderId, dealFolderId])

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
          // Render child uploads first
          const childUploads = uploads
            .filter((u) => u.targetFolderId === item.id)
            .map((u, uIdx) => ({
              id: `uploading-child-${uIdx}-${u.name}`,
              name: u.name,
              mimeType: '',
              webViewLink: null,
              size: null,
              modifiedTime: null,
              isFolder: false,
              isUploading: true,
              progress: u.progress,
              status: u.status,
            }))

          const children = folderContents[item.id] ?? []
          const allChildren = [...childUploads, ...children]

          traverse(allChildren, depth + 1, item.id, [...ancestorsIsLast, isLast])
        }
      })
    }

    traverse(renderedItems, 0, undefined, [])
    return rows
  }, [renderedItems, expandedFolders, folderContents, uploads])

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
      return listRows.map((r) => r.item).filter((item) => !item.isUploading)
    } else {
      const items: DriveFileItem[] = [...renderedItems]
      renderedItems.forEach((item) => {
        if (item.isFolder && expandedFolders.has(item.id)) {
          const children = folderContents[item.id] ?? []
          items.push(...children)
        }
      })
      return items.filter((item) => !item.isUploading)
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
            No folder initialized
          </h3>
          <p className="text-[11px] max-w-[340px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
            Create a Google Drive workspace folder for &quot;{dealName}&quot; to upload, organize, and view files.
          </p>
        </div>
        <Button onClick={createDealFolder} disabled={creatingFolder} size="sm" className="mt-1 bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] hover:opacity-90">
          {creatingFolder ? <LoadingSpinner size="sm" /> : <FolderPlus size={14} />}
          Create Deal Folder
        </Button>
      </div>
    )
  }

  // ── Render: main ──

  return (
    <div
      ref={containerRef}
      className="space-y-3 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <DriveBreadcrumb
            segments={breadcrumb}
            onNavigate={navigateBreadcrumb}
            dealFolderName={dealName}
          />
          {(folderCount > 0 || fileCount > 0) && (
            <span className="text-[11px] select-none font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
              {formatFileFolderCount(fileCount, folderCount)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* View toggle */}
          <div className="flex items-center rounded-md border p-0.5" style={{ borderColor: 'var(--color-surface-3)', background: 'var(--color-surface-1)' }}>
            <button
              onClick={() => setViewMode('list')}
              className="h-6 w-6 flex items-center justify-center rounded transition-all duration-150"
              style={{
                color: viewMode === 'list' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                background: viewMode === 'list' ? 'var(--color-surface-0)' : 'transparent',
                boxShadow: viewMode === 'list' ? 'var(--shadow-xs)' : 'none',
              }}
              title="List view"
            >
              <LayoutList size={13} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className="h-6 w-6 flex items-center justify-center rounded transition-all duration-150"
              style={{
                color: viewMode === 'grid' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                background: viewMode === 'grid' ? 'var(--color-surface-0)' : 'transparent',
                boxShadow: viewMode === 'grid' ? 'var(--shadow-xs)' : 'none',
              }}
              title="Grid view"
            >
              <LayoutGrid size={13} />
            </button>
          </div>

          {/* Select All */}
          {selectableItems.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded border h-7 select-none" style={{ borderColor: 'var(--color-surface-3)', background: 'var(--color-surface-0)' }}>
              <Checkbox
                id="select-all-checkbox"
                checked={
                  selectedFileIds.size > 0 && 
                  selectableItems.every((item) => selectedFileIds.has(item.id))
                }
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                className="border-[var(--color-surface-3)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)] h-3.5 w-3.5"
              />
              <label htmlFor="select-all-checkbox" className="text-[11px] font-medium cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
                Select All
              </label>
            </div>
          )}

          {/* Collapse All */}
          {expandedFolders.size > 0 && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setExpandedFolders(new Set())} 
              className="h-7 text-[11px] gap-1.5 border-[var(--color-surface-3)] hover:bg-[var(--color-surface-1)]"
              title="Collapse all folders"
            >
              <ChevronUp size={12} />
              <span>Collapse All</span>
            </Button>
          )}

          {/* Delete Selected */}
          {selectedFileIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteSelected(true)}
              className="h-7 text-[11px] gap-1.5 bg-[var(--color-danger-solid)] border-none text-[var(--color-text-inverse)] hover:opacity-90 animate-in fade-in zoom-in-95 duration-100"
            >
              <Trash2 size={12} />
              <span>Delete Selected ({selectedFileIds.size})</span>
            </Button>
          )}

          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => fetchFiles(currentFolderId ?? dealFolderId, true)} 
            className="h-7 w-7 p-0 flex items-center justify-center hover:bg-[var(--color-surface-1)]" 
            title="Refresh"
            disabled={refreshing}
          >
            <RotateCw size={13} className={refreshing ? 'animate-spin' : ''} style={{ color: 'var(--color-text-secondary)' }} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)} className="h-7 text-[11px] gap-1.5 border-[var(--color-surface-3)] hover:bg-[var(--color-surface-1)]">
            <FolderPlus size={12} />
            <span>New Folder</span>
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-7 text-[11px] gap-1.5 bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)] hover:opacity-90"
          >
            {uploading ? <LoadingSpinner size="sm" /> : <Upload size={12} />}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = '' }}
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
        className="relative rounded-lg border transition-all duration-150 min-h-[160px]"
        style={{
          borderColor: dragActive ? 'var(--color-accent)' : 'var(--color-surface-2)',
          background: 'transparent',
        }}
      >
        {/* ── Drag overlay (Desktop Upload) ── */}
        {dragActive && (
          <div 
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-all duration-150 pointer-events-none"
            style={{
              background: 'rgba(30, 91, 63, 0.08)',
              backdropFilter: 'blur(3px)',
              borderColor: 'var(--color-accent)',
            }}
          >
            <div className="flex flex-col items-center justify-center p-6 rounded-xl border bg-[var(--color-surface-0)] shadow-lg max-w-[280px]" style={{ borderColor: 'var(--color-surface-3)' }}>
              <Upload className="animate-bounce" size={32} style={{ color: 'var(--color-accent)' }} />
              <span className="text-[13px] font-semibold mt-3 text-center" style={{ color: 'var(--color-text-primary)' }}>
                Drop files here to upload
              </span>
              <span className="text-[11px] mt-1 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                Files will be saved in Google Drive
              </span>
            </div>
          </div>
        )}

        {/* ── Empty folder ── */}
        {!dragActive && listRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
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
                Any document format up to 20MB
              </p>
            </div>
          </div>
        )}

        {/* ── Grid view (Double-click enters, Single-click expands, Drag & Drop to Move) ── */}
        {!dragActive && renderedItems.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3 items-start">
            {renderedItems.map((file, idx) => {
              const { Icon, color } = getFileIcon(file.mimeType, file.isFolder)
              const isFocused = focusIdx === idx
              const isUploading = !!file.isUploading
              const progress = file.progress ?? 0
              const status = file.status ?? 'uploading'
              
              const isExpanded = expandedFolders.has(file.id)
              const isLoadingCount = loadingFolderCounts.has(file.id)
              
              const children = folderContents[file.id] ?? []
              const childFoldersCount = children.filter((c) => c.isFolder).length
              const childFilesCount = children.filter((c) => !c.isFolder).length
              const isCollected = childFilesCount > 0
              
              const isTargetFolderActive = activeDropFolderId === file.id

              if (isUploading) {
                return (
                  <div
                    key={file.id}
                    className="flex flex-col items-center gap-2.5 p-3 rounded-lg border select-none transition-all duration-200"
                    style={{
                      borderColor: 'var(--color-surface-2)',
                      background: 'var(--color-surface-1)',
                      opacity: 0.85,
                    }}
                  >
                    <div className="w-[32px] h-[32px] flex items-center justify-center relative">
                      <LoadingSpinner size="sm" />
                      <span className="absolute text-[8px] font-semibold font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                        {progress}%
                      </span>
                    </div>
                    <div className="text-center w-full min-w-0">
                      <p className="text-[11px] font-medium leading-tight truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {file.name}
                      </p>
                      <div className="w-full mt-2.5 h-1 rounded-full overflow-hidden bg-[var(--color-surface-2)]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${progress}%`,
                            background: status === 'error' ? 'var(--color-danger-solid)' : 'var(--color-accent)',
                          }}
                        />
                      </div>
                      <p className="text-[9px] mt-1 text-center font-medium" style={{ color: status === 'error' ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)' }}>
                        {status === 'completed' ? 'Completed' : status === 'error' ? 'Failed' : `Uploading...`}
                      </p>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={file.id}
                  draggable={!file.isUploading}
                  onDragStart={(e) => handleDragStart(e, file)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => { if (file.isFolder) handleDragOverFolder(e, file) }}
                  onDragLeave={(e) => { if (file.isFolder) handleDragLeaveFolder(e, file) }}
                  onDrop={(e) => { if (file.isFolder) handleDropOnFolder(e, file) }}
                  className="group flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 cursor-pointer relative shadow-xs"
                  style={{
                    borderColor: isFocused || isTargetFolderActive 
                      ? 'var(--color-accent)' 
                      : 'var(--color-surface-3)',
                    background: isFocused || isTargetFolderActive 
                      ? 'var(--color-accent-bg)' 
                      : 'var(--color-surface-0)',
                  }}
                  onClick={(e) => {
                    if (file.isFolder) {
                      toggleFolderExpanded(file.id, e)
                    } else {
                      window.open(file.webViewLink ?? '#', '_blank')
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (file.isFolder) {
                      navigateTo(file.id, file.name)
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!isFocused && !isTargetFolderActive) {
                      e.currentTarget.style.borderColor = 'var(--color-accent)'
                      e.currentTarget.style.background = 'var(--color-accent-bg)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isFocused && !isTargetFolderActive) {
                      e.currentTarget.style.borderColor = 'var(--color-surface-3)'
                      e.currentTarget.style.background = 'var(--color-surface-0)'
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = 'var(--shadow-xs)'
                    }
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setMenuFile(file) }}
                >
                  {/* Tree chevron for expansion (top right inside card) */}
                  {file.isFolder && (
                    <button
                      onClick={(e) => toggleFolderExpanded(file.id, e)}
                      className="absolute right-1 top-7 h-5 w-5 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </button>
                  )}

                  <Icon size={28} style={{ color }} />
                  
                  <div className="text-center w-full min-w-0">
                    <p className="text-[12px] font-medium leading-tight line-clamp-2 break-words" style={{ color: 'var(--color-text-primary)' }}>
                      {file.name}
                    </p>
                    
                    {file.isFolder ? (
                      <p className="text-[10px] mt-0.5 select-none" style={{ color: isCollected ? 'var(--color-success-text)' : 'var(--color-text-tertiary)' }}>
                        {isLoadingCount ? 'loading...' : formatFileFolderCount(childFilesCount, childFoldersCount)}
                      </p>
                    ) : (
                      file.modifiedTime && (
                        <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                          {relativeTime(file.modifiedTime)}
                        </p>
                      )
                    )}
                  </div>
                  
                  {/* Checkbox overlay in top-left */}
                  <div 
                    className={`absolute left-1.5 top-1.5 z-10 transition-opacity duration-150 ${
                      selectedFileIds.has(file.id) 
                        ? 'opacity-100 pointer-events-auto' 
                        : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedFileIds.has(file.id)}
                      onCheckedChange={(checked) => handleToggleSelect(file.id, !!checked)}
                      className="border-[var(--color-surface-3)] bg-[var(--color-surface-0)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)] h-4 w-4 shadow-sm"
                    />
                  </div>

                  {/* Folder checklist indicator on card */}
                  {file.isFolder && (
                    <div 
                      className={`absolute left-1.5 top-1.5 transition-opacity duration-150 ${
                        selectedFileIds.has(file.id) 
                          ? 'opacity-0 pointer-events-none' 
                          : 'opacity-100 group-hover:opacity-0'
                      }`}
                      onClick={(e) => toggleFolderExpanded(file.id, e)}
                    >
                      {isLoadingCount ? (
                        <LoadingSpinner size="sm" />
                      ) : isCollected ? (
                        <div className="w-4.5 h-4.5 rounded-full flex items-center justify-center bg-[var(--color-success)] text-[var(--color-text-inverse)] shadow-xs">
                          <Check size={9} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-4.5 h-4.5 rounded-full border border-[var(--color-surface-3)] bg-transparent" />
                      )}
                    </div>
                  )}

                  <div className="absolute right-1 top-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuFile(menuFile?.id === file.id ? null : file) }}
                      className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--color-surface-1)]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <MoreHorizontal size={13} />
                    </button>
                    {menuFile?.id === file.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-7 z-20 w-36 rounded-md border py-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
                        style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); startRename(file) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--color-surface-1)] transition-colors"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          <Pencil size={11} /> Rename
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); setMenuFile(null) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--color-surface-1)] transition-colors"
                          style={{ color: 'var(--color-danger-text)' }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                        {file.isFolder && (
                          <button
                            onClick={(e) => { e.stopPropagation(); triggerCreateSubfolder(file.id, e); setMenuFile(null) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--color-surface-1)] transition-colors"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            <FolderPlus size={11} /> Add Subfolder
                          </button>
                        )}
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
                      </div>
                    )}
                  </div>

                  {/* Expanded child files nested directly inside folder card in Grid View */}
                  {file.isFolder && isExpanded && (
                    <div 
                      className="w-full border-t mt-3 pt-2.5 space-y-1 text-left animate-in fade-in slide-in-from-top-1 duration-150" 
                      style={{ borderColor: 'var(--color-surface-2)' }}
                      onClick={(e) => e.stopPropagation()} // prevent clicks from toggling card
                    >
                      {isLoadingCount ? (
                        <div className="flex items-center justify-center py-2">
                          <LoadingSpinner size="sm" />
                        </div>
                      ) : (childFilesCount === 0 && childFoldersCount === 0) ? (
                        <p className="text-[10px] text-center py-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                          No files uploaded
                        </p>
                      ) : (
                        <div className="space-y-0.5 max-h-[160px] overflow-y-auto pr-1">
                          {(folderContents[file.id] ?? []).map((child) => {
                            const childIconInfo = getFileIcon(child.mimeType, child.isFolder)
                            return (
                              <div
                                key={child.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, child)}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.open(child.webViewLink ?? '#', '_blank')
                                }}
                                className="group/child flex items-center gap-2 px-2 py-1 rounded border border-transparent transition-all duration-150 cursor-pointer hover:bg-[var(--color-surface-1)] hover:border-[var(--color-surface-3)] relative"
                              >
                                {/* Nested item checkbox */}
                                <div 
                                  className={`flex-shrink-0 transition-opacity duration-150 mr-1.5 ${
                                    selectedFileIds.has(child.id) 
                                      ? 'opacity-100 pointer-events-auto' 
                                      : 'opacity-0 pointer-events-none group-hover/child:opacity-100 group-hover/child:pointer-events-auto'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={selectedFileIds.has(child.id)}
                                    onCheckedChange={(checked) => handleToggleSelect(child.id, !!checked)}
                                    className="border-[var(--color-surface-3)] bg-[var(--color-surface-0)] data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)] h-3 w-3"
                                  />
                                </div>

                                <childIconInfo.Icon size={12} style={{ color: childIconInfo.color }} />
                                <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--color-text-primary)' }}>
                                  {child.name}
                                </span>
                                
                                <div className="flex items-center gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => startRename(child)}
                                    className="p-0.5 rounded hover:bg-[var(--color-surface-2)]"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                  >
                                    <Pencil size={9} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget(child)}
                                    className="p-0.5 rounded hover:bg-[var(--color-surface-2)]"
                                    style={{ color: 'var(--color-danger-text)' }}
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                </div>
                                
                                {child.size && (
                                  <span className="text-[9px] font-mono select-none group-hover/child:hidden" style={{ color: 'var(--color-text-tertiary)' }}>
                                    {formatFileSize(child.size)}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── List view (Tree View with Inline Expand/Collapse, Guide Lines, Checklists & Outlines) ── */}
        {!dragActive && listRows.length > 0 && viewMode === 'list' && (
          <div className="space-y-1.5 p-2" style={{ borderColor: 'var(--color-surface-2)' }}>
            {listRows.map(({ item: file, depth, parentFolderId, isLastChild, ancestorsIsLast }, idx) => {
              const { Icon, color } = getFileIcon(file.mimeType, file.isFolder)
              const isFocused = focusIdx === idx
              const isUploading = !!file.isUploading
              const progress = file.progress ?? 0
              const status = file.status ?? 'uploading'
              
              const isExpanded = expandedFolders.has(file.id)
              const isLoadingCount = loadingFolderCounts.has(file.id)
              
              const children = folderContents[file.id] ?? []
              const childFoldersCount = children.filter((c) => c.isFolder).length
              const childFilesCount = children.filter((c) => !c.isFolder).length
              const isCollected = childFilesCount > 0

              const isFolderChecklist = file.isFolder && depth === 0
              const isTargetFolderActive = activeDropFolderId === file.id

              if (isUploading) {
                return (
                  <div
                    key={file.id}
                    className="flex items-center"
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
                                <div className="absolute top-1/2 left-3 w-3.5 h-[1px] bg-[var(--color-surface-3)]" />
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

                    <div
                      className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg border select-none transition-all duration-200"
                      style={{
                        borderColor: 'var(--color-surface-2)',
                        background: 'var(--color-surface-1)',
                        opacity: 0.85,
                      }}
                    >
                      <div className="flex-shrink-0 w-[26px] h-[26px] flex items-center justify-center">
                        <LoadingSpinner size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 max-w-[200px]">
                          <div className="flex-1 h-1 rounded-full overflow-hidden bg-[var(--color-surface-2)]">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${progress}%`,
                                background: status === 'error' ? 'var(--color-danger-solid)' : 'var(--color-accent)',
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-mono select-none" style={{ color: status === 'error' ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)' }}>
                            {progress}%
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium mr-4" style={{ color: status === 'error' ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)' }}>
                        {status === 'completed' ? 'Completed' : status === 'error' ? 'Error' : 'Uploading...'}
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={file.id}
                  className="flex items-center"
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
                    draggable={!file.isUploading}
                    onDragStart={(e) => handleDragStart(e, file)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => { if (file.isFolder) handleDragOverFolder(e, file) }}
                    onDragLeave={(e) => { if (file.isFolder) handleDragLeaveFolder(e, file) }}
                    onDrop={(e) => { if (file.isFolder) handleDropOnFolder(e, file) }}
                    className="group flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer relative shadow-xs"
                    style={{
                      borderColor: isFocused || isTargetFolderActive
                        ? 'var(--color-accent)' 
                        : 'var(--color-surface-3)',
                      background: isFocused || isTargetFolderActive
                        ? 'var(--color-accent-bg)' 
                        : 'var(--color-surface-0)',
                    }}
                    onClick={(e) => {
                      if (renameTarget?.id === file.id) return
                      if (file.isFolder) {
                        toggleFolderExpanded(file.id, e)
                      } else {
                        window.open(file.webViewLink ?? '#', '_blank')
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isFocused && !isTargetFolderActive) {
                        e.currentTarget.style.borderColor = 'var(--color-accent)'
                        e.currentTarget.style.background = 'var(--color-accent-bg)'
                        e.currentTarget.style.transform = 'translateY(-0.5px)'
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isFocused && !isTargetFolderActive) {
                        e.currentTarget.style.borderColor = 'var(--color-surface-3)'
                        e.currentTarget.style.background = 'var(--color-surface-0)'
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.boxShadow = 'var(--shadow-xs)'
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
                        className="w-4.5 h-4.5 flex items-center justify-center rounded hover:bg-[var(--color-surface-2)] transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown size={13} style={{ color: 'var(--color-text-secondary)' }} />
                        ) : (
                          <ChevronRight size={13} style={{ color: 'var(--color-text-secondary)' }} />
                        )}
                      </button>
                    ) : (
                      <div className="w-4.5" /> // spacer
                    )}

                    {/* Checklist checkbox indicator for folders */}
                    {isFolderChecklist && (
                      <div className="flex-shrink-0" onClick={(e) => toggleFolderExpanded(file.id, e)}>
                        {isLoadingCount ? (
                          <LoadingSpinner size="sm" />
                        ) : isCollected ? (
                          <div className="w-4.5 h-4.5 rounded-full flex items-center justify-center bg-[var(--color-success)] text-[var(--color-text-inverse)] shadow-xs mr-0.5">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-4.5 h-4.5 rounded-full border border-[var(--color-surface-3)] bg-transparent hover:border-[var(--color-accent)] mr-0.5" />
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

                    {/* Size column (desktop, file only) */}
                    {!file.isFolder && file.size && (
                      <span className="hidden md:block w-[70px] text-right text-[11px] font-mono select-none" style={{ color: 'var(--color-text-tertiary)' }}>
                        {formatFileSize(file.size)}
                      </span>
                    )}
                    {/* Modified column (desktop, file only) */}
                    {!file.isFolder && file.modifiedTime && (
                      <span className="hidden lg:block w-[110px] text-right text-[11px] font-mono select-none" style={{ color: 'var(--color-text-tertiary)' }}>
                        {relativeTime(file.modifiedTime)}
                      </span>
                    )}

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
                            onClick={() => setMenuFile(menuFile?.id === file.id ? null : file)}
                          >
                            <MoreHorizontal size={13} />
                          </button>
                        </>
                      )}
                      {/* Dropdown */}
                      {menuFile?.id === file.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-7 z-20 w-36 rounded-md border py-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
                          style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-surface-2)' }}
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
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--color-danger-text)] transition-colors"
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
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
    </div>
  )
}
