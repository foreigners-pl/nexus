import { jsPDF } from 'jspdf'
import { INVOICE_LOGO_DATA_URI, INVOICE_LOGO_RATIO } from './invoice-logo'

export interface InvoiceBillTo {
  name?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  nip?: string | null
}

export interface InvoicePdfInput {
  docNumber: string
  itemName: string
  serviceNames?: string
  amount: number
  discountAmount?: number | null
  discountNotes?: string | null
  issueDate: string
  dueDate: string
  company: {
    name?: string | null
    address?: string | null
    taxId?: string | null
    email?: string | null
    phone?: string | null
    bankName?: string | null
    bankAccount?: string | null
    swift?: string | null
    krs?: string | null
    regon?: string | null
    accountHolder?: string | null
  }
  billTo: InvoiceBillTo
  paymentMethod?: string | null
  paymentLink?: string | null
  isReceipt?: boolean
  paidDate?: string | null
}

const PAGE_W = 210 // A4 mm
const PAGE_H = 297
const MARGIN = 18
const RIGHT = PAGE_W - MARGIN

export function buildInvoicePdf(input: InvoicePdfInput): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { company: c, billTo: b, isReceipt } = input

  const black = () => doc.setTextColor(17, 24, 39)
  const muted = () => doc.setTextColor(107, 114, 128)
  const pln = (n: number) => `PLN ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const rule = (y: number, w = 0.4, color: [number, number, number] = [209, 213, 219]) => {
    doc.setDrawColor(...color); doc.setLineWidth(w); doc.line(MARGIN, y, RIGHT, y)
  }

  const method = input.paymentMethod || ''
  const methodLabel = method === 'bank_transfer' ? 'Bank Transfer'
    : method === 'cash' || method === 'manual' ? 'Cash'
    : method === 'online' ? 'Online' : method || '—'
  const showBank = !isReceipt && method !== 'cash' && method !== 'manual' && !!c.bankAccount
  const discount = input.discountAmount || 0
  const original = input.amount + discount

  let y = 20

  // ---- Header: logo left, doc title right
  const logoW = 52
  const logoH = logoW * INVOICE_LOGO_RATIO
  doc.addImage(INVOICE_LOGO_DATA_URI, 'PNG', MARGIN, y - 4, logoW, logoH)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  muted()
  doc.text(isReceipt ? 'P A Y M E N T   R E C E I P T' : 'I N V O I C E', RIGHT, y, { align: 'right' })
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  black()
  const titleLines = doc.splitTextToSize(input.itemName, 100)
  doc.text(titleLines, RIGHT, y + 6, { align: 'right' })
  let ty = y + 6 + titleLines.length * 6
  if (input.serviceNames && input.serviceNames !== 'Services') {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    muted()
    doc.text(input.serviceNames, RIGHT, ty, { align: 'right' })
    ty += 5
  }

  y = Math.max(y + logoH, ty) + 6
  rule(y, 0.5)
  y += 8

  // ---- Meta grid (2 cols x 2 rows)
  const meta: [string, string][] = [
    [isReceipt ? 'RECEIPT NO.' : 'INVOICE NO.', input.docNumber],
    [isReceipt ? 'PAID DATE' : 'DUE DATE', isReceipt ? (input.paidDate || '—') : input.dueDate],
    ['CLIENT', b.company || b.name || '—'],
    ['METHOD', methodLabel],
  ]
  const colW = (RIGHT - MARGIN) / 2
  meta.forEach(([label, value], i) => {
    const x = MARGIN + (i % 2) * colW
    const yy = y + Math.floor(i / 2) * 11
    doc.setFontSize(7)
    muted()
    doc.text(label, x, yy)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    black()
    doc.text(doc.splitTextToSize(value, colW - 8), x, yy + 4.5)
    doc.setFont('helvetica', 'normal')
  })
  y += 24

  // ---- Bill to
  doc.setFontSize(7)
  muted()
  doc.text('BILL TO', MARGIN, y)
  y += 4.5
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  black()
  doc.text(b.company || b.name || 'Client', MARGIN, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  muted()
  const billLines = [
    b.company ? b.name : null,
    b.address,
    b.nip ? `NIP: ${b.nip}` : null,
    b.email,
    b.phone,
  ].filter(Boolean) as string[]
  for (const line of billLines) {
    const wrapped = doc.splitTextToSize(line, 120)
    doc.text(wrapped, MARGIN, y)
    y += wrapped.length * 4.5
  }
  y += 8

  // ---- Amounts
  const amountRow = (label: string, value: string, bold = false, isTotal = false) => {
    doc.setFontSize(isTotal ? 12 : 10)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    if (bold) black(); else muted()
    doc.text(label, MARGIN, y)
    doc.text(value, RIGHT, y, { align: 'right' })
    y += isTotal ? 4 : 5
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(isTotal ? 0.7 : 0.3)
    doc.setLineDashPattern(isTotal ? [] : [1, 1.5], 0)
    doc.line(MARGIN, y, RIGHT, y)
    doc.setLineDashPattern([], 0)
    y += 7
  }

  if (discount > 0) {
    amountRow('Original Amount', pln(original))
    amountRow('Discount', `-${pln(discount)}`)
    if (input.discountNotes) amountRow('Discount Notes', input.discountNotes)
  }
  amountRow(isReceipt ? 'Amount Received' : 'Amount Due', pln(input.amount), true, true)
  y += 4

  // ---- Payment details box
  const payLines: [string, string][] = []
  if (isReceipt) {
    payLines.push(['STATUS', 'Payment received in full'])
    payLines.push(['METHOD', methodLabel])
  } else if (showBank) {
    if (c.bankName) payLines.push(['BANK', c.bankName])
    payLines.push(['ACCOUNT HOLDER', c.accountHolder || c.name || ''])
    payLines.push(['IBAN', c.bankAccount!])
    if (c.swift) payLines.push(['SWIFT/BIC', c.swift])
    payLines.push(['REFERENCE', input.docNumber])
  } else if (method === 'online' && input.paymentLink) {
    payLines.push(['PAY ONLINE', input.paymentLink])
  } else if (method === 'cash') {
    payLines.push(['NOTE', 'Please pay in cash at our office.'])
  } else {
    payLines.push(['NOTE', 'Please contact us for payment instructions.'])
    payLines.push(['REFERENCE', input.docNumber])
  }

  const boxH = payLines.length * 6 + 12
  doc.setFillColor(249, 250, 251)
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, boxH, 2, 2, 'FD')
  let by = y + 7
  doc.setFontSize(7)
  muted()
  doc.text('PAYMENT DETAILS', MARGIN + 5, by)
  by += 6
  payLines.forEach(([label, value]) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    muted()
    doc.text(label, MARGIN + 5, by)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    black()
    doc.text(doc.splitTextToSize(value, 125), MARGIN + 42, by)
    by += 6
    doc.setFont('helvetica', 'normal')
  })

  // ---- Legal footer pinned near the bottom
  const legalLine = [c.taxId ? `NIP: ${c.taxId}` : null, c.krs ? `KRS: ${c.krs}` : null, c.regon ? `REGON: ${c.regon}` : null].filter(Boolean).join('  ·  ')
  const footerLines = [
    c.accountHolder || c.name || null,
    legalLine || null,
    c.address || null,
    c.email || null,
  ].filter(Boolean) as string[]

  let fy = PAGE_H - 14 - footerLines.length * 4.5
  rule(fy - 4, 0.5)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  black()
  doc.text((c.name || '').toUpperCase(), MARGIN, fy)
  fy += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  muted()
  for (const line of footerLines) {
    doc.text(line, MARGIN, fy)
    fy += 4.5
  }

  return doc.output('arraybuffer')
}
