'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateCharge, deleteCharge, recordPayment, recordRefund, linkInvoiceCharges, markInvoicePaidCharges, duplicateChargeInvoice } from '@/app/actions/charges'
import { issueInvoice, sendInvoiceEmail } from '@/app/actions/invoices'
import { createStripeInvoice, voidStripeInvoice, markStripeInvoicePaid, sendInvoiceReceipt, resendStripeInvoiceEmail, syncInvoiceStatus } from '@/app/actions/stripe'
import { Loader2, Receipt, Download, FileCheck, Plus, X, Copy, Repeat, FlaskConical } from 'lucide-react'
import { usePaneBack } from '@/lib/panes'
import { DangerZone } from '@/components/shared/DangerZone'

interface ChargePageProps {
  params: Promise<{ id: string; chargeId: string }>
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank transfer', stripe: 'Stripe', manual: 'Manual', refund: 'Refund',
}

export default function ChargePage({ params }: ChargePageProps) {
  const { id: urlId, chargeId } = use(params)
  const router = useRouter()
  const paneBack = usePaneBack()
  const [charge, setCharge] = useState<any>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [linkedCharges, setLinkedCharges] = useState<any[]>([])
  const [caseData, setCaseData] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [clientPhone, setClientPhone] = useState('')
  const [services, setServices] = useState<any[]>([])
  const [charges, setCharges] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const isMounted = useRef(true)
  const supabase = createClient()

  // Details form
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editAutoInv, setEditAutoInv] = useState(false)

  // Record payment form
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'bank_transfer' | 'manual'>('bank_transfer')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payNote, setPayNote] = useState('')

  // Refund form
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  // Invoice form
  const [invoiceName, setInvoiceName] = useState('')
  const [sendEmail, setSendEmail] = useState('')
  const [paymentType, setPaymentType] = useState<'online' | 'bank_transfer' | 'manual'>('bank_transfer')
  const [billTo, setBillTo] = useState<{ name?: string; company?: string; email?: string; phone?: string; address?: string; nip?: string }>({})
  const [recipientEmails, setRecipientEmails] = useState<string[]>([])
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountNotes, setDiscountNotes] = useState('')

  // Recurring conversion
  const [mrcModalOpen, setMrcModalOpen] = useState(false)
  const [mrcDay, setMrcDay] = useState('1')

  // Confirmation modals
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [paidModalOpen, setPaidModalOpen] = useState(false)
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    isMounted.current = true
    load()
    return () => { isMounted.current = false }
  }, [urlId, chargeId])

  const guard = async (fn: () => Promise<void>) => {
    try { await fn() } catch (e: any) { setError(e?.message || 'Action failed — try refreshing the page') }
  }

  const load = async () => {
    const caseRes = urlId.startsWith('C')
      ? await supabase.from('cases').select('*').eq('case_code', urlId).single()
      : await supabase.from('cases').select('*').eq('id', urlId).single()
    if (!isMounted.current) return
    const caseRow = caseRes.data
    if (!caseRow) { setLoading(false); return }
    setCaseData(caseRow)

    const [chargeRes, clientRes, servicesRes, allChargesRes, paymentsRes, linksRes, phoneRes] = await Promise.all([
      supabase.from('charges').select('*').eq('id', chargeId).eq('case_id', caseRow.id).single(),
      caseRow.client_id ? supabase.from('clients').select('*').eq('id', caseRow.client_id).single() : Promise.resolve({ data: null }),
      supabase.from('case_services').select('*, services(*)').eq('case_id', caseRow.id),
      supabase.from('charges').select('*').eq('case_id', caseRow.id).order('position', { ascending: true }),
      supabase.from('payments').select('*').eq('charge_id', chargeId).order('paid_at', { ascending: false }),
      supabase.from('invoice_charges').select('invoice_id, charge_id').eq('charge_id', chargeId),
      caseRow.client_id ? supabase.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ])
    if (!isMounted.current) return

    const c = chargeRes.data
    setCharge(c)
    const allCharges = allChargesRes.data || []
    setCharges(allCharges)
    setPayments(paymentsRes.data || [])

    // The covering invoice = latest non-cancelled invoice linked to this charge
    const linkedInvoiceIds = (linksRes.data || []).map((l: any) => l.invoice_id)
    let inv: any = null
    let otherLinked: any[] = []
    if (linkedInvoiceIds.length) {
      const { data: invs } = await supabase
        .from('invoices').select('*').in('id', linkedInvoiceIds)
        .order('created_at', { ascending: false })
      inv = (invs || []).find((i: any) => i.status !== 'cancelled') || invs?.[0] || null
      // Other charges this invoice also covers
      if (inv) {
        const { data: invLinks } = await supabase
          .from('invoice_charges').select('charge_id').eq('invoice_id', inv.id)
        otherLinked = (invLinks || [])
          .map((l: any) => allCharges.find((x: any) => x.id === l.charge_id))
          .filter((x: any) => x && x.id !== chargeId)
      }
    }
    setInvoice(inv)
    setLinkedCharges(otherLinked)

    if (c) {
      setEditName(c.name || '')
      setEditAmount(c.amount?.toString() || '0')
      setEditDueDate(c.due_date || '')
      setEditAutoInv(!!c.automatic_invoice)
      setPayAmount(Math.max(0, Number(c.amount || 0)).toFixed(2))
      if (c.due_date) setMrcDay(String(new Date(c.due_date).getDate()))
    }
    const cl = clientRes.data
    setClient(cl)
    setSendEmail(cl?.contact_email || '')
    setBillTo(inv?.bill_to || {
      name: [cl?.first_name, cl?.last_name].filter(Boolean).join(' ') || '',
      company: cl?.billing_company || '',
      email: cl?.contact_email || '',
      phone: phoneRes.data ? `${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim() : '',
      address: cl?.billing_address || '',
      nip: cl?.nip || '',
    })
    setRecipientEmails(inv?.recipient_emails?.length ? inv.recipient_emails : (cl?.contact_email ? [cl.contact_email] : []))
    setDiscountAmount(inv?.discount_amount ? String(inv.discount_amount) : '')
    setDiscountNotes(inv?.discount_notes || '')
    if (inv?.payment_method === 'online' || inv?.payment_method === 'bank_transfer') setPaymentType(inv.payment_method)
    else if (inv?.payment_method === 'cash' || inv?.payment_method === 'manual') setPaymentType('manual')
    setServices(servicesRes.data || [])
    if (phoneRes.data) setClientPhone(`${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim())

    const serviceNames = (servicesRes.data || []).map((s: any) => s.services?.name).filter(Boolean).join(', ') || 'Services'
    const idx = allCharges.filter((x: any) => x.kind === 'installment').findIndex((x: any) => x.id === chargeId) + 1
    const generated = c?.name || (c?.kind === 'balance' ? 'Remainder' : c?.kind === 'down_payment' ? 'Down payment' : c?.kind === 'recurring' ? 'Monthly charge' : c?.kind === 'one_off' ? 'One-off' : `Installment ${idx}`)
    setInvoiceName(`${serviceNames} - ${generated}`)
    setLoading(false)
  }

  const reload = async () => {
    await load()
    if (caseData?.id) window.dispatchEvent(new CustomEvent('nexus:case-data-changed', { detail: { caseId: caseData.id } }))
  }

  const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  const isBalance = charge?.kind === 'balance'
  const paidAmount = payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
  const invoicePaid = invoice?.status === 'paid'
  const isPaid = invoicePaid || (charge && paidAmount >= Number(charge.amount))
  const remaining = Math.max(0, Number(charge?.amount || 0) - paidAmount)
  const installmentIdx = charge ? charges.filter((x: any) => x.kind === 'installment').findIndex((x: any) => x.id === chargeId) + 1 : 0
  const displayName = charge?.name || (isBalance ? 'Remainder' : charge?.kind === 'down_payment' ? 'Down payment' : charge?.kind === 'recurring' ? 'Monthly charge' : charge?.kind === 'one_off' ? 'One-off' : `Installment ${installmentIdx}`)
  const canDelete = !!charge && !isBalance && !isPaid && invoice?.status !== 'sent' && invoice?.status !== 'paid'

  const openDoc = (doc: 'invoice' | 'receipt') => {
    if (invoice?.id) window.open(`/print/invoice/${invoice.id}?doc=${doc}`, '_blank')
  }

  const handleSendDoc = async (doc: 'invoice' | 'receipt') => {
    if (!charge || !caseData) return
    const to = invoice?.sent_to_email || sendEmail || client?.contact_email || ''
    if (invoice?.stripe_invoice_id) {
      if (!confirm(`Send ${doc} to ${to || 'the customer'}?`)) return
      setSubmitting(true)
      try {
        const result = doc === 'invoice'
          ? await resendStripeInvoiceEmail(invoice.id)
          : await sendInvoiceReceipt(invoice.id)
        if (result.error) { alert(`Error: ${result.error}`); return }
        alert(doc === 'invoice' ? 'Invoice sent' : 'Receipt sent')
      } finally { setSubmitting(false) }
    } else if (doc === 'invoice' && invoice) {
      if (!confirm(`Send invoice to ${recipientEmails.join(', ') || to || 'the client'}?`)) return
      setSubmitting(true)
      try {
        const result = await sendInvoiceEmail(invoice.id, caseData.id)
        if (result.error) { alert(`Error: ${result.error}`); return }
        alert(`Invoice sent to ${result.sentTo?.join(', ')}`)
      } finally { setSubmitting(false) }
    } else {
      const subject = `${doc === 'invoice' ? 'Invoice' : 'Receipt'} — ${invoiceName || displayName}`
      const body = `Hi,\n\nPlease find your ${doc} attached for ${Math.abs(charge.amount || 0).toFixed(2)} PLN${charge.due_date ? ` (due ${formatDate(charge.due_date)})` : ''}.\n\nThank you!`
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
  }

  const handleSaveDetails = async () => {
    if (!charge) return
    setSubmitting(true)
    await guard(async () => {
      const res = await updateCharge(charge.id, caseData.id, {
        name: editName || null,
        amount: isBalance ? Number(charge.amount) : parseFloat(editAmount),
        dueDate: editDueDate || null,
        automaticInvoice: editAutoInv,
      })
      if (res.error) setError(res.error)
    })
    setSubmitting(false)
    await reload()
  }

  const handleGenerate = async () => {
    if (!charge || !caseData) return
    setSubmitting(true)
    await guard(async () => {
      const result = await issueInvoice(
        caseData.id,
        null,
        invoiceName.trim() || displayName,
        charge.amount,
        charge.due_date || null,
        billTo,
        recipientEmails.filter(Boolean),
        paymentType === 'manual' ? 'cash' : paymentType,
        invoice?.id,
        null,
        { amount: parseFloat(discountAmount) || 0, notes: discountNotes }
      )
      if (result.error) { setError(result.error); return }
      if (result.invoice) await linkInvoiceCharges(result.invoice.id, [charge.id, ...linkedCharges.map((c: any) => c.id)])
      await reload()
    })
    setSubmitting(false)
  }

  const handleSendInvoice = async () => {
    if (!charge || !caseData) return
    setSubmitting(true)
    try {
      let inv = invoice
      if (!inv || inv.status === 'draft' || inv.status === 'cancelled') {
        const result = await issueInvoice(
          caseData.id,
          null,
          invoiceName.trim() || displayName,
          charge.amount,
          charge.due_date || null,
          billTo,
          recipientEmails.filter(Boolean),
          paymentType === 'manual' ? 'cash' : paymentType,
          inv?.id,
          null,
          { amount: parseFloat(discountAmount) || 0, notes: discountNotes }
        )
        if (result.error) { alert(result.error); return }
        inv = result.invoice
        if (inv) await linkInvoiceCharges(inv.id, [charge.id, ...linkedCharges.map((c: any) => c.id)])
      }
      if (!inv) { alert('Failed to generate invoice'); return }

      if (paymentType === 'online') {
        const stripeResult = await createStripeInvoice(inv.id, {
          autoSend: true,
          paymentType: 'online',
          dueDate: charge.due_date || undefined,
          email: recipientEmails[0] || sendEmail || undefined,
        })
        if (stripeResult.error) { alert(`Stripe error: ${stripeResult.error}`); return }
      } else {
        const sendResult = await sendInvoiceEmail(inv.id, caseData.id)
        if (sendResult.error) { alert(`Error: ${sendResult.error}`); return }
      }
      setSendModalOpen(false)
      await reload()
    } catch (err: any) {
      alert(err.message || 'Failed to send invoice')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDuplicate = async () => {
    if (!invoice || !caseData) return
    setSubmitting(true)
    await guard(async () => {
      const result = await duplicateChargeInvoice(invoice.id, caseData.id)
      if (result.error) { setError(result.error); return }
      await reload()
    })
    setSubmitting(false)
  }

  const handleMakeRecurring = async () => {
    if (!charge || !caseData) return
    setSubmitting(true)
    await guard(async () => {
      const res = await updateCharge(charge.id, caseData.id, { kind: 'recurring', recurDay: parseInt(mrcDay) || 1 })
      if (res.error) { setError(res.error); return }
      setMrcModalOpen(false)
      await reload()
    })
    setSubmitting(false)
  }

  const handleMarkAsPaid = async () => {
    if (!charge || !caseData) return
    setSubmitting(true)
    // Noon UTC keeps the chosen calendar date regardless of local timezone
    const paidAt = paidDate ? new Date(paidDate + 'T12:00:00').toISOString() : undefined
    await guard(async () => {
      if (invoice?.stripe_invoice_id && invoice.status === 'sent') {
        const result = await markStripeInvoicePaid(invoice.id, paidAt)
        if (result.error) { setError(`Error: ${result.error}`); return }
        // Stripe side done — still write payment rows for the linked charges
        await markInvoicePaidCharges(invoice.id, caseData.id, paidAt, 'bank_transfer')
      } else if (invoice) {
        const result = await markInvoicePaidCharges(invoice.id, caseData.id, paidAt, paymentType === 'manual' ? 'cash' : 'bank_transfer')
        if (result.error) { setError(result.error); return }
      } else {
        // No invoice — record a direct payment for the remaining amount
        const result = await recordPayment(caseData.id, charge.id, remaining, paymentType === 'manual' ? 'cash' : 'bank_transfer', 'Marked paid', paidAt)
        if (result.error) { setError(result.error); return }
      }
      setPaidModalOpen(false)
      await reload()
    })
    setSubmitting(false)
  }

  const handleVoidInvoice = async () => {
    if (!invoice) return
    if (!confirm('Cancel this invoice? This will void it in Stripe and it cannot be undone.')) return
    setSubmitting(true)
    await guard(async () => {
      const result = await voidStripeInvoice(invoice.id)
      if (result.error) setError(`Error: ${result.error}`)
      await reload()
    })
    setSubmitting(false)
  }

  const handleSyncStatus = async () => {
    if (!invoice) return
    setSubmitting(true)
    await guard(async () => {
      const result = await syncInvoiceStatus(invoice.id)
      if (result.error) setError(`Error: ${result.error}`)
      await reload()
    })
    setSubmitting(false)
  }

  const handleRecordPayment = async () => {
    if (!charge || !caseData) return
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) return
    setSubmitting(true)
    const paidAt = payDate ? new Date(payDate + 'T12:00:00').toISOString() : undefined
    await guard(async () => {
      const res = await recordPayment(caseData.id, charge.id, amount, payMethod, payNote || undefined, paidAt, invoice?.id)
      if (res.error) { setError(res.error); return }
      setPayOpen(false)
      setPayNote('')
      await reload()
    })
    setSubmitting(false)
  }

  const handleRefund = async () => {
    if (!charge || !caseData || !refundAmount) return
    setSubmitting(true)
    await guard(async () => {
      const result = await recordRefund(caseData.id, charge.id, parseFloat(refundAmount), refundReason || undefined)
      if (result.error) { setError(result.error); return }
      setRefundOpen(false)
      await reload()
    })
    setSubmitting(false)
  }

  const handleDelete = async () => {
    if (!charge || !caseData) return
    if (!confirm('Delete this charge?')) return
    setSubmitting(true)
    await guard(async () => {
      const result = await deleteCharge(charge.id, caseData.id)
      if (result?.error) { setError(result.error); return }
      window.dispatchEvent(new CustomEvent('nexus:case-data-changed', { detail: { caseId: caseData.id } }))
      if (paneBack) paneBack()
      else router.push(`/cases/${urlId}/billing/v2`)
    })
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }
  if (!charge || !caseData) {
    return <div className="flex items-center justify-center min-h-screen"><p>Charge not found</p></div>
  }

  const statusLabel = isPaid ? `Paid${invoice?.paid_at ? ` ${formatDate(invoice.paid_at)}` : ''}`
    : invoice?.status === 'sent' ? `Invoice sent ${formatDate(invoice.sent_at)}`
    : invoice?.status === 'issued' ? `Invoice generated ${formatDate(invoice.issued_at)}`
    : paidAmount > 0 ? `Partially paid — ${remaining.toFixed(2)} left`
    : charge.due_date ? `Due ${formatDate(charge.due_date)}`
    : 'No due date'
  const serviceName = services[0]?.services?.name

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader
        backHref={`/cases/${urlId}/billing/v2`}
        title={serviceName || caseData?.case_code || 'Case'}
        subtitle={[client ? ([client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email) : null, clientPhone].filter(Boolean).join(' · ')}
        icon={<Receipt className="w-4 h-4 text-white" />}
        titleHref={caseData?.client_id ? `/clients/${caseData.client_id}` : undefined}
      />

      <div className="flex items-center gap-2 mb-3 px-1">
        <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-500">New billing preview — {statusLabel}</span>
      </div>

      <div className="space-y-4">
        {/* Details */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">{displayName}</h3>
            <span className="text-xs px-2 py-1 rounded-lg border border-[hsl(var(--color-border))] text-[hsl(var(--color-text-secondary))]">
              {charge.kind === 'down_payment' ? 'Down payment' : charge.kind === 'balance' ? 'Remainder' : charge.kind === 'one_off' ? 'One-off' : charge.kind === 'recurring' ? `Monthly · day ${charge.recur_day || '?'}` : 'Installment'}
            </span>
          </div>
          {!isBalance && (
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Title</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={displayName} disabled={isPaid} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Amount (PLN)</label>
              {isBalance ? (
                <p className="h-10 flex items-center text-sm text-[hsl(var(--color-text-secondary))]">{Math.abs(charge.amount || 0).toFixed(2)} · auto</p>
              ) : (
                <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} disabled={isPaid} />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Due date</label>
              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={isPaid || charge.kind === 'recurring'} />
            </div>
          </div>
          {!isPaid && (
            <>
              <label className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                <input type="checkbox" checked={editAutoInv} onChange={(e) => setEditAutoInv(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--color-primary))]" />
                Auto-invoice when due
              </label>
              <div className="flex justify-end">
                <Button size="md" onClick={handleSaveDetails} disabled={submitting} className="rounded-xl">{submitting ? 'Saving...' : 'Save'}</Button>
              </div>
            </>
          )}
        </div>

        {/* Payments — real money events incl. partials and refunds */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Payments</h3>
            <span className="text-sm text-[hsl(var(--color-text-secondary))]">
              {paidAmount.toFixed(2)} of {Number(charge.amount).toFixed(2)} PLN
            </span>
          </div>

          {payments.length === 0 ? (
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">Nothing received yet.</p>
          ) : (
            <div className="divide-y divide-[hsl(var(--color-border))] rounded-lg border border-[hsl(var(--color-border))]">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-[hsl(var(--color-text-secondary))]">
                    {METHOD_LABEL[p.method] || p.method} · {formatDate(p.paid_at)}
                    {p.note ? ` — ${p.note}` : ''}
                  </span>
                  <span className={`font-semibold ${p.amount < 0 ? 'text-orange-500' : 'text-green-500'}`}>
                    {p.amount < 0 ? '−' : '+'}{Math.abs(Number(p.amount)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!isPaid && !payOpen && (
            <Button size="md" variant="outline" className="w-full rounded-xl" onClick={() => { setPayAmount(remaining.toFixed(2)); setPayOpen(true) }}>
              Record payment{remaining < Number(charge.amount) ? ' (partial ok)' : ''}
            </Button>
          )}
          {payOpen && (
            <div className="space-y-3 p-3 rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Amount (PLN)</label>
                  <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Date</label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                {(['bank_transfer', 'cash', 'manual'] as const).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-xs ${payMethod === m ? 'border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]/10' : 'border-[hsl(var(--color-border))] text-[hsl(var(--color-text-secondary))]'}`}>
                    {METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleRecordPayment} disabled={submitting || !payAmount}>
                  {submitting ? 'Saving...' : 'Record'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Invoice & payment — the full old flow on the covering invoice */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Invoice &amp; payment</h3>
            {invoice?.invoice_number && invoice.status !== 'cancelled' && (
              <span className="text-xs font-mono text-[hsl(var(--color-text-secondary))]">{invoice.invoice_number}</span>
            )}
          </div>

          {invoice && linkedCharges.length > 0 && (
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">
              This invoice also covers: {linkedCharges.map((c: any) => c.name || `${Number(c.amount).toFixed(2)} PLN`).join(', ')}
            </p>
          )}

          {/* ISSUED */}
          {!isPaid && invoice?.status === 'issued' && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1">
              <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">{invoice.invoice_name}</div>
              <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                Generated {formatDate(invoice.issued_at)}{invoice.due_date ? ` · due ${formatDate(invoice.due_date)}` : ''}
              </div>
            </div>
          )}

          {/* SENT */}
          {!isPaid && invoice?.status === 'sent' && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-1">
              <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">{invoice.invoice_name}</div>
              <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                Sent {formatDate(invoice.sent_at)}{invoice.recipient_emails?.length ? ` to ${invoice.recipient_emails.join(', ')}` : invoice.sent_to_email ? ` to ${invoice.sent_to_email}` : ''}
                {invoice.due_date ? ` · due ${formatDate(invoice.due_date)}` : ''}
              </div>
            </div>
          )}

          {/* PAID */}
          {isPaid && invoice && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 space-y-1">
              <div className="text-sm font-medium text-green-500">Paid {formatDate(invoice.paid_at)}</div>
              <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                {invoice.invoice_name}{invoice.payment_method ? ` · ${invoice.payment_method}` : ''}
              </div>
            </div>
          )}

          {/* Invoice details — editable until sent/paid */}
          {!isPaid && invoice?.status !== 'sent' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Invoice title</label>
                <Input value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-[hsl(var(--color-text-secondary))] uppercase tracking-wide">Bill to</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input value={billTo.name || ''} onChange={(e) => setBillTo({ ...billTo, name: e.target.value })} placeholder="Client name" />
                  <Input value={billTo.company || ''} onChange={(e) => setBillTo({ ...billTo, company: e.target.value })} placeholder="Company (optional)" />
                  <Input type="email" value={billTo.email || ''} onChange={(e) => setBillTo({ ...billTo, email: e.target.value })} placeholder="Client email" />
                  <Input value={billTo.phone || ''} onChange={(e) => setBillTo({ ...billTo, phone: e.target.value })} placeholder="Client phone" />
                  <Input value={billTo.address || ''} onChange={(e) => setBillTo({ ...billTo, address: e.target.value })} placeholder="Client address" />
                  <Input value={billTo.nip || ''} onChange={(e) => setBillTo({ ...billTo, nip: e.target.value })} placeholder="Client company NIP" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-[hsl(var(--color-text-secondary))] uppercase tracking-wide">Send to</div>
                {recipientEmails.map((email, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setRecipientEmails(recipientEmails.map((r, j) => j === i ? e.target.value : r))}
                      placeholder="client@email.com"
                    />
                    {recipientEmails.length > 1 && (
                      <button onClick={() => setRecipientEmails(recipientEmails.filter((_, j) => j !== i))} className="p-2 text-[hsl(var(--color-text-muted))] hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => setRecipientEmails([...recipientEmails, ''])} className="flex items-center gap-1.5 text-sm text-[hsl(var(--color-primary))] hover:opacity-80">
                  <Plus className="w-4 h-4" /> Add email
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Payment method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentType('online')}
                    className={`p-3 rounded-xl border-2 transition-colors text-left ${paymentType === 'online' ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]/10' : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-border-hover))]'}`}
                  >
                    <div className="font-medium text-sm">Online</div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">Stripe link</div>
                  </button>
                  <button
                    onClick={() => setPaymentType('bank_transfer')}
                    className={`p-3 rounded-xl border-2 transition-colors text-left ${paymentType === 'bank_transfer' ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]/10' : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-border-hover))]'}`}
                  >
                    <div className="font-medium text-sm">Bank transfer</div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">Bank details</div>
                  </button>
                  <button
                    onClick={() => setPaymentType('manual')}
                    className={`p-3 rounded-xl border-2 transition-colors text-left ${paymentType === 'manual' ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]/10' : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-border-hover))]'}`}
                  >
                    <div className="font-medium text-sm">Cash</div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">Paid in person</div>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Discount from original (PLN)</label>
                  <Input type="number" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Discount note (optional)</label>
                  <Input value={discountNotes} onChange={(e) => setDiscountNotes(e.target.value)} placeholder="e.g., Goodwill discount" />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-sm flex justify-between">
                <span className="text-[hsl(var(--color-text-secondary))]">Amount{charge.due_date ? ` · due ${formatDate(charge.due_date)}` : ''}</span>
                <span className="font-bold">{Math.abs(charge.amount || 0).toFixed(2)} PLN</span>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {isPaid && invoice ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Button size="md" variant="outline" className="w-full rounded-xl" onClick={() => openDoc('invoice')}>
                    <Download className="w-4 h-4 mr-1.5" /> Invoice
                  </Button>
                  <Button size="md" className="w-full rounded-xl" onClick={() => handleSendDoc('invoice')} disabled={submitting}>
                    Send invoice
                  </Button>
                </div>
                <div className="space-y-2">
                  <Button size="md" variant="outline" className="w-full rounded-xl" onClick={() => openDoc('receipt')}>
                    <Download className="w-4 h-4 mr-1.5" /> Receipt
                  </Button>
                  <Button size="md" className="bg-green-600 hover:bg-green-700 text-white w-full rounded-xl" onClick={() => handleSendDoc('receipt')} disabled={submitting}>
                    Send receipt
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {invoice?.status === 'sent' ? (
                  <div className="flex items-center gap-2">
                    <Button size="md" variant="outline" className="rounded-xl" onClick={() => openDoc('invoice')}>
                      <Download className="w-4 h-4 mr-1.5" /> Download
                    </Button>
                    <Button size="md" variant="outline" className="rounded-xl" onClick={() => handleSendDoc('invoice')} disabled={submitting}>Resend</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button size="md" variant="outline" className="rounded-xl" onClick={handleGenerate} disabled={submitting}>
                      <FileCheck className="w-4 h-4 mr-1.5" /> {invoice?.status === 'issued' ? 'Regenerate' : 'Generate'}
                    </Button>
                    {invoice?.status === 'issued' && (
                      <Button size="md" variant="outline" className="rounded-xl" onClick={() => openDoc('invoice')}>
                        <Download className="w-4 h-4 mr-1.5" /> Preview
                      </Button>
                    )}
                    <Button
                      size="md"
                      className="flex-1 rounded-xl"
                      onClick={() => setSendModalOpen(true)}
                      disabled={paymentType !== 'manual' && recipientEmails.filter(Boolean).length === 0}
                    >
                      {invoice?.status === 'issued' ? 'Send' : 'Generate & Send'}
                    </Button>
                  </div>
                )}
                <Button size="md" className="bg-green-600 hover:bg-green-700 text-white w-full rounded-xl" onClick={() => { setPaidDate(new Date().toISOString().slice(0, 10)); setPaidModalOpen(true) }}>Mark as Paid</Button>
              </>
            )}
          </div>

          {/* Secondary actions */}
          {!isPaid && (invoice?.status === 'sent' || invoice?.status === 'issued' || invoice?.status === 'draft') && (
            <div className="flex flex-wrap gap-2 pt-1">
              {invoice?.status === 'sent' && (
                <Button size="sm" variant="outline" onClick={handleSyncStatus} disabled={submitting}>Check status</Button>
              )}
              {invoice && (
                <Button size="sm" variant="outline" onClick={handleDuplicate} disabled={submitting}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={handleVoidInvoice} disabled={submitting}>
                {invoice?.status === 'draft' ? 'Cancel Draft' : 'Cancel Invoice'}
              </Button>
            </div>
          )}

          {/* Paid extras */}
          {isPaid && (
            <>
              <div className="flex flex-wrap gap-2">
                {invoice && (
                  <Button size="sm" variant="outline" onClick={handleDuplicate} disabled={submitting}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                  </Button>
                )}
              </div>
              {!refundOpen ? (
                <div>
                  <Button size="md" variant="outline" className="w-full rounded-xl text-orange-500" onClick={() => setRefundOpen(true)}>Refund</Button>
                </div>
              ) : (
                <div className="space-y-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Refund amount</label>
                      <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} max={charge.amount || 0} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Reason (optional)</label>
                      <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g., Client request" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleRefund} disabled={submitting || !refundAmount || parseFloat(refundAmount) <= 0}>
                      {submitting ? 'Processing...' : 'Record Refund'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Convert to recurring */}
          {!isPaid && !isBalance && charge.kind !== 'recurring' && (
            <button
              onClick={() => setMrcModalOpen(true)}
              className="flex items-center gap-1.5 text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-primary))]"
            >
              <Repeat className="w-4 h-4" /> Make monthly recurring
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

      {canDelete && (
        <DangerZone
          title="Danger zone"
          description="Deleting this charge cannot be undone."
          buttonText="Delete Charge"
          onDelete={handleDelete}
          disabled={submitting}
        />
      )}

      {/* Send Invoice confirmation */}
      <Modal isOpen={sendModalOpen} onClose={() => setSendModalOpen(false)} title="Send Invoice">
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">Send this invoice?</p>
          <div className="p-3 rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Invoice</span><span className="font-medium">{invoiceName || displayName}</span></div>
            <div className="flex justify-between gap-3"><span className="text-[hsl(var(--color-text-secondary))]">Send to</span><span className="font-medium text-right">{recipientEmails.filter(Boolean).join(', ') || '—'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Method</span><span className="font-medium">{paymentType === 'online' ? 'Stripe link' : paymentType === 'bank_transfer' ? 'Email + bank details' : 'Cash (record only)'}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Amount</span><span className="font-bold">{Math.abs(charge.amount || 0).toFixed(2)} PLN</span></div>
          </div>
          <Button onClick={handleSendInvoice} disabled={submitting} className="w-full rounded-xl">
            {submitting ? 'Sending...' : 'Send Invoice'}
          </Button>
        </div>
      </Modal>

      {/* Mark as Paid confirmation */}
      <Modal isOpen={paidModalOpen} onClose={() => setPaidModalOpen(false)} title="Mark as Paid">
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
            {invoice ? `Record payment of ${Math.abs(invoice.amount || charge.amount || 0).toFixed(2)} PLN${invoice.stripe_invoice_id ? ' — also marks it paid in Stripe' : ''}?` : `Record a payment of ${remaining.toFixed(2)} PLN?`}
          </p>
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Payment date</label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
          <Button onClick={handleMarkAsPaid} disabled={submitting} className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white">
            {submitting ? 'Saving...' : 'Mark as Paid'}
          </Button>
        </div>
      </Modal>

      {/* Make recurring */}
      <Modal isOpen={mrcModalOpen} onClose={() => setMrcModalOpen(false)} title="Make monthly recurring">
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
            This charge will bill {Math.abs(charge.amount || 0).toFixed(2)} PLN every month.
          </p>
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Day of month</label>
            <Input type="number" min={1} max={28} value={mrcDay} onChange={(e) => setMrcDay(e.target.value)} />
          </div>
          <Button onClick={handleMakeRecurring} disabled={submitting} className="w-full rounded-xl">
            {submitting ? 'Saving...' : 'Make recurring'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
