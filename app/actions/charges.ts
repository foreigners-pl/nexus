'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type ChargeKind = 'down_payment' | 'installment' | 'balance' | 'one_off' | 'recurring'

export interface ChargeV2 {
  id: string
  case_id: string
  legacy_installment_id: string | null
  name: string | null
  amount: number
  due_date: string | null
  position: number
  kind: ChargeKind
  recur_day: number | null
  automatic_invoice: boolean
  cancelled: boolean
  created_at: string
  // derived
  paid_amount: number
  status: 'paid' | 'partial' | 'invoiced' | 'overdue' | 'scheduled' | 'cancelled'
}

export interface PaymentV2 {
  id: string
  case_id: string
  charge_id: string | null
  invoice_id: string | null
  amount: number
  method: string
  paid_at: string
  note: string | null
  created_at: string
}

export interface InvoiceV2 {
  id: string
  invoice_number: string | null
  invoice_name: string
  amount: number
  status: string | null
  sent_at: string | null
  paid_at: string | null
  due_date: string | null
  payment_link: string | null
  created_at: string
  charge_ids: string[]
  charge_names: string[]
}

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

/** Keep the 'balance' charge equal to total minus the other charges. */
async function resyncBalanceCharge(supabase: SupabaseClient, caseId: string) {
  const total = await getCaseTotal(supabase, caseId)
  const { data: rows } = await supabase
    .from('charges')
    .select('id, amount, position, kind, cancelled')
    .eq('case_id', caseId)

  const all = rows || []
  const balance = all.find((c: any) => c.kind === 'balance')
  const scheduled = all
    .filter((c: any) => c.kind !== 'balance' && !c.cancelled)
    .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0)
  const remainder = Math.max(0, total - scheduled)

  if (!balance) {
    if (total <= 0) return
    const maxPos = all.reduce((m: number, c: any) => Math.max(m, c.position || 0), 0)
    await supabase.from('charges').insert({ case_id: caseId, amount: remainder, kind: 'balance', position: maxPos + 1 })
  } else if (Number(balance.amount) !== remainder) {
    await supabase.from('charges').update({ amount: remainder }).eq('id', balance.id)
  }
}

function deriveStatus(charge: any, paidAmount: number, hasOpenInvoice: boolean): ChargeV2['status'] {
  if (charge.cancelled) return 'cancelled'
  if (paidAmount >= Number(charge.amount) && Number(charge.amount) > 0) return 'paid'
  if (paidAmount > 0) return 'partial'
  if (hasOpenInvoice) return 'invoiced'
  if (charge.due_date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(charge.due_date) < today) return 'overdue'
  }
  return 'scheduled'
}

