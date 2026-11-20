import { PrintTrigger } from '../installment/[installmentId]/PrintTrigger'
import type { InvoiceBillTo } from '@/lib/invoice-pdf'

export interface InvoiceDocProps {
  isReceipt: boolean
  docNumber: string
  itemName: string
  serviceNames: string
  amount: number
  discountAmount?: number | null
  discountNotes?: string | null
  issueDate?: string | null
  dueDate?: string | null
  paidDate?: string | null
  paymentMethod?: string | null
  paymentLink?: string | null
  company?: {
    company_name?: string | null
    address?: string | null
    tax_id?: string | null
    email?: string | null
    phone?: string | null
    bank_name?: string | null
    bank_account?: string | null
    swift?: string | null
    krs?: string | null
    regon?: string | null
    account_holder?: string | null
  } | null
  billTo: InvoiceBillTo
}

export function InvoiceDoc(props: InvoiceDocProps) {
  const { isReceipt, company, billTo } = props
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const pln = (n: number) => `PLN ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const method = props.paymentMethod || ''
  const methodLabel = method === 'bank_transfer' ? 'Bank Transfer' : method === 'cash' || method === 'manual' ? 'Cash' : method === 'online' ? 'Online' : method || '—'
  const showBank = !isReceipt && method !== 'cash' && method !== 'manual' && !!company?.bank_account
  const discount = props.discountAmount || 0
  const original = props.amount + discount
  const legalLine = [company?.tax_id ? `NIP: ${company.tax_id}` : null, company?.krs ? `KRS: ${company.krs}` : null, company?.regon ? `REGON: ${company.regon}` : null].filter(Boolean).join(' · ')

  return (
    <>
      <PrintTrigger />
      <div className="doc">
        {/* Header — logo left, doc title right */}
        <div className="head">
          <img src="/branding/logo.png" alt={company?.company_name || ''} className="logo" />
          <div className="headRight">
            <div className="docKind">{isReceipt ? 'PAYMENT RECEIPT' : 'INVOICE'}</div>
            <div className="docTitle">{props.itemName}</div>
            {props.serviceNames && props.serviceNames !== 'Services' && <div className="muted">{props.serviceNames}</div>}
          </div>
        </div>
        <div className="rule" />

        {/* Meta grid */}
        <div className="meta">
          <div>
            <div className="label">{isReceipt ? 'Receipt No.' : 'Invoice No.'}</div>
            <div className="bold">{props.docNumber}</div>
          </div>
          <div>
            <div className="label">{isReceipt ? 'Paid Date' : 'Due Date'}</div>
            <div className="bold">{isReceipt ? fmt(props.paidDate) : fmt(props.dueDate)}</div>
          </div>
          <div>
            <div className="label">Client</div>
            <div className="bold">{billTo.company || billTo.name || '—'}</div>
          </div>
          <div>
            <div className="label">Method</div>
            <div className="bold">{isReceipt && props.paidDate ? methodLabel : methodLabel}</div>
          </div>
        </div>

        {/* Bill to */}
        <div className="billTo">
          <div className="label">Bill to</div>
          <div className="bold">{billTo.company || billTo.name || 'Client'}</div>
          {billTo.company && billTo.name && <div className="muted">{billTo.name}</div>}
          {billTo.address && <div className="muted">{billTo.address}</div>}
          {billTo.nip && <div className="muted">NIP: {billTo.nip}</div>}
          {billTo.email && <div className="muted">{billTo.email}</div>}
          {billTo.phone && <div className="muted">{billTo.phone}</div>}
        </div>

        {/* Amounts */}
        <div className="amounts">
          {discount > 0 && (
            <>
              <div className="amountRow">
                <span className="muted">Original Amount</span>
                <span>{pln(original)}</span>
              </div>
              <div className="amountRow">
                <span className="muted">Discount</span>
                <span>-{pln(discount)}</span>
              </div>
              {props.discountNotes && (
                <div className="amountRow">
                  <span className="muted">Discount Notes</span>
                  <span className="muted">{props.discountNotes}</span>
                </div>
              )}
            </>
          )}
          <div className="amountRow total">
            <span className="bold">{isReceipt ? 'Amount Received' : 'Amount Due'}</span>
            <span className="bold">{pln(props.amount)}</span>
          </div>
        </div>

        {/* Payment */}
        {isReceipt ? (
          <div className="paidBox">
            <div className="bold green">Payment received in full</div>
            <div className="muted small">
              {props.paymentMethod ? `Method: ${methodLabel}` : 'Method: manual'}{props.paidDate ? ` · ${fmt(props.paidDate)}` : ''}
            </div>
          </div>
        ) : (
          <div className="payBox">
            <div className="label">Payment details</div>
            {showBank && (
              <div className="payGrid">
                {company?.bank_name && (<><span className="muted">Bank</span><span className="bold">{company.bank_name}</span></>)}
                <span className="muted">Account Holder</span><span className="bold">{company?.account_holder || company?.company_name}</span>
                <span className="muted">IBAN</span><span className="bold mono">{company.bank_account}</span>
                {company?.swift && (<><span className="muted">SWIFT/BIC</span><span className="bold">{company.swift}</span></>)}
                <span className="muted">Reference</span><span className="bold">{props.docNumber}</span>
              </div>
            )}
            {!showBank && method === 'online' && props.paymentLink && (
              <div>Pay online: <span className="mono">{props.paymentLink}</span></div>
            )}
            {!showBank && method === 'cash' && (
              <div className="muted">Please pay in cash at our office.</div>
            )}
            {!showBank && method !== 'online' && method !== 'cash' && (
              <div className="muted">Please contact us for payment instructions.</div>
            )}
          </div>
        )}

        {/* Legal footer */}
        <div className="rule footerRule" />
        <div className="footer">
          <div className="bold">{(company?.company_name || '').toUpperCase()}{company?.account_holder ? '' : ''}</div>
          {company?.account_holder && <div className="muted">{company.account_holder}</div>}
          {legalLine && <div className="muted">{legalLine}</div>}
          {company?.address && <div className="muted">{company.address}</div>}
          {company?.email && <div className="muted">{company.email}</div>}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: #e5e7eb; color: #111827; }
        .doc { max-width: 800px; margin: 24px auto; background: #fff; padding: 48px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); min-height: 1000px; display: flex; flex-direction: column; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        .logo { height: 52px; width: auto; object-fit: contain; }
        .headRight { text-align: right; }
        .docKind { font-size: 12px; letter-spacing: 3px; color: #6b7280; margin-bottom: 6px; }
        .docTitle { font-size: 20px; font-weight: 700; max-width: 340px; }
        .rule { border-top: 1.5px solid #d1d5db; margin: 20px 0 24px; }
        .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 32px; margin-bottom: 28px; }
        .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; margin-bottom: 3px; }
        .muted { color: #6b7280; font-size: 13px; line-height: 1.5; }
        .small { font-size: 12px; }
        .bold { font-weight: 700; font-size: 14px; }
        .green { color: #059669; }
        .mono { font-family: ui-monospace, monospace; font-size: 13px; }
        .billTo { margin-bottom: 28px; }
        .billTo .bold { font-size: 15px; }
        .amounts { margin-bottom: 28px; }
        .amountRow { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-bottom: 1px dashed #e5e7eb; font-size: 14px; }
        .amountRow.total { border-bottom: 2px solid #111827; font-size: 17px; }
        .payBox, .paidBox { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; font-size: 14px; }
        .paidBox { border-color: #a7f3d0; background: #ecfdf5; }
        .payGrid { display: grid; grid-template-columns: 130px 1fr; gap: 6px 16px; margin-top: 6px; }
        .footerRule { margin-top: auto; }
        .footer { font-size: 13px; line-height: 1.6; }
        .footer .bold { text-transform: uppercase; letter-spacing: 0.5px; }
        @media print {
          body { background: #fff; }
          .doc { margin: 0; box-shadow: none; border-radius: 0; max-width: none; padding: 20px; min-height: auto; }
        }
        @media (max-width: 640px) {
          .doc { padding: 28px 20px; }
          .head { flex-direction: column; }
          .headRight { text-align: left; }
        }
      `}</style>
    </>
  )
}
