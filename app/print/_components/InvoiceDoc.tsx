import { PrintTrigger } from '../installment/[installmentId]/PrintTrigger'
import type { InvoiceBillTo } from '@/lib/invoice-pdf'

export interface InvoiceDocProps {
  isReceipt: boolean
  docNumber: string
  itemName: string
  serviceNames: string
  amount: number
  issueDate?: string | null
  dueDate?: string | null
  paidDate?: string | null
  paymentMethod?: string | null
  paymentLink?: string | null
  caseCode?: string | null
  company?: {
    company_name?: string | null
    address?: string | null
    tax_id?: string | null
    email?: string | null
    phone?: string | null
    bank_name?: string | null
    bank_account?: string | null
    swift?: string | null
  } | null
  billTo: InvoiceBillTo
}

export function InvoiceDoc(props: InvoiceDocProps) {
  const { isReceipt, company, billTo } = props
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const method = props.paymentMethod || ''
  const showBank = !isReceipt && method !== 'cash' && method !== 'manual' && !!company?.bank_account

  return (
    <>
      <PrintTrigger />
      <div className="doc">
        <div className="top">
          <div>
            <h1 className="company">{company?.company_name || 'Nexus'}</h1>
            <div className="muted">
              {company?.address && <div>{company.address}</div>}
              {company?.tax_id && <div>Tax ID: {company.tax_id}</div>}
              {company?.email && <div>{company.email}</div>}
              {company?.phone && <div>{company.phone}</div>}
            </div>
          </div>
          <div className="docMeta">
            <h2 className="docTitle">{isReceipt ? 'PAYMENT RECEIPT' : 'INVOICE'}</h2>
            <div className="docNo">{props.docNumber}</div>
            <div className="muted">Issued: {fmt(props.issueDate)}</div>
            {isReceipt
              ? <div className="muted">Paid: {fmt(props.paidDate)}</div>
              : <div className="muted">Due: {fmt(props.dueDate)}</div>}
          </div>
        </div>

        <div className="billTo">
          <div className="label">Bill to</div>
          <div className="bold">{billTo.company || billTo.name || 'Client'}</div>
          {billTo.company && billTo.name && <div className="muted">{billTo.name}</div>}
          {billTo.address && <div className="muted">{billTo.address}</div>}
          {billTo.nip && <div className="muted">NIP: {billTo.nip}</div>}
          {billTo.email && <div className="muted">{billTo.email}</div>}
          {billTo.phone && <div className="muted">{billTo.phone}</div>}
          {props.caseCode && <div className="muted">Case: {props.caseCode}</div>}
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="bold">{props.itemName}</div>
                <div className="muted small">{props.serviceNames}</div>
              </td>
              <td className="right bold">{props.amount.toFixed(2)} PLN</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="right bold">{isReceipt ? 'Total received' : 'Total due'}</td>
              <td className="right bold">{props.amount.toFixed(2)} PLN</td>
            </tr>
          </tfoot>
        </table>

        {isReceipt ? (
          <div className="paidBox">
            <div className="bold green">Payment received in full</div>
            <div className="muted small">
              {props.paymentMethod ? `Method: ${props.paymentMethod.replace('_', ' ')}` : 'Method: manual'}{props.paidDate ? ` · ${fmt(props.paidDate)}` : ''}
            </div>
          </div>
        ) : (
          <div className="payBox">
            <div className="label">Payment details</div>
            {showBank && (
              <>
                {company?.bank_name && <div>Bank: <span className="bold">{company.bank_name}</span></div>}
                <div>Account: <span className="bold mono">{company.bank_account}</span></div>
                {company?.swift && <div>SWIFT: <span className="bold">{company.swift}</span></div>}
              </>
            )}
            {!showBank && method === 'cash' && (
              <div className="muted">Please pay in cash at our office.</div>
            )}
            {!showBank && method !== 'cash' && props.paymentLink && (
              <div>Pay online: <span className="mono">{props.paymentLink}</span></div>
            )}
            {!showBank && method !== 'cash' && !props.paymentLink && (
              <div className="muted">Please contact us for payment instructions.</div>
            )}
            <div className="muted small" style={{ marginTop: 8 }}>Reference: {props.docNumber}</div>
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #e5e7eb; color: #111827; }
        .doc { max-width: 800px; margin: 24px auto; background: #fff; padding: 48px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .company { margin: 0 0 8px; font-size: 24px; }
        .docMeta { text-align: right; }
        .docTitle { margin: 0; font-size: 28px; letter-spacing: 2px; color: #2563eb; }
        .docNo { font-weight: 600; margin: 4px 0; }
        .muted { color: #6b7280; font-size: 13px; line-height: 1.5; }
        .small { font-size: 12px; }
        .bold { font-weight: 600; }
        .green { color: #059669; }
        .mono { font-family: ui-monospace, monospace; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
        .billTo { margin-bottom: 32px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; padding: 10px 0; border-bottom: 2px solid #e5e7eb; }
        td { padding: 14px 0; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        tfoot td { border-bottom: none; border-top: 2px solid #e5e7eb; font-size: 16px; padding: 14px 0; }
        .right { text-align: right; }
        .payBox, .paidBox { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; font-size: 14px; line-height: 1.8; }
        .paidBox { border-color: #a7f3d0; background: #ecfdf5; }
        @media print {
          body { background: #fff; }
          .doc { margin: 0; box-shadow: none; border-radius: 0; max-width: none; padding: 20px; }
        }
      `}</style>
    </>
  )
}
