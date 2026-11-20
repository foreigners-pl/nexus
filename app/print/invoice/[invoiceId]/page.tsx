import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDoc } from '@/app/print/_components/InvoiceDoc'
import type { InvoiceBillTo } from '@/lib/invoice-pdf'

interface PrintInvoiceProps {
  params: Promise<{ invoiceId: string }>
  searchParams: Promise<{ doc?: string }>
}

// Print an invoice directly by id — used for MRC-generated invoices that
// aren't tied to an installment.
export default async function PrintInvoice({ params, searchParams }: PrintInvoiceProps) {
  const { invoiceId } = await params
  const { doc } = await searchParams
  const isReceipt = doc === 'receipt'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()
  if (!invoice) return <p>Invoice not found.</p>

  const [{ data: caseRow }, { data: company }, { data: caseServices }] = await Promise.all([
    supabase.from('cases').select('*').eq('id', invoice.case_id).single(),
    supabase.from('company_settings').select('*').limit(1).maybeSingle(),
    supabase.from('case_services').select('*, services(*)').eq('case_id', invoice.case_id),
  ])

  const { data: client } = caseRow?.client_id
    ? await supabase.from('clients').select('*').eq('id', caseRow.client_id).single()
    : { data: null }

  const { data: installment } = invoice.installment_id
    ? await supabase.from('installments').select('*').eq('id', invoice.installment_id).single()
    : { data: null }

  const serviceNames = (caseServices || []).map((s: any) => s.services?.name).filter(Boolean).join(', ') || 'Services'
  const docNumber = invoice.invoice_number || `INV-${caseRow?.case_code || ''}`

  const billTo: InvoiceBillTo = invoice.bill_to || {
    name: [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Client',
    company: client?.billing_company || null,
    email: client?.contact_email || null,
    phone: null,
    address: client?.billing_address || null,
    nip: client?.nip || null,
  }

  return (
    <InvoiceDoc
      isReceipt={isReceipt}
      docNumber={docNumber}
      itemName={invoice.invoice_name || installment?.name || 'Service'}
      serviceNames={serviceNames}
      amount={Math.abs(invoice.amount || installment?.amount || 0)}
      discountAmount={invoice.discount_amount}
      discountNotes={invoice.discount_notes}
      issueDate={invoice.issued_at || invoice.sent_at || invoice.created_at}
      dueDate={invoice.due_date || installment?.due_date}
      paidDate={invoice.paid_at}
      paymentMethod={invoice.payment_method}
      paymentLink={invoice.payment_link}
      company={company}
      billTo={billTo}
    />
  )
}
