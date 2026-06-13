// Browser File System API utilities for directory drag-and-drop traversal.
//
// Uses the webkit-prefixed FileSystemEntry API (DataTransferItem.webkitGetAsEntry),
// supported in Chrome 13+, Firefox 50+, Edge 14+, Safari 11.1+.

// ── Augment TS lib types (createReader + FileSystemDirectoryReader are missing) ──

declare global {
  interface FileSystemDirectoryEntry {
    createReader(): FileSystemDirectoryReader
  }
}

interface FileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (err: Error) => void,
  ): void
}

// ── Public types ──

export interface TraversedFile {
  relativePath: string // e.g. "MyProject/docs/report.pdf"
  file: File
}

export interface TraverseResult {
  files: TraversedFile[]
  emptyFolderPaths: string[] // folder paths with zero descendant files
}

// ── Constants ──

const DEFAULT_MAX_DEPTH = 20
const YIELD_EVERY_N_ENTRIES = 50

// ── Helpers ──

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject)
  })
}

function getFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

/**
 * Recursively traverse a FileSystemDirectoryEntry, collecting all files and
 * identifying empty folder paths.
 *
 * The readEntries API returns entries in batches — this loops until the
 * directory is fully read. Pass an `entriesProcessed` counter to yield
 * periodically for large directories.
 */
export async function traverseDirectory(
  entry: FileSystemDirectoryEntry,
  pathPrefix: string,
  depth = 0,
  maxDepth = DEFAULT_MAX_DEPTH,
  _entriesProcessed?: { count: number },
): Promise<TraverseResult> {
  if (depth > maxDepth) {
    console.warn(
      `Max depth (${maxDepth}) reached at "${pathPrefix}" — skipping deeper entries`,
    )
    return { files: [], emptyFolderPaths: [] }
  }

  const reader = entry.createReader()
  const allEntries: FileSystemEntry[] = []
  const counter = _entriesProcessed ?? { count: 0 }

  // readEntries must be called in a loop — it may return partial batches
  while (true) {
    const entries = await readEntries(reader)
    if (entries.length === 0) break
    allEntries.push(...entries)

    // Cooperative yielding — prevent main-thread blocking for large directories
    counter.count += entries.length
    if (counter.count % YIELD_EVERY_N_ENTRIES === 0) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  const files: TraversedFile[] = []
  const emptyFolderPaths: string[] = []
  let hasContent = false

  for (const child of allEntries) {
    if (child.isFile) {
      try {
        const file = await getFile(child as FileSystemFileEntry)
        files.push({ relativePath: `${pathPrefix}/${child.name}`, file })
        hasContent = true
      } catch {
        console.warn(`Could not read file: ${child.name}`)
      }
    } else if (child.isDirectory) {
      const sub = await traverseDirectory(
        child as FileSystemDirectoryEntry,
        `${pathPrefix}/${child.name}`,
        depth + 1,
        maxDepth,
        counter,
      )
      files.push(...sub.files)
      emptyFolderPaths.push(...sub.emptyFolderPaths)
      if (sub.files.length > 0 || sub.emptyFolderPaths.length > 0) {
        hasContent = true
      }
    }
  }

  // If this directory had zero content (no files, no non-empty subdirs),
  // mark it as an empty folder to be created
  if (!hasContent) {
    emptyFolderPaths.push(pathPrefix)
  }

  return { files, emptyFolderPaths }
}

/**
 * Check whether the browser supports directory drop via webkitGetAsEntry.
 */
export function supportsDirectoryDrop(): boolean {
  try {
    return (
      typeof DataTransferItem !== 'undefined' &&
      'webkitGetAsEntry' in DataTransferItem.prototype
    )
  } catch {
    return false
  }
}
