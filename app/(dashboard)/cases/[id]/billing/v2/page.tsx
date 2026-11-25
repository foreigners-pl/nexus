'use client'

import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loader2, Receipt, ChevronRight, FlaskConical, FileText } from 'lucide-react'
import {
  getCaseBillingV2, addCharge, createInvoiceFromCharges,
  type ChargeV2, type PaymentV2, type InvoiceV2, type ChargeKind,
} from '@/app/actions/charges'
import { setCaseTotal } from '@/app/actions/installments'
import { usePaneNavigate } from '@/lib/panes'
import { isDesktopViewport } from '@/lib/viewport'

const KIND_LABEL: Record<ChargeKind, string> = {
  down_payment: 'Down payment',
  installment: 'Installment',
  balance: 'Remainder',
  one_off: 'One-off',
  recurring: 'Monthly',
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  stripe: 'Stripe',
  manual: 'Manual',
  refund: 'Refund',
}

const STATUS_STYLE: Record<ChargeV2['status'], { chip: string; label: string }> = {
  paid:      { chip: 'bg-green-500/10 text-green-500 border-green-500/30',        label: 'Paid' },
  partial:   { chip: 'bg-amber-500/10 text-amber-500 border-amber-500/30',        label: 'Partial' },
  invoiced:  { chip: 'bg-blue-500/10 text-blue-500 border-blue-500/30',           label: 'Invoiced' },
  overdue:   { chip: 'bg-red-500/10 text-red-500 border-red-500/30',              label: 'Overdue' },
  scheduled: { chip: 'bg-[hsl(var(--color-surface))] text-[hsl(var(--color-text-secondary))] border-[hsl(var(--color-border))]', label: 'Scheduled' },
  cancelled: { chip: 'bg-[hsl(var(--color-surface))] text-[hsl(var(--color-text-muted))] border-[hsl(var(--color-border))]',     label: 'Cancelled' },
}

const fmt = (n: number) => n.toFixed(2)
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

function chargeDisplayName(c: ChargeV2, installments: ChargeV2[]) {
  if (c.name) return c.name
  if (c.kind === 'balance') return 'Remainder'
  if (c.kind === 'down_payment') return 'Down payment'
  if (c.kind === 'recurring') return 'Monthly charge'
  if (c.kind === 'one_off') return 'One-off'
  const idx = installments.filter(x => x.kind === 'installment').findIndex(x => x.id === c.id) + 1
  return `Installment ${idx}`
}

