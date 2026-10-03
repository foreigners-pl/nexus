'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

/** The case's billing total: manual override, else the attached service price(s). */
async function getCaseTotal(supabase: SupabaseClient, caseId: string): Promise<number> {
  const { data: c } = await supabase.from('cases').select('total_price').eq('id', caseId).single()
  if (c?.total_price != null) return Number(c.total_price)

  const { data: css } = await supabase
    .from('case_services')
    .select('custom_price, services(gross_price)')
    .eq('case_id', caseId)
  return (css || []).reduce((sum: number, cs: any) => sum + Number(cs.custom_price ?? cs.services?.gross_price ?? 0), 0)
}

/**
 * Keeps the case's balance installment equal to total minus the scheduled installments.
 * Creates the balance row when the case has a price; updates it as installments change.
 */
async function resyncBalanceInstallment(supabase: SupabaseClient, caseId: string) {
  const total = await getCaseTotal(supabase, caseId)
  const { data: insts } = await supabase
    .from('installments')
    .select('id, amount, position, is_balance, parent_installment_id')
    .eq('case_id', caseId)

  const all = insts || []
  const balance = all.find((i: any) => i.is_balance)
  const scheduled = all
    .filter((i: any) => !i.is_balance && !i.parent_installment_id)
    .reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0)
  const remainder = Math.max(0, total - scheduled)

  if (!balance) {
    if (total <= 0) return // nothing to balance
    const maxPos = all.reduce((m: number, i: any) => Math.max(m, i.position || 0), 0)
    await supabase.from('installments').insert({
      case_id: caseId,
      amount: remainder,
      is_balance: true,
      is_down_payment: false,
      automatic_invoice: false,
      position: maxPos + 1,
    })
  } else if (Number(balance.amount) !== remainder) {
    await supabase.from('installments').update({ amount: remainder }).eq('id', balance.id)
  }
}

/** Ensure the balance installment exists and matches the current total (idempotent). */
export async function ensureBalanceInstallment(caseId: string) {
  const supabase = await createClient()
  await resyncBalanceInstallment(supabase, caseId)
  return { success: true }
}

