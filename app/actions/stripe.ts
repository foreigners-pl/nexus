'use server'

import { getStripe, isStripeConfigured, toStripeAmount, DEFAULT_CURRENCY } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

/**
 * Create or get a Stripe customer for a client
 * If client already has a stripe_customer_id, returns it
 * Otherwise creates a new Stripe customer and saves the ID
 */
export async function ensureStripeCustomer(clientId: string): Promise<{ customerId?: string; error?: string }> {
  if (!isStripeConfigured()) {
    return { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local' }
  }
  
  const supabase = await createClient()

  // Get client details
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select(`
      id,
      first_name,
      last_name,
      contact_email,
      stripe_customer_id,
      contact_numbers (number)
    `)
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    console.error('Error fetching client:', clientError)
    return { error: 'Client not found' }
  }

  // If already has Stripe customer ID, return it
  if (client.stripe_customer_id) {
    return { customerId: client.stripe_customer_id }
  }

  // Build customer name
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unknown'
  
  // Get phone number if available
  const phone = client.contact_numbers?.[0]?.number

  try {
    // Create Stripe customer
    const stripeCustomer = await getStripe().customers.create({
      name,
      email: client.contact_email || undefined,
      phone: phone || undefined,
      metadata: {
        client_id: clientId,
        source: 'nexus_crm',
      },
    })

    // Save Stripe customer ID to database
    const { error: updateError } = await supabase
      .from('clients')
      .update({ stripe_customer_id: stripeCustomer.id })
      .eq('id', clientId)

    if (updateError) {
      console.error('Error saving stripe_customer_id:', updateError)
      // Customer was created in Stripe but we failed to save - log but continue
    }

    return { customerId: stripeCustomer.id }
  } catch (err) {
    console.error('Stripe customer creation failed:', err)
    return { error: 'Failed to create Stripe customer' }
  }
}

/**
 * Update Stripe customer when client details change
 */
export async function syncClientToStripe(clientId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select(`
      id,
      first_name,
      last_name,
      contact_email,
      stripe_customer_id,
      contact_numbers (number)
    `)
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    return { error: 'Client not found' }
  }

  if (!client.stripe_customer_id) {
    // No Stripe customer yet, create one
    return ensureStripeCustomer(clientId)
  }

  const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unknown'
  const phone = client.contact_numbers?.[0]?.number

  try {
    await getStripe().customers.update(client.stripe_customer_id, {
      name,
      email: client.contact_email || undefined,
      phone: phone || undefined,
    })
    return { success: true }
  } catch (err) {
    console.error('Stripe customer update failed:', err)
    return { error: 'Failed to update Stripe customer' }
  }
}

// ============================================
// INVOICE MANAGEMENT
// ============================================

/**
 * Create and optionally send a Stripe invoice for an installment
 */
