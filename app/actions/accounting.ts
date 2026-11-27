'use server'

import { getAccess } from '@/lib/access'
import {
  rootFolderId, listFolder, findChildFolder, monthFolderCandidates,
  downloadFile, uploadFile, type DriveFile,
} from '@/lib/drive'
import { parseStatementText, type SaleRow } from '@/lib/accounting/statement'
import { generateRegister } from '@/lib/accounting/register'

const MONTH_PL = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
]

async function requireAdmin() {
  const access = await getAccess()
  if (!access?.canAdmin) throw new Error('Admin access required')
}

async function yearFolder(year: number): Promise<DriveFile | null> {
  return findChildFolder(rootFolderId(), [String(year)])
}

async function monthFolder(year: number, month: number): Promise<DriveFile | null> {
  const yf = await yearFolder(year)
  if (!yf) return null
  return findChildFolder(yf.id, monthFolderCandidates(year, month))
}

// ---------------------------------------------------------------------------

export interface AccountingYear { name: string; months: string[] }

export async function listAccountingYears(): Promise<AccountingYear[]> {
  await requireAdmin()
  const years = (await listFolder(rootFolderId()))
    .filter(f => f.mimeType === 'application/vnd.google-apps.folder' && /^\d{4}$/.test(f.name))
    .sort((a, b) => b.name.localeCompare(a.name))
  const out: AccountingYear[] = []
  for (const y of years) {
    const kids = await listFolder(y.id)
    out.push({
      name: y.name,
      months: kids.filter(k => k.mimeType === 'application/vnd.google-apps.folder').map(k => k.name),
    })
  }
  return out
}

export interface MonthDoc extends DriveFile { kind: 'statement' | 'register' | 'invoice' | 'other' }

function classify(f: DriveFile): MonthDoc['kind'] {
  const n = f.name.toLowerCase()
  if (/\.xlsx$/.test(n)) {
    if (/ewidencja|sprzeda|register/.test(n)) return 'register'
    return 'other'
  }
  if (/wycia|statement|\d{4}_\d{8}|_8097/.test(n)) return 'statement'
  if (/\.pdf$/.test(n)) return 'invoice'
  return 'other'
}

export interface MonthScan {
  docs: MonthDoc[]
  sales: SaleRow[]
  statementFound: boolean
  templateAvailable: boolean
  folderName: string
}

export async function scanAccountingMonth(year: number, month: number): Promise<MonthScan> {
  await requireAdmin()
  const mf = await monthFolder(year, month)
  if (!mf) throw new Error(`No ${month}/${year} folder found in Drive`)

  const files = await listFolder(mf.id)
  const docs: MonthDoc[] = files
    .filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
    .map(f => ({ ...f, kind: classify(f) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // parse the bank statement → sale candidates
  let sales: SaleRow[] = []
  const stmt = docs.find(d => d.kind === 'statement')
  if (stmt) {
    const buf = await downloadFile(stmt.id)
    const { extractText } = await import('unpdf')
    const { text } = await extractText(new Uint8Array(buf))
    sales = parseStatementText(Array.isArray(text) ? text.join('\n') : text)
  }

  const templateAvailable = !!(await findTemplate(year, month, docs))
  return { docs, sales, statementFound: !!stmt, templateAvailable, folderName: mf.name }
}

/** Template xlsx to clone — prefer a register already sitting in the target
 *  month folder, else walk back through previous months for the last one. */
async function findTemplate(year: number, month: number, docs: MonthDoc[]): Promise<DriveFile | null> {
  const here = docs.find(d => d.kind === 'register')
  if (here) return here
  let y = year, m = month - 1
  for (let i = 0; i < 14; i++) {
    if (m === 0) { m = 12; y-- }
    const mf = await monthFolder(y, m)
    if (mf) {
      const files = await listFolder(mf.id)
      const reg = files
        .filter(f => /\.xlsx$/i.test(f.name) && /ewidencja|sprzeda|register/i.test(f.name))
        .sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))[0]
      if (reg) return reg
    }
    m--
  }
  return null
}

export interface GenerateResult {
  fileName: string
  driveFileId: string
  rowCount: number
  totalGross: number
}

export async function generateAccountingRegister(
  year: number, month: number, sales: SaleRow[],
): Promise<GenerateResult> {
  await requireAdmin()
  const mf = await monthFolder(year, month)
  if (!mf) throw new Error(`No ${month}/${year} folder found in Drive`)

  const files = await listFolder(mf.id)
  const docs = files.map(f => ({ ...f, kind: classify(f) }))
  const template = await findTemplate(year, month, docs)
  if (!template) throw new Error('No register xlsx found in this or previous months to use as a template')

  const buf = await downloadFile(template.id)
  const included = sales.filter(s => s.include !== false)
  const out = await generateRegister(buf, year, month, included)

  const fileName = `${MONTH_PL[month - 1]} ${year} - Ewidencja sprzedaży BEZ KASY FISKALNEJ z VAT.xlsx`
  const uploaded = await uploadFile(
    mf.id, fileName,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', out,
  )

  return {
    fileName,
    driveFileId: uploaded.id,
    rowCount: included.length,
    totalGross: Math.round(included.reduce((a, s) => a + s.gross, 0) * 100) / 100,
  }
}
