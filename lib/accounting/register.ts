import JSZip from 'jszip'
import type { SaleRow } from './statement'

// Generates the monthly "ewidencja sprzedaży nierejestrowanej" xlsx by
// cloning the previous month's file and surgically rewriting the sheet XML —
// every style, merge, drawing and quirk of the Numbers export survives.
//
// Template layout (per analysis):
//   rows 15..61  — sale slots; C=lp, D=date, E=gross, F=rate, G/H=VAT/net
//                  formulas, I=description, J=payment id, K=channel
//   row 62       — SUMA with =SUM(E15:E61)
//   shared str   — "za miesiąc: <month>-<year>" title
//   sheet tab    — "MM.YYYY"

const MONTH_GENITIVE = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
]

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface CellSpec { ref: string; xml: string }

function cellXml(ref: string, style: string | null, value: string | number | null, inline = false): string {
  const s = style ? ` s="${style}"` : ''
  if (value === null || value === '') return `<c r="${ref}"${s}/>`
  if (inline) return `<c r="${ref}"${s} t="inlineStr"><is><t>${esc(String(value))}</t></is></c>`
  return `<c r="${ref}"${s}><v>${value}</v></c>`
}

/** Replace the contents of cells D..K in one <row> element, preserving each
 *  cell's existing style id and all untouched columns (A/B, L+). */
function rewriteDataRow(rowXml: string, r: number, sale: SaleRow | null, lp: number): string {
  const want: Record<string, string> = {}

  const styleOf = (col: string) => {
    const m = rowXml.match(new RegExp(`<c r="${col}${r}"(?: s="(\\d+)")?`))
    return m?.[1] ?? null
  }

  if (sale) {
    const net = Math.round((sale.gross / (1 + sale.vatRate)) * 100) / 100
    const vat = Math.round((sale.gross - net) * 100) / 100
    want.C = cellXml(`C${r}`, styleOf('C'), lp)
    want.D = cellXml(`D${r}`, styleOf('D'), sale.date, true)
    want.E = cellXml(`E${r}`, styleOf('E'), sale.gross)
    want.F = cellXml(`F${r}`, styleOf('F'), sale.vatRate)
    want.G = `<c r="G${r}"${styleOf('G') ? ` s="${styleOf('G')}"` : ''}><f>E${r}-H${r}</f><v>${vat}</v></c>`
    want.H = `<c r="H${r}"${styleOf('H') ? ` s="${styleOf('H')}"` : ''}><f>E${r}/1.23</f><v>${net}</v></c>`
    want.I = cellXml(`I${r}`, styleOf('I'), sale.description, true)
    want.J = cellXml(`J${r}`, styleOf('J'), sale.paymentId)
    want.K = cellXml(`K${r}`, styleOf('K'), sale.channel, true)
  } else {
    // clear D..K; C keeps the continuous lp numbering the template had
    want.C = cellXml(`C${r}`, styleOf('C'), lp)
    for (const col of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']) {
      want[col] = cellXml(`${col}${r}`, styleOf(col), null)
    }
  }

  return rowXml.replace(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (whole, col: string) =>
    want[col] !== undefined ? want[col] : whole
  )
}

export async function generateRegister(templateBuf: Buffer, year: number, month: number, sales: SaleRow[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuf)

  const wbFile = zip.file('xl/workbook.xml')
  if (!wbFile) throw new Error('Invalid xlsx: no workbook.xml')
  let wb = await wbFile.async('string')

  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string')

  // map sheet name → worksheet file via r:id
  const sheetMap: Record<string, string> = {}
  for (const m of wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
    const rel = rels.match(new RegExp(`<Relationship[^>]*Id="${m[2]}"[^>]*Target="([^"]+)"`))
    if (rel) sheetMap[m[1]] = 'xl/' + rel[1].replace(/^\//, '')
  }

  // pick the month sheet (name like "09.2026"), else the sheet that holds
  // the data grid (contains an =SUM(E15:E61)-style totals formula)
  const tabName = `${String(month).padStart(2, '0')}.${year}`
  let sheetName = Object.keys(sheetMap).find(n => /^\d{2}\.\d{4}$/.test(n))
  let sheetPath: string | undefined
  let sheetXml = ''

  if (sheetName) {
    sheetPath = sheetMap[sheetName]
    sheetXml = await zip.file(sheetPath)!.async('string')
  }
  if (!sheetXml || !/<f[^>]*>SUM\(E15:/.test(sheetXml)) {
    for (const [n, p] of Object.entries(sheetMap)) {
      const x = await zip.file(p)!.async('string')
      if (/<f[^>]*>SUM\(E15:/.test(x)) { sheetName = n; sheetPath = p; sheetXml = x; break }
    }
  }
  if (!sheetXml) throw new Error('Could not find the register sheet in the template')

  // rename the tab
  if (sheetName && sheetName !== tabName) {
    wb = wb.split(`name="${sheetName}"`).join(`name="${tabName}"`)
    zip.file('xl/workbook.xml', wb)
  }

  // update the "za miesiąc:" title shared string
  const ssFile = zip.file('xl/sharedStrings.xml')
  if (ssFile) {
    const ss = await ssFile.async('string')
    const title = `za miesiąc: ${MONTH_GENITIVE[month - 1]}-${year}`
    const next = ss.replace(/(<si>(?:<t[^>]*>)?)za miesiąc:[^<]*/, `$1${esc(title)}`)
    if (next !== ss) zip.file('xl/sharedStrings.xml', next)
  }

  // rewrite data rows 15..61
  const MAX = 61
  if (sales.length > MAX - 14) {
    throw new Error(`Too many rows (${sales.length}) — template only has ${MAX - 14} slots`)
  }
  sheetXml = sheetXml.replace(
    /<row[^>]*r="(\d+)"[^>]*>[\s\S]*?<\/row>/g,
    (whole, rnStr: string) => {
      const rn = Number(rnStr)
      if (rn < 15 || rn > MAX) return whole
      const idx = rn - 15
      return rewriteDataRow(whole, rn, sales[idx] ?? null, idx + 1)
    }
  )

  // refresh the cached SUMA total so it shows correctly before recalc
  const total = Math.round(sales.reduce((a, s) => a + s.gross, 0) * 100) / 100
  sheetXml = sheetXml.replace(/(<f>SUM\(E15:E\d+\)<\/f><v>)[^<]*/, `$1${total}`)

  zip.file(sheetPath!, sheetXml)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