export async function createStripeInvoice(
  invoiceId: string,
  options: { autoSend?: boolean; paymentType?: 'online' | 'bank_transfer'; dueDate?: string } = {}
): Promise<{ stripeInvoiceId?: string; error?: string }> {
  if (!isStripeConfigured()) {
    return { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local' }
  }
  
  const supabase = await createClient()

  // Get invoice first
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    console.error('Error fetching invoice:', invoiceError)
    return { error: 'Invoice not found' }
  }

  if (!invoice.installment_id) {
    return { error: 'Invoice has no linked installment' }
  }

  // Get installment and case
  const { data: installment, error: installmentError } = await supabase
    .from('installments')
    .select('id, case_id')
    .eq('id', invoice.installment_id)
    .single()

  if (installmentError || !installment) {
    return { error: 'Installment not found' }
  }

  // Get case and client
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('id, client_id')
    .eq('id', installment.case_id)
    .single()

  if (caseError || !caseData) {
    return { error: 'Case not found' }
  }

  // Get client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, first_name, last_name, contact_email, stripe_customer_id')
    .eq('id', caseData.client_id)
    .single()

  if (clientError || !client) {
    return { error: 'Client not found for this invoice' }
  }

  // Ensure client has a Stripe customer
  let stripeCustomerId = client.stripe_customer_id
  if (!stripeCustomerId) {
    const result = await ensureStripeCustomer(client.id)
    if (result.error) return { error: result.error }
    stripeCustomerId = result.customerId
  }

  if (!stripeCustomerId) {
    return { error: 'Could not get or create Stripe customer' }
  }

  const paymentType = options.paymentType || 'online'

  try {
    // Calculate due date - use option dueDate, then invoice.due_date, then default 14 days
    const dueDateToUse = options.dueDate || invoice.due_date
    const daysUntilDue = dueDateToUse 
      ? Math.max(1, Math.ceil((new Date(dueDateToUse).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 14

    // Create the invoice in Stripe
    const stripeInvoice = await getStripe().invoices.create({
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      days_until_due: daysUntilDue,
      description: invoice.invoice_name,
      metadata: {
        invoice_id: invoiceId,
        case_id: invoice.case_id,
        installment_id: invoice.installment_id || '',
        source: 'nexus_crm',
        payment_type: paymentType,
      },
    })

    // Add line item
    await getStripe().invoiceItems.create({
      customer: stripeCustomerId,
      invoice: stripeInvoice.id,
      amount: toStripeAmount(invoice.amount),
      currency: DEFAULT_CURRENCY,
      description: invoice.invoice_name,
    })

    // Update our invoice record with Stripe IDs and payment type
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        stripe_invoice_id: stripeInvoice.id,
        currency: DEFAULT_CURRENCY,
        collection_method: paymentType === 'bank_transfer' ? 'bank_transfer' : 'send_invoice',
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating invoice with Stripe ID:', updateError)
    }

    // Optionally finalize and send
    if (options.autoSend) {
      const sendResult = await sendStripeInvoice(invoiceId)
      if (sendResult.error) {
        return { stripeInvoiceId: stripeInvoice.id, error: sendResult.error }
      }
    }

    revalidatePath(`/cases/${invoice.case_id}`)
    return { stripeInvoiceId: stripeInvoice.id }
  } catch (err: any) {
    console.error('Stripe invoice creation failed:', err)
    return { error: err.message || 'Failed to create Stripe invoice' }
  }
}

/**
 * Finalize and send a Stripe invoice
 */
export async function sendStripeInvoice(invoiceId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('stripe_invoice_id, case_id')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice?.stripe_invoice_id) {
    return { error: 'Invoice not found or not linked to Stripe' }
  }

  try {
    // Finalize the invoice (makes it ready to pay)
    const finalizedInvoice = await getStripe().invoices.finalizeInvoice(invoice.stripe_invoice_id)

    // Send it to the customer
    const sentInvoice = await getStripe().invoices.sendInvoice(invoice.stripe_invoice_id)

    // Update our record
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        stripe_hosted_invoice_url: sentInvoice.hosted_invoice_url,
        stripe_invoice_pdf: sentInvoice.invoice_pdf,
        payment_link: sentInvoice.hosted_invoice_url,
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating invoice status:', updateError)
    }

    revalidatePath(`/cases/${invoice.case_id}`)
    return { success: true }
  } catch (err: any) {
    console.error('Stripe invoice send failed:', err)
    return { error: err.message || 'Failed to send invoice' }
  }
}

/**
 * Void/cancel a Stripe invoice
 */
export async function voidStripeInvoice(invoiceId: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('stripe_invoice_id, case_id, status')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return { error: 'Invoice not found' }
  }

  // If no Stripe invoice, just update local status
  if (!invoice.stripe_invoice_id) {
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'cancelled',
        voided_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (updateError) return { error: 'Failed to cancel invoice' }
    revalidatePath(`/cases/${invoice.case_id}`)
    return { success: true }
  }

  try {
    await getStripe().invoices.voidInvoice(invoice.stripe_invoice_id)

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'cancelled',
        voided_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating voided invoice:', updateError)
    }

    revalidatePath(`/cases/${invoice.case_id}`)
    return { success: true }
  } catch (err: any) {
    console.error('Stripe void invoice failed:', err)
    return { error: err.message || 'Failed to void invoice' }
  }
}

