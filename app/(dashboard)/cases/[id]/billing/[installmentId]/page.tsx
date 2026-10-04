'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateInstallment, deleteInstallment } from '@/app/actions/installments'
import { createInvoice, recordManualPayment, recordRefund } from '@/app/actions/invoices'
import { createStripeInvoice, voidStripeInvoice, markStripeInvoicePaid, sendInvoiceReceipt, resendStripeInvoiceEmail, syncInvoiceStatus } from '@/app/actions/stripe'
import { Loader2, Receipt, Download, FileCheck } from 'lucide-react'
import { usePaneBack } from '@/lib/panes'
import { DangerZone } from '@/components/shared/DangerZone'
import type { Installment, Invoice } from '@/types/database'

interface InstallmentPageProps {
  params: Promise<{ id: string; installmentId: string }>
}

export default function InstallmentPage({ params }: InstallmentPageProps) {
  const { id: urlId, installmentId } = use(params)
  const router = useRouter()
  const paneBack = usePaneBack()
  const [installment, setInstallment] = useState<Installment | null>(null)
  const [parentInstallment, setParentInstallment] = useState<Installment | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [caseData, setCaseData] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [clientPhone, setClientPhone] = useState('')
  const [services, setServices] = useState<any[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const isMounted = useRef(true)
  const supabase = createClient()

  // Details form
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDueDate, setEditDueDate] = useState('')

  // Invoice form (lives inside the panel)
  const [invoiceName, setInvoiceName] = useState('')
  const [sendEmail, setSendEmail] = useState('')
  const [paymentType, setPaymentType] = useState<'online' | 'bank_transfer' | 'manual'>('online')

  // Confirmation modals
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [paidModalOpen, setPaidModalOpen] = useState(false)
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10))

  // Refund form
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  useEffect(() => {
    isMounted.current = true
    load()
    return () => { isMounted.current = false }
  }, [urlId, installmentId])

  const load = async () => {
    const caseRes = urlId.startsWith('C')
      ? await supabase.from('cases').select('*').eq('case_code', urlId).single()
      : await supabase.from('cases').select('*').eq('id', urlId).single()
    if (!isMounted.current) return
    const caseRow = caseRes.data
    if (!caseRow) { setLoading(false); return }
    setCaseData(caseRow)

    const [instRes, invoiceRes, clientRes, servicesRes, allInstRes, phoneRes] = await Promise.all([
      supabase.from('installments').select('*').eq('id', installmentId).eq('case_id', caseRow.id).single(),
      supabase.from('invoices').select('*').eq('installment_id', installmentId).order('created_at', { ascending: false }),
      caseRow.client_id ? supabase.from('clients').select('*').eq('id', caseRow.client_id).single() : Promise.resolve({ data: null }),
      supabase.from('case_services').select('*, services(*)').eq('case_id', caseRow.id),
      supabase.from('installments').select('*').eq('case_id', caseRow.id),
      caseRow.client_id ? supabase.from('contact_numbers').select('country_code, number').eq('client_id', caseRow.client_id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ])
    if (!isMounted.current) return

    const inst = instRes.data
    setInstallment(inst)
    if (inst) {
      setEditName(inst.name || '')
      setEditAmount(inst.amount?.toString() || '0')
      setEditDueDate(inst.due_date || '')
      setRefundAmount(Math.abs(inst.amount || 0).toFixed(2))
    }
    const inv = (invoiceRes.data || []).find(i => i.status !== 'cancelled') || invoiceRes.data?.[0] || null
    setInvoice(inv)
    setClient(clientRes.data)
    setSendEmail(clientRes.data?.contact_email || '')
    setServices(servicesRes.data || [])
    if (phoneRes.data) setClientPhone(`${phoneRes.data.country_code || ''} ${phoneRes.data.number}`.trim())
    setInstallments(allInstRes.data || [])
    if (inst?.parent_installment_id) {
      setParentInstallment((allInstRes.data || []).find((i: any) => i.id === inst.parent_installment_id) || null)
    }

    // Prefill the invoice title
    const serviceNames = (servicesRes.data || []).map((s: any) => s.services?.name).filter(Boolean).join(', ') || 'Services'
    const nonRefund = (allInstRes.data || []).filter((i: any) => (i.amount || 0) >= 0 && !i.is_balance)
    const idx = nonRefund.findIndex((i: any) => i.id === installmentId) + 1
    const generated = inst?.name || (inst?.is_balance ? 'Final payment' : inst?.is_down_payment ? 'Down Payment' : `Installment ${idx}`)
    setInvoiceName(`${serviceNames} - ${generated}`)
    setLoading(false)
  }

  const reload = async () => {
    if (!caseData) return
    const [instRes, invoiceRes] = await Promise.all([
      supabase.from('installments').select('*').eq('id', installmentId).single(),
      supabase.from('invoices').select('*').eq('installment_id', installmentId).order('created_at', { ascending: false }),
    ])
    if (instRes.data) setInstallment(instRes.data)
    const inv = (invoiceRes.data || []).find(i => i.status !== 'cancelled') || invoiceRes.data?.[0] || null
    setInvoice(inv)
    // Let an open billing pane/page underneath refetch
    if (caseData?.id) window.dispatchEvent(new CustomEvent('nexus:case-data-changed', { detail: { caseId: caseData.id } }))
  }

  const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  const isRefund = (installment?.amount || 0) < 0
  const isBalance = !!installment?.is_balance
  const canDelete = !!installment && (isRefund || (!installment.is_down_payment && !isBalance && !installment.paid
    && invoice?.status !== 'sent' && invoice?.status !== 'paid'))
  const displayName = installment?.name || (isBalance ? 'Final payment' : installment?.is_down_payment ? 'Down Payment' : `Installment ${installments.filter(i => (i.amount || 0) >= 0 && !i.is_balance).findIndex(i => i.id === installmentId) + 1}`)

  const openDoc = (doc: 'invoice' | 'receipt') => {
    window.open(`/print/installment/${installmentId}?doc=${doc}`, '_blank')
  }

  // Email the invoice/receipt to the client — Stripe invoices go via Stripe,
  // anything else falls back to a prefilled email draft (no email provider configured)
  const handleSendDoc = async (doc: 'invoice' | 'receipt') => {
    if (!installment) return
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
    } else {
      const subject = `${doc === 'invoice' ? 'Invoice' : 'Receipt'} — ${invoiceName || displayName}`
      const body = `Hi,\n\nPlease find your ${doc} attached for ${Math.abs(installment.amount || 0).toFixed(2)} PLN${installment.due_date ? ` (due ${formatDate(installment.due_date)})` : ''}.\n\nThank you!`
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
  }

  const handleSaveDetails = async () => {
    if (!installment) return
    setSubmitting(true)
    const formData = new FormData()
    formData.set('name', editName)
    formData.set('amount', isBalance ? String(installment.amount ?? 0) : editAmount)
    formData.set('dueDate', editDueDate)
    await updateInstallment(installment.id, caseData.id, formData)
    setSubmitting(false)
    await reload()
  }

  const handleSendInvoice = async () => {
    if (!installment || !caseData) return
    setSubmitting(true)
    try {
      const createResult = await createInvoice(caseData.id, installment.id, invoiceName.trim() || displayName, installment.amount, installment.due_date || undefined)
      if (createResult.error) { alert(createResult.error); return }
      if (!createResult.invoice) { alert('Failed to create invoice'); return }

      const stripeResult = await createStripeInvoice(createResult.invoice.id, {
        autoSend: true,
        paymentType: paymentType === 'manual' ? 'bank_transfer' : paymentType,
        dueDate: installment.due_date || undefined,
        email: sendEmail || undefined,
      })
      if (stripeResult.error) { alert(`Stripe error: ${stripeResult.error}`); return }
      setSendModalOpen(false)
      await reload()
    } catch (err: any) {
      alert(err.message || 'Failed to send invoice')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkAsPaid = async () => {
    if (!installment || !caseData) return
    setSubmitting(true)
    // Noon UTC keeps the chosen calendar date regardless of local timezone
    const paidAt = paidDate ? new Date(paidDate + 'T12:00:00').toISOString() : undefined
    try {
      if (invoice?.stripe_invoice_id && invoice.status === 'sent') {
        const result = await markStripeInvoicePaid(invoice.id, paidAt)
        if (result.error) { alert(`Error: ${result.error}`); return }
      } else {
        const method = paymentType === 'manual' ? 'cash' : paymentType === 'bank_transfer' ? 'bank_transfer' : 'other'
        const result = await recordManualPayment(caseData.id, installment.id, invoiceName.trim() || displayName, installment.amount, method, paidAt)
        if (result.error) { alert(result.error); return }
      }
      setPaidModalOpen(false)
      await reload()
    } finally { setSubmitting(false) }
  }

  const handleVoidInvoice = async () => {
    if (!invoice) return
    if (!confirm('Cancel this invoice? This will void it in Stripe and it cannot be undone.')) return
    setSubmitting(true)
    const result = await voidStripeInvoice(invoice.id)
    if (result.error) alert(`Error: ${result.error}`)
    setSubmitting(false)
    await reload()
  }

  const handleSyncStatus = async () => {
    if (!invoice) return
    setSubmitting(true)
    const result = await syncInvoiceStatus(invoice.id)
    if (result.error) alert(`Error: ${result.error}`)
    setSubmitting(false)
    await reload()
  }

  const handleRefund = async () => {
    if (!installment || !caseData || !refundAmount) return
    setSubmitting(true)
    try {
      const result = await recordRefund(caseData.id, installment.id, parseFloat(refundAmount), refundReason || undefined)
      if (result.error) { alert(result.error); return }
      setRefundOpen(false)
      await reload()
    } catch { alert('Failed to record refund') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!installment || !caseData) return
    if (!confirm('Delete this installment?')) return
    setSubmitting(true)
    const result = await deleteInstallment(installment.id, caseData.id)
    setSubmitting(false)
    if (result?.error) { alert(result.error); return }
    window.dispatchEvent(new CustomEvent('nexus:case-data-changed', { detail: { caseId: caseData.id } }))
    if (paneBack) paneBack()
    else router.push(`/cases/${urlId}/billing`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }
  if (!installment || !caseData) {
    return <div className="flex items-center justify-center min-h-screen"><p>Installment not found</p></div>
  }

  const statusLabel = isRefund ? 'Refund'
    : installment.paid ? `Paid${invoice?.paid_at ? ` ${formatDate(invoice.paid_at)}` : ''}`
    : invoice?.status === 'sent' ? `Invoice sent ${formatDate(invoice.sent_at)}`
    : installment.due_date ? `Due ${formatDate(installment.due_date)}`
    : 'No due date'

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader
        backHref={`/cases/${urlId}/billing`}
        title={caseData?.case_code || 'Case'}
        subtitle={[client ? ([client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email) : null, services[0]?.services?.name, clientPhone, displayName].filter(Boolean).join(' · ')}
        icon={<Receipt className="w-4 h-4 text-white" />}
        titleHref={caseData?.client_id ? `/clients/${caseData.client_id}` : undefined}
      />

      <div className="space-y-4">
        {/* Refund records are read-only */}
        {isRefund ? (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-5 space-y-3">
            <h3 className="text-base font-semibold text-orange-500">Refund record</h3>
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">
              {Math.abs(installment.amount || 0).toFixed(2)} PLN refunded on {formatDate(installment.due_date)}
              {installment.refund_reason ? ` · ${installment.refund_reason}` : ''}
            </p>
            {parentInstallment && (
              <div className="rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-3 space-y-1.5">
                <p className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">Refunded from</p>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[hsl(var(--color-text-primary))]">
                    {parentInstallment.name || (parentInstallment.is_balance ? 'Final payment' : parentInstallment.is_down_payment ? 'Down Payment' : `Installment ${installments.filter(i => (i.amount || 0) >= 0 && !i.is_balance).findIndex(i => i.id === parentInstallment.id) + 1}`)}
                  </span>
                  <span className="font-semibold text-[hsl(var(--color-text-primary))]">{Math.abs(parentInstallment.amount || 0).toFixed(2)} PLN</span>
                </div>
                <div className="flex justify-between text-xs text-[hsl(var(--color-text-muted))]">
                  <span>{parentInstallment.paid ? 'Paid' : 'Unpaid'}</span>
                  <span>{parentInstallment.due_date ? `Due ${formatDate(parentInstallment.due_date)}` : 'No due date'}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Details */}
            <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5 space-y-3">
              <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Details</h3>
              {!isBalance && (
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Title</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={displayName} disabled={installment.paid} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Amount (PLN)</label>
                  {isBalance ? (
                    <p className="h-10 flex items-center text-sm text-[hsl(var(--color-text-secondary))]">{Math.abs(installment.amount || 0).toFixed(2)} · auto</p>
                  ) : (
                    <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} disabled={installment.paid} />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Due date</label>
                  <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={installment.paid} />
                </div>
              </div>
              {!installment.paid && (
                <div className="flex justify-end">
                  <Button size="md" onClick={handleSaveDetails} disabled={submitting} className="rounded-xl">{submitting ? 'Saving...' : 'Save'}</Button>
                </div>
              )}
            </div>

            {/* Invoice & payment */}
            <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-5 space-y-4">
              <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Invoice & payment</h3>

              {/* SENT */}
              {!installment.paid && invoice?.status === 'sent' && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-1">
                  <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">{invoice.invoice_name}</div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    Sent {formatDate(invoice.sent_at)}{invoice.sent_to_email ? ` to ${invoice.sent_to_email}` : ''}
                    {invoice.due_date ? ` · due ${formatDate(invoice.due_date)}` : ''}
                  </div>
                </div>
              )}

              {/* PAID */}
              {installment.paid && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 space-y-1">
                  <div className="text-sm font-medium text-green-500">Paid {formatDate(invoice?.paid_at)}</div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {invoice?.invoice_name}{invoice?.payment_method ? ` · ${invoice.payment_method}` : ''}
                  </div>
                </div>
              )}

              {/* Invoice details — editable until sent/paid */}
              {!installment.paid && invoice?.status !== 'sent' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Invoice title</label>
                    <Input value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Send to email</label>
                    <Input type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} placeholder="client@email.com" />
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
                        <div className="font-medium text-sm">Manual</div>
                        <div className="text-xs text-[hsl(var(--color-text-secondary))]">Cash, etc.</div>
                      </button>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-sm flex justify-between">
                    <span className="text-[hsl(var(--color-text-secondary))]">Amount{installment.due_date ? ` · due ${formatDate(installment.due_date)}` : ''}</span>
                    <span className="font-bold">{Math.abs(installment.amount || 0).toFixed(2)} PLN</span>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {installment.paid ? (
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
                      <Button size="md" className="bg-green-600 hover:bg-green-700 text-white w-full rounded-xl shadow-[0_2px_12px_rgba(22,163,74,0.3)] hover:shadow-[0_4px_16px_rgba(22,163,74,0.4)]" onClick={() => handleSendDoc('receipt')} disabled={submitting}>
                        Send receipt
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Button size="md" variant="outline" className="rounded-xl" onClick={() => openDoc('invoice')}>
                        <Download className="w-4 h-4 mr-1.5" /> Invoice
                      </Button>
                      {invoice?.status !== 'sent' && (
                        <Button size="md" className="flex-1 rounded-xl" onClick={() => setSendModalOpen(true)} disabled={paymentType !== 'manual' && !sendEmail}>Send Invoice</Button>
                      )}
                    </div>
                    <Button size="md" className="bg-green-600 hover:bg-green-700 text-white w-full rounded-xl shadow-[0_2px_12px_rgba(22,163,74,0.3)] hover:shadow-[0_4px_16px_rgba(22,163,74,0.4)]" onClick={() => { setPaidDate(new Date().toISOString().slice(0, 10)); setPaidModalOpen(true) }}>Mark as Paid</Button>
                  </>
                )}
              </div>

              {/* Sent extras */}
              {!installment.paid && invoice?.status === 'sent' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleSyncStatus} disabled={submitting}>Check status</Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={handleVoidInvoice} disabled={submitting}>Cancel Invoice</Button>
                </div>
              )}

              {/* Paid extras */}
              {installment.paid && (
                <>
                  {!refundOpen ? (
                    <div>
                      <Button size="md" variant="outline" className="w-full rounded-xl text-orange-500" onClick={() => setRefundOpen(true)}>Refund</Button>
                    </div>
                  ) : (
                    <div className="space-y-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Refund amount</label>
                          <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} max={installment.amount || 0} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Reason (optional)</label>
                          <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g., Client request" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setRefundOpen(false)}>Cancel</Button>
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleRefund} disabled={submitting || !refundAmount || parseFloat(refundAmount) <= 0}>
                          {submitting ? 'Processing...' : 'Record Refund'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Draft exists but was never sent */}
              {!installment.paid && invoice?.status === 'draft' && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between gap-3">
                  <span className="text-sm text-[hsl(var(--color-text-secondary))]">
                    An unsent invoice draft exists — cancel it before sending a new one.
                  </span>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10 shrink-0" onClick={handleVoidInvoice} disabled={submitting}>Cancel Draft</Button>
                </div>
              )}
            </div>

          </>
        )}
      </div>

      {canDelete && (
        <DangerZone
          title="Danger zone"
          description="Deleting this installment cannot be undone."
          buttonText="Delete Installment"
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
            <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Send to</span><span className="font-medium">{sendEmail}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Amount</span><span className="font-bold">{Math.abs(installment.amount || 0).toFixed(2)} PLN</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Payment</span><span className="font-medium">{paymentType === 'online' ? 'Online (Stripe link)' : 'Bank transfer'}</span></div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setSendModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSendInvoice} disabled={submitting}>
              {submitting ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mark as Paid confirmation */}
      <Modal isOpen={paidModalOpen} onClose={() => setPaidModalOpen(false)} title="Mark as Paid">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Installment</span><span className="font-medium">{displayName}</span></div>
            <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Amount</span><span className="font-bold">{Math.abs(installment.amount || 0).toFixed(2)} PLN</span></div>
            {!invoice?.stripe_invoice_id && (
              <div className="flex justify-between"><span className="text-[hsl(var(--color-text-secondary))]">Method</span><span className="font-medium capitalize">{paymentType === 'manual' ? 'Cash' : paymentType.replace('_', ' ')}</span></div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Date paid</label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">
            {invoice?.stripe_invoice_id && invoice.status === 'sent'
              ? 'Marks the invoice paid in Stripe and emails a receipt to the client.'
              : 'Records the payment on this installment.'}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setPaidModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleMarkAsPaid} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white shadow-[0_2px_12px_rgba(22,163,74,0.3)] hover:shadow-[0_4px_16px_rgba(22,163,74,0.4)]">
              {submitting ? 'Saving...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
