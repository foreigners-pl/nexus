import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrintTrigger } from './PrintTrigger'

interface PrintPageProps {
  params: Promise<{ installmentId: string }>
  searchParams: Promise<{ doc?: string }>
}

export default async function PrintInstallmentDoc({ params, searchParams }: PrintPageProps) {
  const { installmentId } = await params
  const { doc } = await searchParams
  const isReceipt = doc === 'receipt'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: installment } = await supabase
    .from('installments')
    .select('*')
    .eq('id', installmentId)
    .single()
  if (!installment) return <DocShell><p>Installment not found.</p></DocShell>

  const [{ data: caseRow }, { data: company }, { data: invoiceRows }, { data: allInstallments }] = await Promise.all([
    supabase.from('cases').select('*').eq('id', installment.case_id).single(),
    supabase.from('company_settings').select('*').limit(1).maybeSingle(),
    supabase.from('invoices').select('*').eq('installment_id', installmentId).neq('status', 'cancelled').order('created_at', { ascending: false }),
    supabase.from('installments').select('id, is_balance, is_down_payment, amount').eq('case_id', installment.case_id),
  ])

  const { data: client } = caseRow?.client_id
    ? await supabase.from('clients').select('*').eq('id', caseRow.client_id).single()
    : { data: null }

  const { data: caseServices } = await supabase
    .from('case_services')
    .select('*, services(*)')
    .eq('case_id', installment.case_id)

  const invoice = invoiceRows?.[0]
  const serviceNames = (caseServices || []).map((s: any) => s.services?.name).filter(Boolean).join(', ') || 'Services'
  const idx = (allInstallments || []).filter(i => (i.amount || 0) >= 0 && !i.is_balance).findIndex(i => i.id === installmentId) + 1
  const itemName = invoice?.invoice_name
    || installment.name
    || (installment.is_balance ? 'Final payment' : installment.is_down_payment ? 'Down payment' : `Installment ${idx}`)

  const docNumber = invoice?.invoice_number || `${isReceipt ? 'RCP' : 'INV'}-${caseRow?.case_code || ''}-${String(idx || 1).padStart(2, '0')}`
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Client'
  const amount = Math.abs(installment.amount || 0)
  const issueDate = invoice?.sent_at || invoice?.created_at || new Date().toISOString()
  const paidDate = invoice?.paid_at || installment.updated_at
  const dueDate = invoice?.due_date || installment.due_date
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  return (
    <DocShell>
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
            <div className="docNo">{docNumber}</div>
            <div className="muted">Issued: {fmt(issueDate)}</div>
            {isReceipt
              ? <div className="muted">Paid: {fmt(paidDate)}</div>
              : <div className="muted">Due: {fmt(dueDate)}</div>}
          </div>
        </div>

        <div className="billTo">
          <div className="label">Bill to</div>
          <div className="bold">{clientName}</div>
          {client?.contact_email && <div className="muted">{client.contact_email}</div>}
          {caseRow?.case_code && <div className="muted">Case: {caseRow.case_code}</div>}
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
                <div className="bold">{itemName}</div>
                <div className="muted small">{serviceNames}</div>
              </td>
              <td className="right bold">{amount.toFixed(2)} PLN</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="right bold">{isReceipt ? 'Total received' : 'Total due'}</td>
              <td className="right bold">{amount.toFixed(2)} PLN</td>
            </tr>
          </tfoot>
        </table>

        {isReceipt ? (
          <div className="paidBox">
            <div className="bold green">Payment received in full</div>
            <div className="muted small">
              {invoice?.payment_method ? `Method: ${invoice.payment_method.replace('_', ' ')}` : 'Method: manual'}{paidDate ? ` · ${fmt(paidDate)}` : ''}
            </div>
          </div>
        ) : (
          <div className="payBox">
            <div className="label">Payment details</div>
            {company?.bank_name && <div>Bank: <span className="bold">{company.bank_name}</span></div>}
            {company?.bank_account && <div>Account: <span className="bold mono">{company.bank_account}</span></div>}
            {company?.swift && <div>SWIFT: <span className="bold">{company.swift}</span></div>}
            {!company?.bank_account && invoice?.payment_link && (
              <div>Pay online: <span className="mono">{invoice.payment_link}</span></div>
            )}
            {!company?.bank_account && !invoice?.payment_link && (
              <div className="muted">Please contact us for payment instructions.</div>
            )}
            <div className="muted small" style={{ marginTop: 8 }}>Reference: {docNumber}</div>
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
    </DocShell>
  )
}

function DocShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
