import { jsPDF } from 'jspdf'

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
  }
  billTo: InvoiceBillTo
  paymentMethod?: string | null
  paymentLink?: string | null
  isReceipt?: boolean
  paidDate?: string | null
}

const PAGE_W = 210 // A4 mm
const MARGIN = 20
const RIGHT = PAGE_W - MARGIN

export function buildInvoicePdf(input: InvoicePdfInput): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { company: c, billTo: b, isReceipt } = input

  const gray = (v: number) => { doc.setTextColor(v, v, v) }
  const black = () => { doc.setTextColor(17, 24, 39) }
  const muted = () => gray(107)
  const money = (n: number) => `${Math.abs(n).toFixed(2)} PLN`

  let y = 28

  // ---- Header: company block (left) + doc meta (right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  black()
  doc.text(c.name || 'Company', MARGIN, y)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  muted()
  let cy = y + 6
  const companyLines = [c.address, c.taxId ? `Tax ID: ${c.taxId}` : null, c.email, c.phone].filter(Boolean) as string[]
  for (const line of companyLines) {
    const wrapped = doc.splitTextToSize(line, 85)
    doc.text(wrapped, MARGIN, cy)
    cy += wrapped.length * 4.2
  }

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(37, 99, 235)
  doc.text(isReceipt ? 'PAYMENT RECEIPT' : 'INVOICE', RIGHT, y, { align: 'right' })

  doc.setFontSize(10)
  black()
  doc.text(input.docNumber, RIGHT, y + 7, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  muted()
  doc.text(`Issued: ${input.issueDate}`, RIGHT, y + 12.5, { align: 'right' })
  if (isReceipt) {
    doc.text(`Paid: ${input.paidDate || '—'}`, RIGHT, y + 17.5, { align: 'right' })
  } else {
    doc.text(`Due: ${input.dueDate}`, RIGHT, y + 17.5, { align: 'right' })
  }

  y = Math.max(cy, y + 24) + 10

  // ---- Bill to
  doc.setFontSize(8)
  muted()
  doc.text('BILL TO', MARGIN, y)
  y += 5
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
    const wrapped = doc.splitTextToSize(line, 110)
    doc.text(wrapped, MARGIN, y)
    y += wrapped.length * 4.5
  }
  y += 8

  // ---- Line items table
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y, RIGHT, y)
  y += 5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  muted()
  doc.text('DESCRIPTION', MARGIN, y)
  doc.text('AMOUNT', RIGHT, y, { align: 'right' })
  y += 3
  doc.line(MARGIN, y, RIGHT, y)
  y += 7

  doc.setFontSize(10)
  black()
  doc.text(doc.splitTextToSize(input.itemName, 130), MARGIN, y)
  doc.text(money(input.amount), RIGHT, y, { align: 'right' })
  y += 4.5
  if (input.serviceNames) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    muted()
    doc.text(doc.splitTextToSize(input.serviceNames, 130), MARGIN, y)
    y += doc.splitTextToSize(input.serviceNames, 130).length * 4
  }
  y += 8

  // ---- Total
  doc.line(MARGIN, y, RIGHT, y)
  y += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  black()
  doc.text(isReceipt ? 'Total received' : 'Total due', RIGHT - 55, y, { align: 'right' })
  doc.text(money(input.amount), RIGHT, y, { align: 'right' })
  y += 14

  // ---- Payment details / receipt footer
  doc.setFillColor(249, 250, 251)
  const method = input.paymentMethod || ''
  const showBank = !isReceipt && method !== 'cash' && method !== 'manual' && !!c.bankAccount
  const showLink = !isReceipt && !showBank && !!input.paymentLink
  let boxLines = 0
  if (isReceipt) boxLines = 2
  else if (showBank) boxLines = 1 + [c.bankName, c.bankAccount, c.swift].filter(Boolean).length + 1
  else if (showLink) boxLines = 3
  else boxLines = 3
  const boxH = boxLines * 5 + 8
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, boxH, 2, 2, 'F')
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, boxH, 2, 2, 'S')
  let by = y + 6

  doc.setFontSize(8)
  muted()
  doc.text('PAYMENT DETAILS', MARGIN + 4, by)
  by += 5.5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  black()

  if (isReceipt) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(5, 150, 105)
    doc.text('Payment received in full', MARGIN + 4, by)
    by += 4.5
    doc.setFont('helvetica', 'normal')
    muted()
    doc.text(`Method: ${(method || 'manual').replace('_', ' ')}${input.paidDate ? ` · ${input.paidDate}` : ''}`, MARGIN + 4, by)
  } else if (showBank) {
    if (c.bankName) { doc.text(`Bank: ${c.bankName}`, MARGIN + 4, by); by += 4.5 }
    doc.setFont('courier', 'normal')
    doc.text(`Account: ${c.bankAccount}`, MARGIN + 4, by)
    doc.setFont('helvetica', 'normal')
    by += 4.5
    if (c.swift) { doc.text(`SWIFT: ${c.swift}`, MARGIN + 4, by); by += 4.5 }
    muted()
    doc.text(`Reference: ${input.docNumber}`, MARGIN + 4, by)
  } else if (showLink) {
    doc.text('Pay online:', MARGIN + 4, by); by += 4.5
    doc.setFont('courier', 'normal')
    muted()
    doc.text(doc.splitTextToSize(input.paymentLink || '', 160), MARGIN + 4, by)
  } else {
    muted()
    doc.text(method === 'cash' ? 'Please pay in cash at our office.' : 'Please contact us for payment instructions.', MARGIN + 4, by)
    by += 4.5
    doc.text(`Reference: ${input.docNumber}`, MARGIN + 4, by)
  }

  return doc.output('arraybuffer')
}
