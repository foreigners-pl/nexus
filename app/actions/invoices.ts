'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivityForUsers } from './dashboard'
import { buildInvoicePdf, type InvoiceBillTo } from '@/lib/invoice-pdf'

const FROM_ADDRESS = 'Foreigners.pl <noreply@foreigners.pl>'

// ---- Bill-to: defaults pulled from the client record (editable before issue)
export async function getBillToDefaults(caseId: string) {
  const supabase = await createClient()
  const { data: caseRow } = await supabase
    .from('cases')
    .select('client_id')
    .eq('id', caseId)
    .single()
  if (!caseRow?.client_id) return { billTo: {} as InvoiceBillTo, emails: [] as string[] }

  const { data: client } = await supabase
    .from('clients')
    .select('first_name, last_name, contact_email, nip, billing_address, billing_company')
    .eq('id', caseRow.client_id)
    .single()

  const { data: phone } = await supabase
    .from('contact_numbers')
    .select('country_code, number')
    .eq('client_id', caseRow.client_id)
    .limit(1)
    .maybeSingle()

  const billTo: InvoiceBillTo = {
    name: [client?.first_name, client?.last_name].filter(Boolean).join(' ') || null,
    company: client?.billing_company || null,
    email: client?.contact_email || null,
    phone: phone ? `${phone.country_code || ''} ${phone.number}`.trim() : null,
    address: client?.billing_address || null,
    nip: client?.nip || null,
  }
  return { billTo, emails: client?.contact_email ? [client.contact_email] : [] }
}

// ---- Invoice numbering: FV/YYYY/MM/NNNN via a counter row per month
async function nextInvoiceNumber(supabase: any): Promise<string> {
  const now = new Date()
  const ym = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
  const { data } = await supabase
    .from('invoice_sequences')
    .upsert({ year_month: ym, last_number: 1 }, { onConflict: 'year_month' })
    .select('last_number')
    .single()
  let n = data?.last_number
  if (data) {
    const { data: bumped } = await supabase
      .from('invoice_sequences')
      .update({ last_number: data.last_number + 1 })
      .eq('year_month', ym)
      .select('last_number')
      .single()
    n = bumped?.last_number ?? data.last_number
  }
  return `FV/${ym}/${String(n || 1).padStart(4, '0')}`
}

// ---- Save editable invoice details (bill-to + recipients) on a draft/issued invoice
export async function saveInvoiceDetails(
  invoiceId: string,
  caseId: string,
  billTo: InvoiceBillTo,
  recipientEmails: string[],
  invoiceName?: string,
  paymentMethod?: string
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('invoices')
    .update({
      bill_to: billTo,
      recipient_emails: recipientEmails.filter(Boolean),
      sent_to_email: recipientEmails.filter(Boolean)[0] || null,
      ...(invoiceName ? { invoice_name: invoiceName } : {}),
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    })
    .eq('id', invoiceId)
  if (error) {
    console.error('Error saving invoice details:', error)
    return { error: 'Failed to save invoice details' }
  }
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

// ---- Generate: create (or update) the invoice with a number + frozen bill-to snapshot
export async function issueInvoice(
  caseId: string,
  installmentId: string | null,
  invoiceName: string,
  amount: number,
  dueDate: string | null,
  billTo: InvoiceBillTo,
  recipientEmails: string[],
  paymentMethod: string,
  invoiceId?: string | null,
  mrcChargeId?: string | null
) {
  const supabase = await createClient()
  const number = await nextInvoiceNumber(supabase)
  const now = new Date().toISOString()

  const payload: any = {
    case_id: caseId,
    installment_id: installmentId,
    invoice_name: invoiceName,
    amount,
    due_date: dueDate,
    status: 'issued',
    issued_at: now,
    invoice_number: number,
    bill_to: billTo,
    recipient_emails: recipientEmails.filter(Boolean),
    sent_to_email: recipientEmails.filter(Boolean)[0] || null,
    payment_method: paymentMethod,
    mrc_charge_id: mrcChargeId || null,
  }

  const query = invoiceId
    ? supabase.from('invoices').update(payload).eq('id', invoiceId).select().single()
    : supabase.from('invoices').insert(payload).select().single()

  const { data, error } = await query
  if (error) {
    console.error('Error issuing invoice:', error)
    return { error: 'Failed to generate invoice' }
  }
  revalidatePath(`/cases/${caseId}`)
  return { success: true, invoice: data }
}

// ---- Duplicate: clone an invoice into a new draft
export async function duplicateInvoice(invoiceId: string, caseId: string) {
  const supabase = await createClient()
  const { data: src } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()
  if (!src) return { error: 'Invoice not found' }

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      case_id: caseId,
      installment_id: src.installment_id,
      mrc_charge_id: src.mrc_charge_id,
      invoice_name: src.invoice_name,
      amount: src.amount,
      due_date: src.due_date,
      currency: src.currency,
      collection_method: src.collection_method,
      payment_method: src.payment_method,
      notes: src.notes,
      bill_to: src.bill_to,
      recipient_emails: src.recipient_emails,
      sent_to_email: src.sent_to_email,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Error duplicating invoice:', error)
    return { error: 'Failed to duplicate invoice' }
  }
  revalidatePath(`/cases/${caseId}`)
  return { success: true, invoice: data }
}

