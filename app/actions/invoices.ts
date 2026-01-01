'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled'
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
      .select('installment_id')
      .eq('id', invoiceId)
      .single()

    if (invoice?.installment_id) {
      await supabase
        .from('installments')
        .update({ paid: true })
        .eq('id', invoice.installment_id)
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
  notes?: string
) {
  const supabase = await createClient()

  const now = new Date().toISOString()
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
      paid_at: now,
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