export async function getCaseBillingV2(idOrCode: string) {
  const supabase = await createClient()

  const { data: caseRow } = idOrCode.startsWith('C')
    ? await supabase.from('cases').select('*').eq('case_code', idOrCode).single()
    : await supabase.from('cases').select('*').eq('id', idOrCode).single()

  if (!caseRow) return { error: 'Case not found' as const }

  const [clientRes, servicesRes, chargesRes, paymentsRes, invoicesRes] = await Promise.all([
    caseRow.client_id
      ? supabase.from('clients').select('*').eq('id', caseRow.client_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('case_services').select('*, services(*)').eq('case_id', caseRow.id),
    supabase.from('charges').select('*').eq('case_id', caseRow.id).order('position', { ascending: true }),
    supabase.from('payments').select('*').eq('case_id', caseRow.id).order('paid_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('case_id', caseRow.id).order('created_at', { ascending: false }),
  ])

  const invoiceIds = (invoicesRes.data || []).map((v: any) => v.id)
  const { data: linkRows } = invoiceIds.length
    ? await supabase.from('invoice_charges').select('invoice_id, charge_id, charges(name)').in('invoice_id', invoiceIds)
    : { data: [] }

  const rawCharges = chargesRes.data || []
  const payments = (paymentsRes.data || []) as PaymentV2[]
  const links = (linkRows || []) as any[]

  const paidByCharge = new Map<string, number>()
  for (const p of payments) {
    if (p.charge_id) paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) || 0) + Number(p.amount))
  }

  const openInvoiceChargeIds = new Set<string>()
  const paidInvoiceChargeIds = new Set<string>()
  const linksByInvoice = new Map<string, { ids: string[]; names: string[] }>()
  for (const l of links) {
    const entry = linksByInvoice.get(l.invoice_id) || { ids: [], names: [] }
    entry.ids.push(l.charge_id)
    if (l.charges?.name) entry.names.push(l.charges.name)
    linksByInvoice.set(l.invoice_id, entry)
  }
  const invoiceStatusById = new Map((invoicesRes.data || []).map((v: any) => [v.id, v.status]))
  for (const [invId, entry] of linksByInvoice) {
    const st = invoiceStatusById.get(invId)
    if (st === 'paid') entry.ids.forEach(id => paidInvoiceChargeIds.add(id))
    else if (st && st !== 'cancelled' && st !== 'draft') {
      entry.ids.forEach(id => openInvoiceChargeIds.add(id))
    }
  }

  const charges: ChargeV2[] = rawCharges.map((c: any) => {
    // A paid invoice covering the charge settles it in full — the money may
    // have arrived via Stripe webhook rather than a manual payment row
    const paid = paidInvoiceChargeIds.has(c.id)
      ? Number(c.amount)
      : (paidByCharge.get(c.id) || 0)
    return { ...c, amount: Number(c.amount), paid_amount: paid, status: deriveStatus(c, paid, openInvoiceChargeIds.has(c.id)) }
  })

  const invoices: InvoiceV2[] = (invoicesRes.data || []).map((v: any) => ({
    id: v.id,
    invoice_number: v.invoice_number,
    invoice_name: v.invoice_name,
    amount: Number(v.amount),
    status: v.status,
    sent_at: v.sent_at,
    paid_at: v.paid_at,
    due_date: v.due_date,
    payment_link: v.payment_link,
    created_at: v.created_at,
    charge_ids: linksByInvoice.get(v.id)?.ids || [],
    charge_names: linksByInvoice.get(v.id)?.names || [],
  }))

  const total = await getCaseTotal(supabase, caseRow.id)

  return {
    case: caseRow,
    client: clientRes.data,
    caseServices: servicesRes.data || [],
    total,
    charges,
    payments,
    invoices,
  }
}