// ---- Email send via Resend with a generated PDF attachment
export async function sendInvoiceEmail(invoiceId: string, caseId: string, extraEmails?: string[]) {
  const supabase = await createClient()
  return sendInvoiceEmailWithClient(supabase, invoiceId, caseId, extraEmails)
}

// Shared by the user-facing action (cookie client) and the MRC cron (admin client)
export async function sendInvoiceEmailWithClient(
  supabase: any,
  invoiceId: string,
  caseId: string,
  extraEmails?: string[]
) {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()
  if (!invoice) return { error: 'Invoice not found' }

  const recipients = [...new Set([...(invoice.recipient_emails || []), ...(extraEmails || [])].filter(Boolean))]
  if (recipients.length === 0) return { error: 'No recipient email' }

  const [{ data: company }, { data: caseRow }, { data: installment }] = await Promise.all([
    supabase.from('company_settings').select('*').limit(1).maybeSingle(),
    supabase.from('cases').select('case_code, client_id').eq('id', caseId).single(),
    invoice.installment_id
      ? supabase.from('installments').select('name, is_balance, is_down_payment, due_date').eq('id', invoice.installment_id).single()
      : Promise.resolve({ data: null }),
  ])

  const { data: caseServices } = await supabase
    .from('case_services')
    .select('services(name)')
    .eq('case_id', caseId)
  const serviceNames = (caseServices || []).map((s: any) => s.services?.name).filter(Boolean).join(', ') || 'Services'

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const docNumber = invoice.invoice_number || `INV-${caseRow?.case_code || ''}`
  const billTo = (invoice.bill_to || {}) as InvoiceBillTo

  const pdf = buildInvoicePdf({
    docNumber,
    itemName: invoice.invoice_name || installment?.name || 'Service',
    serviceNames,
    amount: invoice.amount || 0,
    issueDate: fmt(invoice.issued_at || invoice.sent_at || invoice.created_at),
    dueDate: fmt(invoice.due_date || installment?.due_date),
    company: {
      name: company?.company_name,
      address: company?.address,
      taxId: company?.tax_id,
      email: company?.email,
      phone: company?.phone,
      bankName: company?.bank_name,
      bankAccount: company?.bank_account,
      swift: company?.swift,
    },
    billTo,
    paymentMethod: invoice.payment_method,
    paymentLink: invoice.payment_link,
  })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'Email is not configured' }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: recipients,
      subject: `Invoice ${docNumber} from ${company?.company_name || 'Foreigners.pl'}`,
      html: `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 16px;">${company?.company_name || 'Foreigners.pl'}</h2>
          <p>Hi${billTo.name ? ` ${billTo.name}` : ''},</p>
          <p>Please find attached invoice <strong>${docNumber}</strong> for <strong>${serviceNames}</strong>.</p>
          <p>Amount due: <strong>${Math.abs(invoice.amount || 0).toFixed(2)} ${(invoice.currency || 'PLN').toUpperCase()}</strong><br>
          Due date: <strong>${fmt(invoice.due_date || installment?.due_date)}</strong></p>
          ${company?.bank_account && invoice.payment_method !== 'cash'
            ? `<p style="color: #666; font-size: 13px;">Bank transfer:<br>${company.bank_name || ''}<br><span style="font-family: monospace;">${company.bank_account}</span><br>Reference: ${docNumber}</p>`
            : ''}
          <p style="color: #666; font-size: 13px; margin-top: 32px;">— ${company?.company_name || 'Foreigners.pl'}</p>
        </div>
      `,
      attachments: [
        {
          filename: `${docNumber.replace(/\//g, '-')}.pdf`,
          content: Buffer.from(pdf).toString('base64'),
        },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Resend error:', text)
    return { error: 'Failed to send email' }
  }

  await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_emails: recipients, sent_to_email: recipients[0] })
    .eq('id', invoiceId)

  revalidatePath(`/cases/${caseId}`)
  return { success: true, sentTo: recipients }
}

