import { google } from 'googleapis'
import { getAuthedClientByConnection } from './oauth'

export async function createDealFolder(
  connectionId: string,
  dealName: string,
  parentFolderId?: string
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