export async function addCharge(caseId: string, opts: {
  name?: string
  amount: number
  dueDate?: string
  kind?: ChargeKind
  recurDay?: number
  automaticInvoice?: boolean
}) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('charges').select('position').eq('case_id', caseId)
    .order('position', { ascending: false }).limit(1)
  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 1

  const { error } = await supabase.from('charges').insert({
    case_id: caseId,
    name: opts.name || null,
    amount: opts.amount,
    due_date: opts.dueDate || null,
    kind: opts.kind || 'installment',
    recur_day: opts.kind === 'recurring' ? (opts.recurDay || null) : null,
    automatic_invoice: opts.automaticInvoice || false,
    position: nextPosition,
  })

  if (error) {
    console.error('Error adding charge:', error)
    return { error: 'Failed to add charge' }
  }

  await resyncBalanceCharge(supabase, caseId)
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function updateCharge(chargeId: string, caseId: string, fields: {
  name?: string | null
  amount?: number
  dueDate?: string | null
  automaticInvoice?: boolean
  recurDay?: number | null
  kind?: ChargeKind
}) {
  const supabase = await createClient()

  const update: Record<string, any> = {}
  if (fields.name !== undefined) update.name = fields.name
  if (fields.amount !== undefined) update.amount = fields.amount
  if (fields.dueDate !== undefined) update.due_date = fields.dueDate
  if (fields.automaticInvoice !== undefined) update.automatic_invoice = fields.automaticInvoice
  if (fields.recurDay !== undefined) update.recur_day = fields.recurDay
  if (fields.kind !== undefined) update.kind = fields.kind

  const { error } = await supabase.from('charges').update(update).eq('id', chargeId)
  if (error) {
    console.error('Error updating charge:', error)
    return { error: 'Failed to update charge' }
  }

  await resyncBalanceCharge(supabase, caseId)
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function deleteCharge(chargeId: string, caseId: string) {
  const supabase = await createClient()

  const { data: charge } = await supabase.from('charges').select('kind').eq('id', chargeId).single()
  if (charge?.kind === 'balance') return { error: 'Cannot delete the remainder charge' }

  const { error } = await supabase.from('charges').delete().eq('id', chargeId)
  if (error) {
    console.error('Error deleting charge:', error)
    return { error: 'Failed to delete charge' }
  }

  await resyncBalanceCharge(supabase, caseId)
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

/** Record money received against a charge (supports partial payments). */
export async function recordPayment(caseId: string, chargeId: string, amount: number, method: string, note?: string, paidAt?: string, invoiceId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('payments').insert({
    case_id: caseId,
    charge_id: chargeId,
    invoice_id: invoiceId || null,
    amount,
    method: method || 'manual',
    paid_at: paidAt || undefined,
    note: note || null,
    created_by: user?.id || null,
  })

  if (error) {
    console.error('Error recording payment:', error)
    return { error: 'Failed to record payment' }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

/** Refund = a negative payment. Can be tied to a charge or the case overall. */
export async function recordRefund(caseId: string, chargeId: string | null, amount: number, note?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('payments').insert({
    case_id: caseId,
    charge_id: chargeId,
    amount: -Math.abs(amount),
    method: 'refund',
    note: note || null,
    created_by: user?.id || null,
  })

  if (error) {
    console.error('Error recording refund:', error)
    return { error: 'Failed to record refund' }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

/** One invoice covering N charges — replaces the one-installment-per-invoice limit. */
export async function createInvoiceFromCharges(caseId: string, chargeIds: string[], invoiceName: string, amount: number, dueDate?: string) {
  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      case_id: caseId,
      installment_id: null,
      invoice_name: invoiceName,
      amount,
      due_date: dueDate || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error || !invoice) {
    console.error('Error creating invoice:', error)
    return { error: 'Failed to create invoice' }
  }

  const { error: linkError } = await supabase
    .from('invoice_charges')
    .insert(chargeIds.map(charge_id => ({ invoice_id: invoice.id, charge_id })))

  if (linkError) {
    console.error('Error linking charges:', linkError)
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { error: 'Failed to link charges to invoice' }
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true, invoice }
}

/** Replace the set of charges an invoice covers. */
export async function linkInvoiceCharges(invoiceId: string, chargeIds: string[]) {
  const supabase = await createClient()
  await supabase.from('invoice_charges').delete().eq('invoice_id', invoiceId)
  if (chargeIds.length) {
    const { error } = await supabase
      .from('invoice_charges')
      .insert(chargeIds.map(charge_id => ({ invoice_id: invoiceId, charge_id })))
    if (error) {
      console.error('Error linking charges:', error)
      return { error: 'Failed to link charges' }
    }
  }
  return { success: true }
}

/**
 * Mark an invoice paid and write a payment row for each linked charge's
 * remaining balance — one place where "paid" becomes real money data.
 */
export async function markInvoicePaidCharges(invoiceId: string, caseId: string, paidAt?: string, method?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const now = paidAt || new Date().toISOString()

  const { error: invErr } = await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: now })
    .eq('id', invoiceId)
  if (invErr) {
    console.error('Error marking invoice paid:', invErr)
    return { error: 'Failed to mark invoice paid' }
  }

  // Settle each linked charge with a payment row covering what remains
  const { data: links } = await supabase
    .from('invoice_charges')
    .select('charge_id, charges(id, amount, case_id)')
    .eq('invoice_id', invoiceId)

  for (const l of links || []) {
    const charge = (l as any).charges
    if (!charge) continue
    const { data: existing } = await supabase
      .from('payments').select('amount').eq('charge_id', charge.id)
    const alreadyPaid = (existing || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
    const remaining = Number(charge.amount) - alreadyPaid
    if (remaining <= 0) continue
    await supabase.from('payments').insert({
      case_id: caseId,
      charge_id: charge.id,
      invoice_id: invoiceId,
      amount: remaining,
      method: method || 'bank_transfer',
      paid_at: now,
      note: 'Invoice paid',
      created_by: user?.id || null,
    })
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

/** Duplicate an invoice and carry over its charge links. */
export async function duplicateChargeInvoice(invoiceId: string, caseId: string) {
  const supabase = await createClient()
  const { duplicateInvoice } = await import('./invoices')
  const res = await duplicateInvoice(invoiceId, caseId)
  if (res.error || !res.invoice) return res

  const { data: links } = await supabase
    .from('invoice_charges').select('charge_id, amount').eq('invoice_id', invoiceId)
  if (links?.length) {
    await supabase.from('invoice_charges')
      .insert(links.map((l: any) => ({ invoice_id: res.invoice.id, charge_id: l.charge_id, amount: l.amount })))
  }
  return res
}
