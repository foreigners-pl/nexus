import { NextRequest, NextResponse } from 'next/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    console.error('Stripe not configured')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }
  
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(supabase, invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(supabase, invoice)
        break
      }

      case 'invoice.sent': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoiceSent(supabase, invoice)
        break
      }

      case 'invoice.finalized': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoiceFinalized(supabase, invoice)
        break
      }

      case 'invoice.voided': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoiceVoided(supabase, invoice)
        break
      }

      case 'customer.created': {
        // Just log - customer creation is initiated from our side
        console.log('Stripe customer created:', event.data.object.id)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

async function handleInvoicePaid(supabase: any, stripeInvoice: Stripe.Invoice) {
  const invoiceId = stripeInvoice.metadata?.invoice_id
  if (!invoiceId) {
    console.log('Invoice paid but no invoice_id in metadata')
    return
  }

  // Get payment_intent from invoice (with type assertion for SDK compatibility)
  const invoiceData = stripeInvoice as unknown as { payment_intent: string | { id: string } | null }
  const paymentIntentId = typeof invoiceData.payment_intent === 'string' 
    ? invoiceData.payment_intent 
    : invoiceData.payment_intent?.id

  // Update invoice status
  const { data: invoice, error } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq('id', invoiceId)
    .select('installment_id')
    .single()

  if (error) {
    console.error('Error updating invoice to paid:', error)
    return
  }

  // Mark installment as paid
  if (invoice?.installment_id) {
    await supabase
      .from('installments')
      .update({ paid: true })
      .eq('id', invoice.installment_id)
  }

  console.log(`Invoice ${invoiceId} marked as paid`)
}

async function handleInvoicePaymentFailed(supabase: any, stripeInvoice: Stripe.Invoice) {
  const invoiceId = stripeInvoice.metadata?.invoice_id
  if (!invoiceId) return

  // Keep status as 'sent' but could add a payment_failed flag if needed
  console.log(`Payment failed for invoice ${invoiceId}`)
}

async function handleInvoiceSent(supabase: any, stripeInvoice: Stripe.Invoice) {
  const invoiceId = stripeInvoice.metadata?.invoice_id
  if (!invoiceId) return

  await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      stripe_hosted_invoice_url: stripeInvoice.hosted_invoice_url,
      stripe_invoice_pdf: stripeInvoice.invoice_pdf,
      payment_link: stripeInvoice.hosted_invoice_url,
    })
    .eq('id', invoiceId)

  console.log(`Invoice ${invoiceId} marked as sent`)
}

async function handleInvoiceFinalized(supabase: any, stripeInvoice: Stripe.Invoice) {
  const invoiceId = stripeInvoice.metadata?.invoice_id
  if (!invoiceId) return

  await supabase
    .from('invoices')
    .update({
      stripe_hosted_invoice_url: stripeInvoice.hosted_invoice_url,
      stripe_invoice_pdf: stripeInvoice.invoice_pdf,
      payment_link: stripeInvoice.hosted_invoice_url,
    })
    .eq('id', invoiceId)

  console.log(`Invoice ${invoiceId} finalized`)
}

async function handleInvoiceVoided(supabase: any, stripeInvoice: Stripe.Invoice) {
  const invoiceId = stripeInvoice.metadata?.invoice_id
  if (!invoiceId) return

  await supabase
    .from('invoices')
    .update({
      status: 'cancelled',
      voided_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  console.log(`Invoice ${invoiceId} voided`)
}