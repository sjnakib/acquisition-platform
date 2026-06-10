import { Readable } from 'stream'
import { google } from 'googleapis'
import { getAuthedClientByConnection } from './oauth'

// ── Types ──

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  size: string | null
  modifiedTime: string | null
  isFolder: boolean
}

export interface ListFilesResult {
  files: DriveFile[]
  nextPageToken: string | null
}

// ── Helpers ──

function mapDriveFile(f: {
  id?: string | null
  name?: string | null
  mimeType?: string | null
  webViewLink?: string | null
  size?: string | null
  modifiedTime?: string | null
}): DriveFile {
  return {
    id: f.id!,
    name: f.name ?? 'Untitled',
    mimeType: f.mimeType ?? 'application/octet-stream',
    webViewLink: f.webViewLink ?? null,
    size: f.size ?? null,
    modifiedTime: f.modifiedTime ?? null,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }
}

// ── CRUD ──

export async function getDriveFolderInfo(
  connectionId: string,
  folderId: string,
): Promise<{ folderId: string; folderUrl: string; name: string }> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, webViewLink',
  })

  return {
    folderId: res.data.id!,
    folderUrl: res.data.webViewLink!,
    name: res.data.name ?? 'Untitled',
  }
}

export async function listDriveFiles(
  connectionId: string,
  folderId: string,
  pageToken?: string | null,
): Promise<ListFilesResult> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'nextPageToken, files(id, name, mimeType, webViewLink, size, modifiedTime)',
    pageSize: 100,
    pageToken: pageToken ?? undefined,
    orderBy: 'folder, name',
  })

  return {
    files: (res.data.files ?? []).map(mapDriveFile),
    nextPageToken: res.data.nextPageToken ?? null,
  }
}

export async function createDriveFolder(
  connectionId: string,
  parentFolderId: string,
  folderName: string,
  makePublic: boolean = true,
): Promise<{ folderId: string; folderUrl: string }> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id, webViewLink',
  })

  const folderId = folder.data.id!
  const folderUrl = folder.data.webViewLink!

  if (makePublic) {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: { role: 'reader', type: 'anyone' },
    })
  }

  return { folderId, folderUrl }
}

export async function createDealFolder(
  connectionId: string,
  dealName: string,
  parentFolderId?: string,
): Promise<{ folderId: string; folderUrl: string }> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  const folder = await drive.files.create({
    requestBody: {
      name: dealName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: 'id, webViewLink',
  })

  await drive.permissions.create({
    fileId: folder.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  return {
    folderId: folder.data.id!,
    folderUrl: folder.data.webViewLink!,
  }
}

export async function uploadFileToDrive(
  connectionId: string,
  parentFolderId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ fileId: string; webViewLink: string }> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: bufferToStream(fileBuffer),
    },
    fields: 'id, webViewLink',
  })

  return {
    fileId: res.data.id!,
    webViewLink: res.data.webViewLink!,
  }
}

export async function deleteDriveFile(
  connectionId: string,
  fileId: string,
): Promise<void> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
  })
}

export async function untrashDriveFile(
  connectionId: string,
  fileId: string,
): Promise<void> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  await drive.files.update({
    fileId,
    requestBody: { trashed: false },
  })
}

export async function moveDriveFile(
  connectionId: string,
  fileId: string,
  newParentFolderId: string,
): Promise<void> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  const file = await drive.files.get({
    fileId,
    fields: 'parents',
  })
  const previousParents = file.data.parents?.join(',')

  await drive.files.update({
    fileId,
    addParents: newParentFolderId,
    removeParents: previousParents || undefined,
    fields: 'id, parents',
  })
}

export async function renameDriveFile(
  connectionId: string,
  fileId: string,
  newName: string,
): Promise<DriveFile> {
  const auth = await getAuthedClientByConnection(connectionId)
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.update({
    fileId,
    requestBody: { name: newName },
    fields: 'id, name, mimeType, webViewLink, size, modifiedTime',
  })

  return mapDriveFile(res.data)
}

function bufferToStream(buffer: Buffer): Readable {
  return Readable.from(buffer)
}