export async function createInvoice(
  caseId: string,
  installmentId: string,
  invoiceName: string,
  amount: number,
  dueDate?: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      case_id: caseId,
      installment_id: installmentId,
      invoice_name: invoiceName,
      amount,
      due_date: dueDate || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating invoice:', error)
    return { error: 'Failed to create invoice' }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true, invoice: data }
}

export async function sendInvoice(invoiceId: string, caseId: string, useStripe: boolean = false) {
  const supabase = await createClient()

  if (useStripe) {
    // Use Stripe integration
    const { createStripeInvoice, sendStripeInvoice } = await import('./stripe')
    
    // Check if invoice already has Stripe ID
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('stripe_invoice_id')
      .eq('id', invoiceId)
      .single()

    if (!existingInvoice?.stripe_invoice_id) {
      // Create Stripe invoice first
      const createResult = await createStripeInvoice(invoiceId)
      if (createResult.error) {
        return { error: createResult.error }
      }
    }

    // Send via Stripe
    const sendResult = await sendStripeInvoice(invoiceId)
    if (sendResult.error) {
      return { error: sendResult.error }
    }

    revalidatePath(`/cases/${caseId}`)
    return { success: true }
  }

  // Non-Stripe: just update status to 'sent'
  const { data, error } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .select()
    .single()

  if (error) {
    console.error('Error sending invoice:', error)
    return { error: 'Failed to send invoice' }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true, invoice: data }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  caseId: string,
  status: 'draft' | 'issued' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled'
) {
  const supabase = await createClient()

  const updateData: any = { status }

  // Set paid_at when marking as paid
  if (status === 'paid') {
    updateData.paid_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId)

  if (error) {
    console.error('Error updating invoice status:', error)
    return { error: 'Failed to update invoice status' }
  }

  // If invoice is paid, also mark the installment as paid
  if (status === 'paid') {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('installment_id, amount')
      .eq('id', invoiceId)
      .single()

    if (invoice?.installment_id) {
      await supabase
        .from('installments')
        .update({ paid: true })
        .eq('id', invoice.installment_id)
    }

    // Log payment received notification
    const { data: { user } } = await supabase.auth.getUser()
    const { data: caseData } = await supabase
      .from('cases')
      .select('case_code, id')
      .eq('id', caseId)
      .single()

    const { data: assignees } = await supabase
      .from('case_assignees')
      .select('user_id')
      .eq('case_id', caseId)

    const { data: actorProfile } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', user?.id)
      .single()

    const actorName = actorProfile?.display_name || actorProfile?.email || 'Someone'
    const assigneeIds = assignees?.map(a => a.user_id) || []
    const amount = invoice?.amount || 0

    if (assigneeIds.length > 0) {
      await logActivityForUsers({
        userIds: assigneeIds,
        actorId: user?.id,
        actionType: 'case_payment_received',
        entityType: 'case',
        entityId: caseId,
        message: `Payment of $${amount.toFixed(2)} received for case ${caseData?.case_code || ''}`,
        metadata: {
          case_code: caseData?.case_code,
          amount: amount,
          actor_name: actorName,
        }
      })
    }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function deleteInvoice(invoiceId: string, caseId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)

  if (error) {
    console.error('Error deleting invoice:', error)
    return { error: 'Failed to delete invoice' }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function getInvoicesForCase(caseId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching invoices:', error)
    return { error: 'Failed to fetch invoices', invoices: [] }
  }

  return { invoices: data || [] }
}

export async function recordManualPayment(
  caseId: string,
  installmentId: string,
  invoiceName: string,
  amount: number,
  paymentMethod: 'cash' | 'bank_transfer' | 'other' = 'other',
  paidAt?: string,
  notes?: string
) {
  const supabase = await createClient()

  const now = new Date().toISOString()
  const paidTimestamp = paidAt || now
  const methodLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Manual'

  // Create invoice record marked as paid
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      case_id: caseId,
      installment_id: installmentId,
      invoice_name: `${invoiceName} (${methodLabel})`,
      amount,
      status: 'paid',
      paid_at: paidTimestamp,
      sent_at: now, // Mark as sent since it's already paid
      payment_method: paymentMethod,
      notes: notes || null,
      currency: 'pln', // Default currency
    })
    .select()
    .single()

  if (error) {
    console.error('Error recording manual payment:', error)
    return { error: 'Failed to record payment' }
  }

  // Mark the installment as paid
  await supabase
    .from('installments')
    .update({ paid: true })
    .eq('id', installmentId)

  revalidatePath(`/cases/${caseId}`)
  return { success: true, invoice: data }
}