/**
 * Mark a Stripe invoice as paid out of band (bank transfer, cash, etc.)
 * This will also send a receipt to the customer
 */
export async function markStripeInvoicePaid(invoiceId: string): Promise<{ success?: boolean; error?: string }> {
  if (!isStripeConfigured()) {
    return { error: 'Stripe is not configured' }
  }
  
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('stripe_invoice_id, case_id, installment_id')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return { error: 'Invoice not found' }
  }

  if (!invoice.stripe_invoice_id) {
    return { error: 'Invoice not linked to Stripe' }
  }

  try {
    // Mark as paid in Stripe - this sends a receipt to the customer automatically
    await getStripe().invoices.pay(invoice.stripe_invoice_id, {
      paid_out_of_band: true,
    })

    // Update our invoice record
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'bank_transfer',
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating paid invoice:', updateError)
    }

    // Mark the installment as paid
    if (invoice.installment_id) {
      await supabase
        .from('installments')
        .update({ paid: true })
        .eq('id', invoice.installment_id)
    }

    revalidatePath(`/cases/${invoice.case_id}`)
    return { success: true }
  } catch (err: any) {
    console.error('Stripe mark paid failed:', err)
    return { error: err.message || 'Failed to mark invoice as paid' }
  }
}

/**
 * Send/resend receipt for a paid invoice
 * Gets the charge from the invoice and sends receipt to customer email
 */
export async function sendInvoiceReceipt(invoiceId: string): Promise<{ success?: boolean; receiptUrl?: string; error?: string }> {
  if (!isStripeConfigured()) {
    return { error: 'Stripe is not configured' }
  }
  
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('stripe_invoice_id, case_id, status')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return { error: 'Invoice not found' }
  }

  if (!invoice.stripe_invoice_id) {
    return { error: 'Invoice not linked to Stripe' }
  }

  if (invoice.status !== 'paid') {
    return { error: 'Can only send receipts for paid invoices' }
  }

  try {
    // Get the Stripe invoice to find the charge
    const stripeInvoice = await getStripe().invoices.retrieve(invoice.stripe_invoice_id)
    
    // Get the charge associated with the invoice
    // For invoices, the charge ID is in the charge field
    const chargeId = stripeInvoice.charge as string | null
    
    if (!chargeId) {
      // Invoice was marked paid out of band, no charge exists
      // In this case, we can only provide the hosted invoice URL which shows paid status
      return { 
        success: true, 
        receiptUrl: stripeInvoice.hosted_invoice_url || undefined 
      }
    }

    // Get the charge to find the receipt URL and customer email
    const charge = await getStripe().charges.retrieve(chargeId)
    
    // Get the customer email from the invoice
    const customerEmail = stripeInvoice.customer_email
    
    if (customerEmail && charge.id) {
      // Update the charge to send a new receipt email
      await getStripe().charges.update(charge.id, {
        receipt_email: customerEmail,
      })
    }

    return { 
      success: true, 
      receiptUrl: charge.receipt_url || stripeInvoice.hosted_invoice_url || undefined 
    }
  } catch (err: any) {
    console.error('Stripe send receipt failed:', err)
    return { error: err.message || 'Failed to send receipt' }
  }
}

/**
 * Get receipt URL for a paid invoice
 * Returns the Stripe receipt URL if available
 */
export async function getInvoiceReceiptUrl(invoiceId: string): Promise<{ receiptUrl?: string; error?: string }> {
  if (!isStripeConfigured()) {
    return { error: 'Stripe is not configured' }
  }
  
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('stripe_invoice_id, status')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return { error: 'Invoice not found' }
  }

  if (!invoice.stripe_invoice_id) {
    return { error: 'Invoice not linked to Stripe' }
  }

  if (invoice.status !== 'paid') {
    return { error: 'Invoice is not paid' }
  }

  try {
    const stripeInvoice = await getStripe().invoices.retrieve(invoice.stripe_invoice_id)
    
    const chargeId = stripeInvoice.charge as string | null
    
    if (chargeId) {
      const charge = await getStripe().charges.retrieve(chargeId)
      if (charge.receipt_url) {
        return { receiptUrl: charge.receipt_url }
      }
    }
    
    // Fallback to hosted invoice URL
    return { receiptUrl: stripeInvoice.hosted_invoice_url || undefined }
  } catch (err: any) {
    console.error('Failed to get receipt URL:', err)
    return { error: err.message || 'Failed to get receipt' }
  }
}

