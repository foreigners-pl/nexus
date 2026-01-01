import { NextResponse } from 'next/server'
import { getInstallmentsForAutoInvoice, clearAutomaticInvoice } from '@/app/actions/installments'
import { createInvoice } from '@/app/actions/invoices'
import { createStripeInvoice } from '@/app/actions/stripe'

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Auto-Invoice Cron] Starting...')
  
  const results: { success: string[]; failed: string[] } = {
    success: [],
    failed: []
  }

  try {
    // Get all installments with automatic_invoice = true AND due_date <= today
    const { installments, error } = await getInstallmentsForAutoInvoice()
    
    if (error) {
      console.error('[Auto-Invoice Cron] Error fetching installments:', error)
      return NextResponse.json({ error }, { status: 500 })
    }

    console.log(`[Auto-Invoice Cron] Found ${installments.length} installments to process`)

    for (const installment of installments) {
      const caseData = (installment as any).cases
      const client = caseData?.clients
      
      // Skip if no client email
      if (!client?.contact_email) {
        console.log(`[Auto-Invoice Cron] Skipping installment ${installment.id} - no client email`)
        results.failed.push(`${installment.id}: No client email`)
        continue
      }

      // Skip if amount is 0 or negative
      if (!installment.amount || installment.amount <= 0) {
        console.log(`[Auto-Invoice Cron] Skipping installment ${installment.id} - invalid amount`)
        results.failed.push(`${installment.id}: Invalid amount`)
        continue
      }

      try {
        // Generate invoice name
        const invoiceName = installment.is_down_payment 
          ? 'Down Payment' 
          : `Installment Payment`

        // Create local invoice record
        const invoiceResult = await createInvoice(
          caseData.id,
          installment.id,
          invoiceName,
          installment.amount,
          installment.due_date
        )

        if (invoiceResult.error || !invoiceResult.invoice) {
          console.error(`[Auto-Invoice Cron] Failed to create invoice for ${installment.id}:`, invoiceResult.error)
          results.failed.push(`${installment.id}: ${invoiceResult.error || 'Failed to create invoice'}`)
          continue
        }

        // Create and send via Stripe
        // For auto-invoices, set due date to 14 days from now (the send date)
        const autoInvoiceDueDate = new Date()
        autoInvoiceDueDate.setDate(autoInvoiceDueDate.getDate() + 14)
        
        const stripeResult = await createStripeInvoice(invoiceResult.invoice.id, {
          autoSend: true,
          paymentType: 'online', // Default to online payment for auto-invoices
          dueDate: autoInvoiceDueDate.toISOString().split('T')[0]
        })

        if (stripeResult.error) {
          console.error(`[Auto-Invoice Cron] Stripe error for ${installment.id}:`, stripeResult.error)
          results.failed.push(`${installment.id}: Stripe - ${stripeResult.error}`)
          continue
        }

        // Clear the automatic_invoice flag to prevent re-sending
        await clearAutomaticInvoice(installment.id)

        console.log(`[Auto-Invoice Cron] Successfully sent invoice for installment ${installment.id}`)
        results.success.push(installment.id)

      } catch (err: any) {
        console.error(`[Auto-Invoice Cron] Error processing installment ${installment.id}:`, err)
        results.failed.push(`${installment.id}: ${err.message || 'Unknown error'}`)
      }
    }

    console.log(`[Auto-Invoice Cron] Complete. Success: ${results.success.length}, Failed: ${results.failed.length}`)

    return NextResponse.json({
      message: 'Auto-invoice cron completed',
      processed: installments.length,
      success: results.success.length,
      failed: results.failed.length,
      details: results
    })

  } catch (err: any) {
    console.error('[Auto-Invoice Cron] Fatal error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request)
}