export async function recordRefund(
  caseId: string,
  parentInstallmentId: string,
  amount: number,
  reason?: string
) {
  const supabase = await createClient()

  // Get the parent installment to find its position
  const { data: parentInstallment, error: parentError } = await supabase
    .from('installments')
    .select('*')
    .eq('id', parentInstallmentId)
    .single()

  if (parentError || !parentInstallment) {
    return { error: 'Parent installment not found' }
  }

  // Get current max position for this case
  const { data: maxPosData } = await supabase
    .from('installments')
    .select('position')
    .eq('case_id', caseId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (maxPosData?.position || 0) + 1

  // Create a refund installment entry (negative amount)
  const { data: refund, error: refundError } = await supabase
    .from('installments')
    .insert({
      case_id: caseId,
      amount: -Math.abs(amount), // Store as negative to indicate refund
      due_date: new Date().toISOString().split('T')[0],
      is_down_payment: false,
      automatic_invoice: false,
      paid: true, // Refunds are already "processed"
      position: nextPosition,
      parent_installment_id: parentInstallmentId, // Link to original installment
      refund_reason: reason || null,
    })
    .select()
    .single()

  if (refundError) {
    console.error('Error recording refund:', refundError)
    return { error: 'Failed to record refund' }
  }

  // Create invoice record for the refund
  const now = new Date().toISOString()
  await supabase
    .from('invoices')
    .insert({
      case_id: caseId,
      installment_id: refund.id,
      invoice_name: `Refund${reason ? ` - ${reason}` : ''}`,
      amount: -Math.abs(amount),
      status: 'paid',
      paid_at: now,
      sent_at: now,
      payment_method: 'refund',
      notes: reason || null,
    })

  revalidatePath(`/cases/${caseId}`)
  return { success: true, refund }
}