/**
 * Get payment link for an invoice (creates Stripe invoice if needed)
 */
export async function getInvoicePaymentLink(invoiceId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('stripe_invoice_id, stripe_hosted_invoice_url, payment_link')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return { error: 'Invoice not found' }
  }

  // Return existing URL if available
  if (invoice.stripe_hosted_invoice_url) {
    return { url: invoice.stripe_hosted_invoice_url }
  }

  if (invoice.payment_link) {
    return { url: invoice.payment_link }
  }

  // If no Stripe invoice yet, create one
  if (!invoice.stripe_invoice_id) {
    const createResult = await createStripeInvoice(invoiceId, { autoSend: true })
    if (createResult.error) {
      return { error: createResult.error }
    }
    
    // Fetch updated invoice
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('stripe_hosted_invoice_url')
      .eq('id', invoiceId)
      .single()

    return { url: updatedInvoice?.stripe_hosted_invoice_url }
  }

  // Has Stripe ID but no URL - fetch from Stripe
  try {
    const stripeInvoice = await getStripe().invoices.retrieve(invoice.stripe_invoice_id)
    
    if (stripeInvoice.hosted_invoice_url) {
      // Save it
      await supabase
        .from('invoices')
        .update({
          stripe_hosted_invoice_url: stripeInvoice.hosted_invoice_url,
          payment_link: stripeInvoice.hosted_invoice_url,
        })
        .eq('id', invoiceId)

      return { url: stripeInvoice.hosted_invoice_url }
    }

    return { error: 'Invoice not yet finalized' }
  } catch (err: any) {
    return { error: err.message || 'Failed to get payment link' }
  }
}

// ============================================
// INVOICE STATUS SYNC
// ============================================

/**
 * Manually sync invoice status from Stripe
 * Useful when webhooks aren't available
 */
export async function syncInvoiceStatus(invoiceId: string): Promise<{ status?: string; error?: string }> {
  const supabase = await createClient()

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('stripe_invoice_id, case_id, installment_id')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice?.stripe_invoice_id) {
    return { error: 'Invoice not found or not linked to Stripe' }
  }

  try {
    const stripeInvoice = await getStripe().invoices.retrieve(invoice.stripe_invoice_id)

    // Map Stripe status to our status
    let status: string = invoice.stripe_invoice_id ? 'draft' : 'draft'
    let paid = false

    switch (stripeInvoice.status) {
      case 'draft':
        status = 'draft'
        break
      case 'open':
        status = 'sent'
        break
      case 'paid':
        status = 'paid'
        paid = true
        break
      case 'void':
        status = 'cancelled'
        break
      case 'uncollectible':
        status = 'cancelled'
        break
    }

    // Update invoice
    await supabase
      .from('invoices')
      .update({
        status,
        paid_at: paid ? stripeInvoice.status_transitions?.paid_at 
          ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString() 
          : new Date().toISOString()
          : null,
        stripe_hosted_invoice_url: stripeInvoice.hosted_invoice_url,
        stripe_invoice_pdf: stripeInvoice.invoice_pdf,
      })
      .eq('id', invoiceId)

    // If paid, also mark installment as paid
    if (paid && invoice.installment_id) {
      await supabase
        .from('installments')
        .update({ paid: true })
        .eq('id', invoice.installment_id)
    }

    revalidatePath(`/cases/${invoice.case_id}`)
    return { status }
  } catch (err: any) {
    console.error('Stripe status sync failed:', err)
    return { error: err.message || 'Failed to sync invoice status' }
  }
}
