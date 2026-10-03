'use client'

import { useState, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { addInstallment, setCaseTotal } from '@/app/actions/installments'
import { usePaneNavigate } from '@/lib/panes'
import { getInvoicesForCase } from '@/app/actions/invoices'
import type { Installment, Invoice } from '@/types/database'

interface PaymentPanelProps {
  caseId: string
  caseUrlId: string
  installments: Installment[]
  totalPrice: number
  onUpdate: () => void
}

export function PaymentPanel({ caseId, caseUrlId, installments, totalPrice, onUpdate }: PaymentPanelProps) {
  const paneNav = usePaneNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [editingTotal, setEditingTotal] = useState(false)
  const [editTotalValue, setEditTotalValue] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newInstAmount, setNewInstAmount] = useState('')
  const [newInstDueDate, setNewInstDueDate] = useState('')

  useEffect(() => {
    fetchInvoices()
  }, [caseId])

  async function fetchInvoices() {
    const result = await getInvoicesForCase(caseId)
    if (result.invoices) {
      setInvoices(result.invoices)
    }
  }

  // Filter out refunds (negative amounts) — they count against what was received
  const refunds = installments.filter(i => (i.amount || 0) < 0)
  const refundedAmount = Math.abs(refunds.reduce((sum, inst) => sum + (inst.amount || 0), 0))
  const paidAmount = installments.filter(i => i.paid && (i.amount || 0) >= 0).reduce((sum, inst) => sum + (inst.amount || 0), 0) - refundedAmount
  const remainingAmount = totalPrice - paidAmount
  const progressPercent = totalPrice > 0 ? Math.max(0, Math.min(100, (paidAmount / totalPrice) * 100)) : 0

  // Scheduled installments first (by position), the auto "Final payment" balance row last
  const orderedInstallments = [...installments].sort(
    (a, b) => Number(a.is_balance ?? false) - Number(b.is_balance ?? false) || (a.position - b.position)
  )

  const getInvoiceForInstallment = (installmentId: string) => {
    return invoices.find(inv => inv.installment_id === installmentId && inv.status !== 'cancelled')
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Check if an installment is a refund (negative amount)
  const isRefund = (installment: Installment) => (installment.amount || 0) < 0

  const getInstallmentStatus = (installment: Installment) => {
    const invoice = getInvoiceForInstallment(installment.id)

    if (isRefund(installment)) {
      return {
        icon: '↩', color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30',
        label: `Refunded ${formatDate(installment.due_date)}`
      }
    }

    if (installment.paid) {
      const paidInvoice = invoices.find(inv => inv.installment_id === installment.id && inv.status === 'paid')
      const method = paidInvoice?.invoice_name?.includes('Cash') ? 'Cash'
        : paidInvoice?.invoice_name?.includes('Bank Transfer') ? 'Bank Transfer'
        : paidInvoice?.invoice_name?.includes('Manual') ? 'Manual' : 'Paid'
      return {
        icon: '✓', color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30',
        label: `Paid${paidInvoice?.paid_at ? ` ${formatDate(paidInvoice.paid_at)}` : ''} (${method})`
      }
    }

    if (invoice?.status === 'sent') {
      return {
        icon: '📧', color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30',
        label: `Invoice sent ${formatDate(invoice.sent_at)}`
      }
    }

    if (installment.due_date) {
      const dueDate = new Date(installment.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dueDate.setHours(0, 0, 0, 0)
      if (dueDate < today) {
        return {
          icon: '!', color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30',
          label: `Overdue - was due ${formatDate(installment.due_date)}`
        }
      }
    }

    return {
      icon: '○', color: 'text-[hsl(var(--color-text-secondary))]', bgColor: 'bg-[hsl(var(--color-surface))]', borderColor: 'border-[hsl(var(--color-border))]',
      label: installment.due_date ? `Due ${formatDate(installment.due_date)}` : 'No due date'
    }
  }

  const confirmAddInstallment = async () => {
    const amount = parseFloat(newInstAmount)
    if (!amount || amount <= 0) return
    setSubmitting(true)
    await addInstallment(caseId, amount, newInstDueDate || undefined)
    setAddModalOpen(false)
    setNewInstAmount('')
    setNewInstDueDate('')
    onUpdate()
    setSubmitting(false)
  }

  const saveTotal = async () => {
    const value = parseFloat(editTotalValue)
    setSubmitting(true)
    await setCaseTotal(caseId, isNaN(value) ? null : value)
    setEditingTotal(false)
    setSubmitting(false)
    onUpdate()
  }

  return (
    <>
      <div className="space-y-4">
        {/* Total — editable, defaults to the service price */}
        <div className="flex items-start justify-between p-3 rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
          <span className={`text-sm font-medium text-[hsl(var(--color-text-secondary))] ${editingTotal ? 'pt-2' : ''}`}>Total</span>
          {editingTotal ? (
            <div className="flex-1 ml-4 space-y-2">
              <Input
                type="number"
                value={editTotalValue}
                onChange={(e) => setEditTotalValue(e.target.value)}
                placeholder={totalPrice.toFixed(2)}
                className="w-full"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditingTotal(false)}>Cancel</Button>
                <Button size="sm" onClick={saveTotal} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setEditTotalValue(String(totalPrice)); setEditingTotal(true) }}
              className="flex items-center gap-1.5 text-lg font-bold text-[hsl(var(--color-text-primary))] hover:text-[hsl(var(--color-primary))] transition-colors"
              title="Edit total"
            >
              {totalPrice.toFixed(2)} PLN
              <svg className="w-3.5 h-3.5 text-[hsl(var(--color-text-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {/* Received / Remaining + progress */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">Received</p>
            <p className="text-xl font-bold text-green-500">{Math.max(0, paidAmount).toFixed(2)} PLN</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">Remaining</p>
            <p className="text-xl font-bold text-[hsl(var(--color-primary))]">{Math.max(0, remainingAmount).toFixed(2)} PLN</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[hsl(var(--color-surface))] rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Installments */}
        <div className="space-y-2">
          {orderedInstallments.map((installment) => {
            const status = getInstallmentStatus(installment)
            const installmentIsRefund = isRefund(installment)

            const getDisplayName = () => {
              if (installmentIsRefund) {
                const refundInvoice = invoices.find(inv => inv.installment_id === installment.id)
                return refundInvoice?.invoice_name || 'Refund'
              }
              if (installment.name) return installment.name
              if (installment.is_balance) return 'Final payment'
              if (installment.is_down_payment) return 'Down Payment'
              const nonRefundInstallments = installments.filter(i => !isRefund(i) && !i.is_balance)
              const displayIndex = nonRefundInstallments.findIndex(i => i.id === installment.id) + 1
              return `Installment ${displayIndex}`
            }

            const invoice = getInvoiceForInstallment(installment.id)
            const row = (
              <div className={`p-3 rounded-lg border ${status.borderColor} ${status.bgColor} transition-all cursor-pointer hover:bg-[hsl(var(--color-surface-hover))]`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${status.bgColor} ${status.color} border ${status.borderColor}`}>
                      {status.icon}
                    </div>
                    <div>
                      <div className="font-medium text-[hsl(var(--color-text-primary))]">
                        {getDisplayName()}
                      </div>
                      <div className={`text-xs ${status.color}`}>
                        {status.label}
                        {!installment.paid && installment.automatic_invoice && installment.due_date && !invoice && (
                          <span className="ml-2 text-blue-500">• Auto-invoice {formatDate(installment.due_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`font-bold ${installmentIsRefund ? 'text-orange-500' : 'text-[hsl(var(--color-text-primary))]'}`}>
                      {Math.abs(installment.amount || 0).toFixed(2)} PLN
                    </div>
                    <ChevronRight className="w-5 h-5 text-[hsl(var(--color-text-secondary))]" />
                  </div>
                </div>
              </div>
            )

            return (
              <Fragment key={installment.id}>
                {installment.is_balance && (
                  <button onClick={() => setAddModalOpen(true)} className="w-full p-3 rounded-lg border-2 border-dashed border-[hsl(var(--color-border))] text-[hsl(var(--color-text-secondary))] hover:border-[hsl(var(--color-primary))] hover:text-[hsl(var(--color-primary))] transition-colors text-sm">
                    + Add Installment
                  </button>
                )}
                <Link
                  href={`/cases/${caseUrlId}/billing/${installment.id}`}
                  className="block"
                  onClick={(e) => { if (paneNav(`/cases/${caseUrlId}/billing/${installment.id}`)) e.preventDefault() }}
                >
                  {row}
                </Link>
              </Fragment>
            )
          })}

          {/* No balance row exists — plain add button at the bottom */}
          {!orderedInstallments.some(i => i.is_balance) && (
            <button onClick={() => setAddModalOpen(true)} className="w-full p-3 rounded-lg border-2 border-dashed border-[hsl(var(--color-border))] text-[hsl(var(--color-text-secondary))] hover:border-[hsl(var(--color-primary))] hover:text-[hsl(var(--color-primary))] transition-colors text-sm">
              + Add Installment
            </button>
          )}
        </div>
      </div>

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Installment">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Amount (PLN)</label>
            <Input
              type="number"
              value={newInstAmount}
              onChange={(e) => setNewInstAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Due date</label>
            <Input type="date" value={newInstDueDate} onChange={(e) => setNewInstDueDate(e.target.value)} />
          </div>
          <Button onClick={confirmAddInstallment} disabled={submitting || !newInstAmount} className="w-full">
            {submitting ? 'Adding...' : 'Add Installment'}
          </Button>
        </div>
      </Modal>
    </>
  )
}
