import type { drive_v3 } from 'googleapis'
import { Readable } from 'stream'

// Google Drive access via service account — the accounting folder is
// shared directly with the SA's email, so no OAuth consent/verification
// is needed. GOOGLE_SERVICE_ACCOUNT_KEY holds the full JSON key;
// GOOGLE_ACCOUNTING_FOLDER_ID is the root folder containing year folders
// (2026/…) with month subfolders inside.
// googleapis is lazy-imported so this module never fails to load.

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
}

let _drive: drive_v3.Drive | null = null
async function getDrive(): Promise<drive_v3.Drive> {
  if (_drive) return _drive
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured')
  const { google } = await import('googleapis')
  const creds = JSON.parse(raw)
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  _drive = google.drive({ version: 'v3', auth })
  return _drive
}

export function rootFolderId(): string {
  const id = process.env.GOOGLE_ACCOUNTING_FOLDER_ID
  if (!id) throw new Error('GOOGLE_ACCOUNTING_FOLDER_ID is not configured')
  return id
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const drive = await getDrive()
  const files: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    for (const f of res.data.files || []) {
      files.push({ id: f.id!, name: f.name!, mimeType: f.mimeType!, modifiedTime: f.modifiedTime ?? undefined })
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  return files
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Find a child folder by name, tolerating diacritics and aliases
 *  (e.g. month folders named "09", "9", "September", "wrzesień"). */
export async function findChildFolder(parentId: string, candidates: string[]): Promise<DriveFile | null> {
  const items = await listFolder(parentId)
  const folders = items.filter(i => i.mimeType === 'application/vnd.google-apps.folder')
  const wanted = candidates.map(norm)
  return folders.find(f => wanted.includes(norm(f.name))) ?? null
}

const MONTH_PL = ['styczen', 'luty', 'marzec', 'kwiecien', 'maj', 'czerwiec', 'lipiec', 'sierpien', 'wrzesien', 'pazdziernik', 'listopad', 'grudzien']
const MONTH_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** Accepts "09", "9", "09.2026", "2026-09", "September", "wrzesień", "Wrzesień 2026"… */
export function monthFolderCandidates(year: number, month: number): string[] {
  const mm = String(month).padStart(2, '0')
  return [
    mm, String(month), `${mm}.${year}`, `${year}-${mm}`,
    `${mm} ${year}`, `${year} ${mm}`,
    MONTH_PL[month - 1], MONTH_EN[month - 1],
    `${MONTH_PL[month - 1]} ${year}`, `${MONTH_EN[month - 1]} ${year}`,
    `${year} ${MONTH_PL[month - 1]}`, `${year} ${MONTH_EN[month - 1]}`,
  ]
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = await getDrive()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data as ArrayBuffer)
}

export async function uploadFile(folderId: string, name: string, mimeType: string, buf: Buffer): Promise<DriveFile> {
  const drive = await getDrive()
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType },
    media: { mimeType, body: Readable.from(buf) },
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  })
  return { id: res.data.id!, name: res.data.name!, mimeType: res.data.mimeType! }
}

export async function createFolder(parentId: string, name: string): Promise<DriveFile> {
  const drive = await getDrive()
  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id, name, mimeType',
    supportsAllDrives: true,
  })
  return { id: res.data.id!, name: res.data.name!, mimeType: res.data.mimeType! }
}