/** Set (or clear) the case's billing total, then resync the balance installment. */
export async function setCaseTotal(caseId: string, amount: number | null) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cases')
    .update({ total_price: amount })
    .eq('id', caseId)

  if (error) {
    console.error('Error setting case total:', error)
    return { error: 'Failed to update total' }
  }

  await resyncBalanceInstallment(supabase, caseId)
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function addInstallment(caseId: string, amount: number, dueDate?: string, automaticInvoice: boolean = false) {
  const supabase = await createClient()

  // Get the next position
  const { data: existingInstallments } = await supabase
    .from('installments')
    .select('position')
    .eq('case_id', caseId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existingInstallments && existingInstallments.length > 0 
    ? existingInstallments[0].position + 1 
    : 1

  const { error } = await supabase
    .from('installments')
    .insert({
      case_id: caseId,
      amount,
      due_date: dueDate || null,
      automatic_invoice: automaticInvoice,
      is_down_payment: false,
      position: nextPosition,
    })

  if (error) {
    console.error('Error adding installment:', error)
    return { error: 'Failed to add installment' }
  }

  await resyncBalanceInstallment(supabase, caseId)
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function updateInstallment(installmentId: string, caseId: string, formData: FormData) {
  const supabase = await createClient()

  const amount = parseFloat(formData.get('amount') as string)
  const dueDate = formData.get('dueDate') as string
  const automaticInvoice = formData.get('automaticInvoice') === 'true'
  const name = (formData.get('name') as string)?.trim() || null

  const { error } = await supabase
    .from('installments')
    .update({
      name,
      amount,
      due_date: dueDate || null,
      automatic_invoice: automaticInvoice,
    })
    .eq('id', installmentId)

  if (error) {
    console.error('Error updating installment:', error)
    return { error: 'Failed to update installment' }
  }

  await resyncBalanceInstallment(supabase, caseId)
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function deleteInstallment(installmentId: string, caseId: string) {
  const supabase = await createClient()

  // Check if it's a down payment (refunds have negative amounts, so check that too)
  const { data: installment } = await supabase
    .from('installments')
    .select('is_down_payment, is_balance, position, amount')
    .eq('id', installmentId)
    .single()

  // Only block deletion of down payments with positive amounts (not refunds)
  if (installment?.is_down_payment && (installment?.amount || 0) >= 0) {
    return { error: 'Cannot delete down payment' }
  }
  if (installment?.is_balance) {
    return { error: 'Cannot delete the final balance installment' }
  }

  // Delete associated invoices first (before installment deletion sets them to NULL)
  const { error: invoiceDeleteError } = await supabase
    .from('invoices')
    .delete()
    .eq('installment_id', installmentId)

  if (invoiceDeleteError) {
    console.error('Error deleting associated invoices:', invoiceDeleteError)
    // Continue anyway - invoice foreign key is SET NULL so installment delete will still work
  }

  const { error } = await supabase
    .from('installments')
    .delete()
    .eq('id', installmentId)

  if (error) {
    console.error('Error deleting installment:', error)
    return { error: 'Failed to delete installment' }
  }

  // Reorder remaining installments
  const { data: remainingInstallments } = await supabase
    .from('installments')
    .select('id')
    .eq('case_id', caseId)
    .order('position', { ascending: true })

  if (remainingInstallments) {
    for (let i = 0; i < remainingInstallments.length; i++) {
      await supabase
        .from('installments')
        .update({ position: i + 1 })
        .eq('id', remainingInstallments[i].id)
    }
  }

  await resyncBalanceInstallment(supabase, caseId)
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function mergeInstallments(installmentId: string, caseId: string) {
  const supabase = await createClient()

  // Get the current installment
  const { data: currentInstallment } = await supabase
    .from('installments')
    .select('*')
    .eq('id', installmentId)
    .single()

  if (!currentInstallment) {
    return { error: 'Installment not found' }
  }

  // Get the installment above (previous position)
  const { data: previousInstallment } = await supabase
    .from('installments')
    .select('*')
    .eq('case_id', caseId)
    .eq('position', currentInstallment.position - 1)
    .single()

  if (!previousInstallment) {
    return { error: 'No installment to merge with' }
  }

  // Update the previous installment's amount
  const newAmount = parseFloat(previousInstallment.amount) + parseFloat(currentInstallment.amount)
  
  const { error: updateError } = await supabase
    .from('installments')
    .update({ amount: newAmount })
    .eq('id', previousInstallment.id)

  if (updateError) {
    console.error('Error merging installments:', updateError)
    return { error: 'Failed to merge installments' }
  }

  // Delete the current installment
  await deleteInstallment(installmentId, caseId)

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function createDownPayment(caseId: string, amount: number, dueDate?: string, automaticInvoice: boolean = false) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('installments')
    .insert({
      case_id: caseId,
      amount,
      due_date: dueDate || null,
      automatic_invoice: automaticInvoice,
      is_down_payment: true,
      position: 1,
    })

  if (error) {
    console.error('Error creating down payment:', error)
    return { error: 'Failed to create down payment' }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

/**
 * Clear automatic_invoice after an invoice has been sent
 * This prevents the cron job from sending duplicate invoices
 */
export async function clearAutomaticInvoice(installmentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('installments')
    .update({ automatic_invoice: false })
    .eq('id', installmentId)

  if (error) {
    console.error('Error clearing automatic_invoice:', error)
    return { error: 'Failed to clear automatic invoice flag' }
  }

  return { success: true }
}

/**
 * Get all installments that need auto-invoicing today
 * Uses automatic_invoice = true AND due_date <= today
 */
export async function getInstallmentsForAutoInvoice() {
  const supabase = await createClient()
  
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('installments')
    .select(`
      *,
      cases (
        id,
        client_id,
        clients (
          id,
          first_name,
          last_name,
          contact_email,
          stripe_customer_id
        )
      )
    `)
    .eq('paid', false)
    .eq('automatic_invoice', true)
    .lte('due_date', today)
    .not('due_date', 'is', null)

  if (error) {
    console.error('Error fetching auto-invoice installments:', error)
    return { error: 'Failed to fetch installments', installments: [] }
  }

  return { installments: data || [] }
}
