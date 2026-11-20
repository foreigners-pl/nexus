import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDoc } from '@/app/print/_components/InvoiceDoc'
import type { InvoiceBillTo } from '@/lib/invoice-pdf'

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
  if (!installment) return <p>Installment not found.</p>

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

  // Bill-to: the frozen invoice snapshot wins; fall back to the live client record
  const billTo: InvoiceBillTo = invoice?.bill_to || {
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
      itemName={itemName}
      serviceNames={serviceNames}
      amount={Math.abs(installment.amount || 0)}
      issueDate={invoice?.issued_at || invoice?.sent_at || invoice?.created_at || new Date().toISOString()}
      dueDate={invoice?.due_date || installment.due_date}
      paidDate={invoice?.paid_at || installment.updated_at}
      paymentMethod={invoice?.payment_method}
      paymentLink={invoice?.payment_link}
      caseCode={caseRow?.case_code}
      company={company}
      billTo={billTo}
    />
  )
}
