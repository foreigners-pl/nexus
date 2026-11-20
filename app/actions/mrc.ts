'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendInvoiceEmailWithClient } from './invoices'
import type { InvoiceBillTo } from '@/lib/invoice-pdf'

export async function getMrcCharges(caseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mrc_charges')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('Error fetching MRC charges:', error)
    return { charges: [] }
  }
  return { charges: data || [] }
}

// MRC-generated invoices for the case
export async function getMrcInvoices(caseId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('case_id', caseId)
    .not('mrc_charge_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error) return { invoices: [] }
  return { invoices: data || [] }
}

// convertInstallmentId: when set, the source installment is deleted so it
// stops counting toward the case balance (MRCs are recurring, not debt).
export async function createMrcCharge(
  caseId: string,
  fields: {
    name: string
    amount: number
    dayOfMonth: number
    autosend: boolean
    recipientEmails: string[]
    billTo?: InvoiceBillTo | null
    convertInstallmentId?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('mrc_charges')
    .insert({
      case_id: caseId,
      name: fields.name,
      amount: fields.amount,
      day_of_month: Math.min(31, Math.max(1, Math.round(fields.dayOfMonth))),
      autosend: fields.autosend,
      recipient_emails: fields.recipientEmails.filter(Boolean),
      bill_to: fields.billTo || null,
      active: true,
      created_by: user?.id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating MRC charge:', error)
    return { error: 'Failed to create recurring charge' }
  }

  if (fields.convertInstallmentId) {
    await supabase.from('installments').delete().eq('id', fields.convertInstallmentId)
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true, charge: data }
}

export async function updateMrcCharge(
  chargeId: string,
  caseId: string,
  fields: {
    name?: string
    amount?: number
    dayOfMonth?: number
    autosend?: boolean
    recipientEmails?: string[]
    active?: boolean
  }
) {
  const supabase = await createClient()
  const update: any = {}
  if (fields.name !== undefined) update.name = fields.name
  if (fields.amount !== undefined) update.amount = fields.amount
  if (fields.dayOfMonth !== undefined) update.day_of_month = Math.min(31, Math.max(1, Math.round(fields.dayOfMonth)))
  if (fields.autosend !== undefined) update.autosend = fields.autosend
  if (fields.recipientEmails !== undefined) update.recipient_emails = fields.recipientEmails.filter(Boolean)
  if (fields.active !== undefined) update.active = fields.active

  const { error } = await supabase.from('mrc_charges').update(update).eq('id', chargeId)
  if (error) {
    console.error('Error updating MRC charge:', error)
    return { error: 'Failed to update recurring charge' }
  }
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function deleteMrcCharge(chargeId: string, caseId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('mrc_charges').delete().eq('id', chargeId)
  if (error) {
    console.error('Error deleting MRC charge:', error)
    return { error: 'Failed to delete recurring charge' }
  }
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

// ---- Monthly generation. Runs from /api/cron/mrc with the service-role client.
// Generates an issued invoice for each active plan due today; autosend plans
// get emailed immediately.
export async function generateDueMrcInvoices() {
  const supabase = createAdminClient()
  const today = new Date()
  const day = today.getDate()
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const effectiveDay = Math.min(day, lastDay)

  const { data: plans, error } = await supabase
    .from('mrc_charges')
    .select('*')
    .eq('active', true)
    .eq('day_of_month', effectiveDay)
    .or(`last_generated_month.is.null,last_generated_month.neq.${monthKey}`)

  if (error) {
    console.error('MRC generation fetch error:', error)
    return { error: 'Fetch failed', generated: 0 }
  }

  let generated = 0
  for (const plan of plans || []) {
    // Bill-to: plan snapshot if present, else fresh client defaults
    let billTo = plan.bill_to as InvoiceBillTo | null
    let emails: string[] = plan.recipient_emails || []
    if (!billTo?.name || emails.length === 0) {
      const supa = supabase as any
      const { data: caseRow } = await supa.from('cases').select('client_id').eq('id', plan.case_id).single()
      const { data: client } = caseRow?.client_id
        ? await supa.from('clients').select('first_name, last_name, contact_email, nip, billing_address, billing_company').eq('id', caseRow.client_id).single()
        : { data: null }
      const { data: phone } = caseRow?.client_id
        ? await supa.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle()
        : { data: null }
      if (!billTo?.name) {
        billTo = {
          name: [client?.first_name, client?.last_name].filter(Boolean).join(' ') || null,
          company: client?.billing_company || null,
          email: client?.contact_email || null,
          phone: phone ? `${phone.country_code || ''} ${phone.number}`.trim() : null,
          address: client?.billing_address || null,
          nip: client?.nip || null,
        }
      }
      if (emails.length === 0 && client?.contact_email) emails = [client.contact_email]
    }

    // Number via the shared sequence table (same format as issueInvoice)
    const ym = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`
    const { data: seq } = await supabase
      .from('invoice_sequences')
      .upsert({ year_month: ym, last_number: 1 }, { onConflict: 'year_month' })
      .select('last_number')
      .single()
    let n = seq?.last_number || 1
    if (seq) {
      const { data: bumped } = await supabase
        .from('invoice_sequences')
        .update({ last_number: seq.last_number + 1 })
        .eq('year_month', ym)
        .select('last_number')
        .single()
      n = bumped?.last_number ?? seq.last_number
    }
    const number = `FV/${ym}/${String(n).padStart(4, '0')}`
    const todayIso = today.toISOString()

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        case_id: plan.case_id,
        mrc_charge_id: plan.id,
        invoice_name: plan.name || 'Monthly recurring charge',
        amount: plan.amount,
        due_date: todayIso.split('T')[0],
        status: plan.autosend ? 'sent' : 'issued',
        issued_at: todayIso,
        sent_at: plan.autosend ? todayIso : null,
        invoice_number: number,
        bill_to: billTo,
        recipient_emails: emails,
        sent_to_email: emails[0] || null,
        payment_method: 'bank_transfer',
        currency: 'pln',
      })
      .select()
      .single()

    if (invErr || !invoice) {
      console.error('MRC invoice insert error:', invErr)
      continue
    }

    if (plan.autosend && emails.length > 0) {
      await sendInvoiceEmailWithClient(supabase, invoice.id, plan.case_id)
    }

    await supabase
      .from('mrc_charges')
      .update({ last_generated_month: monthKey })
      .eq('id', plan.id)

    generated++
  }

  return { generated }
}

// ---- One-off auto-invoices: installments flagged automatic_invoice get an
// invoice generated and emailed on their due date, then the flag clears.
export async function generateDueAutoInvoices() {
  const supabase = createAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const { data: installments, error } = await supabase
    .from('installments')
    .select('*, cases(client_id, case_code)')
    .eq('paid', false)
    .eq('automatic_invoice', true)
    .lte('due_date', todayStr)
    .not('due_date', 'is', null)

  if (error) {
    console.error('Auto-invoice fetch error:', error)
    return { error: 'Fetch failed', generated: 0 }
  }

  let generated = 0
  for (const inst of installments || []) {
    // Skip if an active invoice already exists for this installment
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('installment_id', inst.id)
      .neq('status', 'cancelled')
      .limit(1)
    if (existing?.length) {
      await supabase.from('installments').update({ automatic_invoice: false }).eq('id', inst.id)
      continue
    }

    const clientId = (inst.cases as any)?.client_id
    const { data: client } = clientId
      ? await supabase.from('clients').select('first_name, last_name, contact_email, nip, billing_address, billing_company').eq('id', clientId).single()
      : { data: null }
    const { data: phone } = clientId
      ? await supabase.from('contact_numbers').select('country_code, number').eq('client_id', clientId).limit(1).maybeSingle()
      : { data: null }

    const billTo: InvoiceBillTo = {
      name: [client?.first_name, client?.last_name].filter(Boolean).join(' ') || null,
      company: client?.billing_company || null,
      email: client?.contact_email || null,
      phone: phone ? `${phone.country_code || ''} ${phone.number}`.trim() : null,
      address: client?.billing_address || null,
      nip: client?.nip || null,
    }
    const emails = client?.contact_email ? [client.contact_email] : []

    const ym = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`
    const { data: seq } = await supabase
      .from('invoice_sequences')
      .upsert({ year_month: ym, last_number: 1 }, { onConflict: 'year_month' })
      .select('last_number')
      .single()
    let n = seq?.last_number || 1
    if (seq) {
      const { data: bumped } = await supabase
        .from('invoice_sequences')
        .update({ last_number: seq.last_number + 1 })
        .eq('year_month', ym)
        .select('last_number')
        .single()
      n = bumped?.last_number ?? seq.last_number
    }
    const number = `FV/${ym}/${String(n).padStart(4, '0')}`
    const nowIso = today.toISOString()
    const willSend = emails.length > 0

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        case_id: inst.case_id,
        installment_id: inst.id,
        invoice_name: inst.name || 'Installment',
        amount: inst.amount,
        due_date: inst.due_date,
        status: willSend ? 'sent' : 'issued',
        issued_at: nowIso,
        sent_at: willSend ? nowIso : null,
        invoice_number: number,
        bill_to: billTo,
        recipient_emails: emails,
        sent_to_email: emails[0] || null,
        payment_method: 'bank_transfer',
        currency: 'pln',
      })
      .select()
      .single()

    if (invErr || !invoice) {
      console.error('Auto-invoice insert error:', invErr)
      continue
    }

    if (willSend) {
      await sendInvoiceEmailWithClient(supabase, invoice.id, inst.case_id)
    }

    await supabase.from('installments').update({ automatic_invoice: false }).eq('id', inst.id)
    generated++
  }

  return { generated }
}