export default function BillingV2Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: urlId } = use(params)
  const router = useRouter()
  const paneNav = usePaneNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalDraft, setTotalDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // add-charge form
  const [newKind, setNewKind] = useState<ChargeKind>('installment')
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newRecurDay, setNewRecurDay] = useState('')
  const [newAutoInv, setNewAutoInv] = useState(false)

  // invoice form
  const [invName, setInvName] = useState('')
  const [invAmount, setInvAmount] = useState('')
  const [invDue, setInvDue] = useState('')

  useEffect(() => {
    isMounted.current = true
    load()
    return () => { isMounted.current = false }
  }, [urlId])

  const load = async () => {
    const res = await getCaseBillingV2(urlId)
    if (!isMounted.current) return
    if ('error' in res) { setLoading(false); return }
    setData(res)
    setLoading(false)
  }

  const refresh = async () => { await load() }

  if (loading) {
    return <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }
  if (!data) return <div className="flex items-center justify-center min-h-screen"><p>Case not found</p></div>

  const { case: caseRow, client, caseServices, total, charges, payments, invoices } = data as {
    case: any; client: any; caseServices: any[]; total: number
    charges: ChargeV2[]; payments: PaymentV2[]; invoices: InvoiceV2[]
  }

  const clientName = client ? [client.first_name, client.last_name].filter(Boolean).join(' ') || client.contact_email : null
  const serviceName = caseServices[0]?.services?.name || caseRow.custom_service_name || null

  const paidTotal = payments.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0)
  const refundTotal = Math.abs(payments.filter(p => p.amount < 0).reduce((s, p) => s + p.amount, 0))
  const outstanding = Math.max(0, total - paidTotal + refundTotal)
  const overdueCount = charges.filter(c => c.status === 'overdue').length

  const ordered = [...charges].sort(
    (a, b) => Number(a.kind === 'balance') - Number(b.kind === 'balance') || a.position - b.position
  )
  const selectable = (c: ChargeV2) => !c.cancelled && c.paid_amount < c.amount
  const selectedCharges = ordered.filter(c => selected.has(c.id))
  const selectedSum = selectedCharges.reduce((s, c) => s + (c.amount - c.paid_amount), 0)

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const openInvoiceModal = () => {
    setInvName(selectedCharges.map(c => chargeDisplayName(c, ordered)).join(' + '))
    setInvAmount(fmt(selectedSum))
    setInvDue('')
    setInvoiceOpen(true)
  }

  const guard = async (fn: () => Promise<void>) => {
    try { await fn() } catch (e: any) { setError(e?.message || 'Action failed — try refreshing the page') }
  }

  const saveTotal = async () => {
    const value = parseFloat(totalDraft)
    setSubmitting(true)
    await guard(async () => { await setCaseTotal(caseRow.id, isNaN(value) ? null : value) })
    setEditingTotal(false)
    setSubmitting(false)
    refresh()
  }

  const confirmAdd = async () => {
    const amount = parseFloat(newAmount)
    if (!amount || amount <= 0) return
    setSubmitting(true)
    await guard(async () => {
      const res = await addCharge(caseRow.id, {
        name: newName || undefined,
        amount,
        dueDate: newDue || undefined,
        kind: newKind,
        recurDay: newRecurDay ? parseInt(newRecurDay) : undefined,
        automaticInvoice: newAutoInv,
      })
      if (res.error) { setError(res.error); return }
      setAddOpen(false)
      setNewName(''); setNewAmount(''); setNewDue(''); setNewRecurDay(''); setNewAutoInv(false); setNewKind('installment')
    })
    setSubmitting(false)
    refresh()
  }

  const confirmInvoice = async () => {
    const amount = parseFloat(invAmount)
    if (!invName.trim() || isNaN(amount) || amount <= 0) return
    setSubmitting(true)
    await guard(async () => {
      const res = await createInvoiceFromCharges(caseRow.id, [...selected], invName.trim(), amount, invDue || undefined)
      if (res.error) { setError(res.error); return }
      setInvoiceOpen(false)
      const first = [...selected][0]
      setSelected(new Set())
      const href = `/cases/${urlId}/billing/v2/${first}`
      if (!paneNav(href)) router.push(href)
    })
    setSubmitting(false)
    refresh()
  }

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader
        backHref={`/cases/${urlId}/billing`}
        title={serviceName || caseRow.case_code || 'Case'}
        subtitle={clientName || undefined}
        icon={<Receipt className="w-4 h-4 text-white" />}
        titleHref={caseRow.client_id ? `/clients/${caseRow.client_id}` : undefined}
      />

      <div className="flex items-center gap-2 mb-3 px-1">
        <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-500">New billing preview — data is separate from the current billing page</span>
      </div>

      {/* Header strip */}
      <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">Total</p>
            {editingTotal ? (
              <div className="flex items-center gap-1 justify-center mt-1">
                <Input type="number" value={totalDraft} onChange={e => setTotalDraft(e.target.value)} className="w-24 h-7 text-sm" autoFocus={isDesktopViewport()} />
                <Button size="sm" onClick={saveTotal} disabled={submitting}>Save</Button>
              </div>
            ) : (
              <button onClick={() => { setTotalDraft(String(total)); setEditingTotal(true) }} className="text-lg font-bold text-[hsl(var(--color-text-primary))] hover:text-[hsl(var(--color-primary))]">
                {fmt(total)} <span className="text-xs font-normal text-[hsl(var(--color-text-muted))]">PLN</span>
              </button>
            )}
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">Paid</p>
            <p className="text-lg font-bold text-green-500">{fmt(Math.max(0, paidTotal - refundTotal))} <span className="text-xs font-normal">PLN</span></p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">Outstanding</p>
            <p className="text-lg font-bold text-[hsl(var(--color-primary))]">{fmt(outstanding)} <span className="text-xs font-normal">PLN</span></p>
          </div>
        </div>
        {overdueCount > 0 && (
          <p className="text-center text-xs font-medium text-red-500 mt-2">{overdueCount} overdue</p>
        )}
      </div>

      {/* Payment plan */}
      <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 mb-4">
        <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))] mb-3">Payment plan</h3>
        <div className="space-y-2">
          {ordered.map(c => {
            const st = STATUS_STYLE[c.status]
            const canPick = selectable(c)
            return (
              <div key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border ${st.chip} transition-all`}>
                {canPick && (
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="w-5 h-5 shrink-0 accent-[hsl(var(--color-primary))]"
                    title="Select for invoice"
                  />
                )}
                <Link
                  href={`/cases/${urlId}/billing/v2/${c.id}`}
                  onClick={(e) => { if (paneNav(`/cases/${urlId}/billing/v2/${c.id}`)) e.preventDefault() }}
                  className="flex items-center justify-between flex-1 min-w-0"
                >
                  <div className="min-w-0">
                    <p className={`font-medium text-[hsl(var(--color-text-primary))] truncate ${c.status === 'cancelled' ? 'line-through' : ''}`}>
                      {chargeDisplayName(c, ordered)}
                      {c.kind === 'recurring' && c.recur_day && (
                        <span className="ml-2 text-xs font-normal text-[hsl(var(--color-text-secondary))]">every month · day {c.recur_day}</span>
                      )}
                    </p>
                    <p className="text-xs mt-0.5">
                      <span className={st.chip.split(' ')[1]}>{st.label}</span>
                      {c.status === 'partial' && <span className="text-[hsl(var(--color-text-secondary))]"> · {fmt(c.paid_amount)} of {fmt(c.amount)}</span>}
                      {c.due_date && c.status !== 'paid' && <span className="text-[hsl(var(--color-text-secondary))]"> · due {fmtDate(c.due_date)}</span>}
                      {c.automatic_invoice && <span className="text-blue-500"> · auto-invoice</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-[hsl(var(--color-text-primary))]">{fmt(c.amount)} <span className="text-xs font-normal">PLN</span></span>
                    <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-secondary))]" />
                  </div>
                </Link>
              </div>
            )
          })}
          <button onClick={() => setAddOpen(true)} className="w-full p-3 rounded-xl border-2 border-dashed border-[hsl(var(--color-border))] text-[hsl(var(--color-text-secondary))] hover:border-[hsl(var(--color-primary))] hover:text-[hsl(var(--color-primary))] transition-colors text-sm">
            + Add charge
          </button>
        </div>

        {selected.size > 0 && (
          <button onClick={openInvoiceModal} className="w-full mt-3 p-3 rounded-xl bg-[hsl(var(--color-primary))] text-white text-sm font-semibold">
            Create invoice · {fmt(selectedSum)} PLN ({selected.size} charge{selected.size > 1 ? 's' : ''})
          </button>
        )}
      </div>

      {/* Invoices */}
      <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4">
        <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))] mb-3">Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">No invoices yet — select charges above to create one.</p>
        ) : (
          <div className="divide-y divide-[hsl(var(--color-border))]">
            {invoices.map(inv => {
              const href = inv.charge_ids[0]
                ? `/cases/${urlId}/billing/v2/${inv.charge_ids[0]}`
                : `/print/invoice/${inv.id}`
              return (
              <Link key={inv.id} href={href} onClick={(e) => { if (paneNav(href)) e.preventDefault() }} className="flex items-center gap-3 py-2.5">
                <FileText className="w-4 h-4 text-[hsl(var(--color-text-secondary))] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[hsl(var(--color-text-primary))] truncate">
                    {inv.invoice_number ? `#${inv.invoice_number} · ` : ''}{inv.invoice_name}
                  </p>
                  <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">
                    <span className={
                      inv.status === 'paid' ? 'text-green-500' :
                      inv.status === 'sent' ? 'text-blue-500' :
                      inv.status === 'cancelled' ? 'text-[hsl(var(--color-text-muted))]' :
                      'text-[hsl(var(--color-text-secondary))]'
                    }>{inv.status}</span>
                    {inv.sent_at && <span> · sent {fmtDate(inv.sent_at)}</span>}
                    {inv.charge_names.length > 0 && <span> · covers {inv.charge_names.join(', ')}</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[hsl(var(--color-text-primary))] shrink-0">{fmt(inv.amount)} PLN</span>
              </Link>
              )
            })}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

      {/* Add charge modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add charge">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Kind</label>
            <div className="flex flex-wrap gap-2">
              {(['installment', 'down_payment', 'one_off', 'recurring'] as ChargeKind[]).map(k => (
                <button
                  key={k}
                  onClick={() => setNewKind(k)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${newKind === k ? 'border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]/10' : 'border-[hsl(var(--color-border))] text-[hsl(var(--color-text-secondary))]'}`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Name (optional)</label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={KIND_LABEL[newKind]} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Amount (PLN)</label>
            <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00" />
          </div>
          {newKind === 'recurring' ? (
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Day of month</label>
              <Input type="number" min={1} max={28} value={newRecurDay} onChange={e => setNewRecurDay(e.target.value)} placeholder="1" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Due date</label>
              <Input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
            <input type="checkbox" checked={newAutoInv} onChange={e => setNewAutoInv(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--color-primary))]" />
            Auto-invoice when due
          </label>
          <Button onClick={confirmAdd} disabled={submitting || !newAmount} className="w-full">
            {submitting ? 'Adding...' : 'Add charge'}
          </Button>
        </div>
      </Modal>

      {/* Create invoice modal */}
      <Modal isOpen={invoiceOpen} onClose={() => setInvoiceOpen(false)} title="Create invoice">
        <div className="space-y-4">
          <div className="rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] p-3 text-sm text-[hsl(var(--color-text-secondary))]">
            {selectedCharges.map(c => (
              <div key={c.id} className="flex justify-between py-0.5">
                <span>{chargeDisplayName(c, ordered)}</span>
                <span>{fmt(c.amount - c.paid_amount)} PLN</span>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Invoice title</label>
            <Input value={invName} onChange={e => setInvName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Amount (PLN)</label>
            <Input type="number" value={invAmount} onChange={e => setInvAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Due date</label>
            <Input type="date" value={invDue} onChange={e => setInvDue(e.target.value)} />
          </div>
          <Button onClick={confirmInvoice} disabled={submitting || !invName.trim() || !invAmount} className="w-full">
            {submitting ? 'Creating...' : 'Create draft invoice'}
          </Button>
        </div>
      </Modal>

    </div>
  )
}
