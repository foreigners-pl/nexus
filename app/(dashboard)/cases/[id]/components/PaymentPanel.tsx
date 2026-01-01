'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { addInstallment, updateInstallment, deleteInstallment } from '@/app/actions/installments'
import { createInvoice, updateInvoiceStatus, getInvoicesForCase, recordManualPayment, recordRefund } from '@/app/actions/invoices'
import { createStripeInvoice, sendStripeInvoice, getInvoicePaymentLink, syncInvoiceStatus, voidStripeInvoice, markStripeInvoicePaid, sendInvoiceReceipt, getInvoiceReceiptUrl } from '@/app/actions/stripe'
import type { Installment, Invoice } from '@/types/database'

interface PaymentPanelProps {
  caseId: string
  installments: Installment[]
  services: any[]
  client: {
    id: string
    first_name?: string | null
    last_name?: string | null
    contact_email?: string | null
  } | null
  onUpdate: () => void
}

export function PaymentPanel({ caseId, installments, services, client, onUpdate }: PaymentPanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [editingInstallment, setEditingInstallment] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editAutoInvoice, setEditAutoInvoice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [sendInvoiceModalOpen, setSendInvoiceModalOpen] = useState(false)
  const [manualPaymentModalOpen, setManualPaymentModalOpen] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'other'>('bank_transfer')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [invoicePaymentType, setInvoicePaymentType] = useState<'online' | 'bank_transfer'>('online')
  const [invoiceName, setInvoiceName] = useState('')
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchInvoices()
  }, [caseId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchInvoices() {
    const result = await getInvoicesForCase(caseId)
    if (result.invoices) {
      setInvoices(result.invoices)
    }
  }

  // Filter out refunds for totals calculation (negative amounts are refunds)
  const regularInstallments = installments.filter(i => (i.amount || 0) >= 0)
  const refunds = installments.filter(i => (i.amount || 0) < 0)
  
  const totalAmount = regularInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0)
  const refundedAmount = Math.abs(refunds.reduce((sum, inst) => sum + (inst.amount || 0), 0))
  const paidAmount = regularInstallments.filter(i => i.paid).reduce((sum, inst) => sum + (inst.amount || 0), 0) - refundedAmount
  const remainingAmount = totalAmount - paidAmount - refundedAmount
  const progressPercent = totalAmount > 0 ? Math.max(0, (paidAmount / totalAmount) * 100) : 0

  const getInvoiceForInstallment = (installmentId: string) => {
    return invoices.find(inv => inv.installment_id === installmentId)
  }

  const generateInvoiceName = (installment: Installment) => {
    const serviceNames = services.map(s => s.services?.name).filter(Boolean).join(', ') || 'Services'
    const installmentIndex = installments.findIndex(i => i.id === installment.id)
    const installmentName = installment.is_down_payment ? 'Down Payment' : `Installment ${installmentIndex + 1}`
    return `${serviceNames} - ${installmentName}`
  }

  const getDefaultDueDate = (installment?: Installment) => {
    // If installment has a due date, use it. Otherwise default to 14 days from now.
    if (installment?.due_date) {
      return installment.due_date
    }
    const date = new Date()
    date.setDate(date.getDate() + 14)
    return date.toISOString().split('T')[0]
  }

  const handleSendInvoice = (installmentId: string) => {
    const installment = installments.find(i => i.id === installmentId)
    if (installment) {
      setInvoiceName(generateInvoiceName(installment))
      setInvoiceDueDate(getDefaultDueDate(installment))
    }
    setSelectedInstallmentId(installmentId)
    setSendInvoiceModalOpen(true)
    setActiveDropdown(null)
  }

  const confirmSendInvoice = async () => {
    if (!selectedInstallmentId) return
    setSubmitting(true)
    try {
      const installment = installments.find(i => i.id === selectedInstallmentId)
      if (!installment) return
      
      // Use the edited invoice name from state
      const finalInvoiceName = invoiceName.trim() || generateInvoiceName(installment)
      
      // Use the user-selected due date for both local record and Stripe
      const finalDueDate = invoiceDueDate || installment.due_date
      
      // Create local invoice record first
      const createResult = await createInvoice(caseId, selectedInstallmentId, finalInvoiceName, installment.amount, finalDueDate)
      if (createResult.error) { alert(createResult.error); return }
      if (!createResult.invoice) { alert('Failed to create invoice'); return }
      
      // Create and send via Stripe with payment type and due date
      const stripeResult = await createStripeInvoice(createResult.invoice.id, { 
        autoSend: true,
        paymentType: invoicePaymentType,
        dueDate: finalDueDate || undefined
      })
      if (stripeResult.error) { 
        alert(`Stripe error: ${stripeResult.error}`)
        return 
      }
      
      await fetchInvoices()
      onUpdate()
    } catch (err: any) { alert(err.message || 'Failed to send invoice') }
    finally { 
      setSubmitting(false)
      setSendInvoiceModalOpen(false)
      setSelectedInstallmentId(null)
      setInvoicePaymentType('online')
      setInvoiceName('')
      setInvoiceDueDate('')
    }
  }

  const handleManualPayment = (installmentId: string) => {
    setSelectedInstallmentId(installmentId)
    setPaymentMethod('bank_transfer')
    setManualPaymentModalOpen(true)
    setActiveDropdown(null)
  }

  const confirmManualPayment = async () => {
    if (!selectedInstallmentId) return
    setSubmitting(true)
    try {
      const installment = installments.find(i => i.id === selectedInstallmentId)
      if (!installment) return
      const invoiceName = generateInvoiceName(installment)
      const result = await recordManualPayment(caseId, selectedInstallmentId, invoiceName, installment.amount, paymentMethod)
      if (result.error) { alert(result.error); return }
      await fetchInvoices()
      onUpdate()
    } catch (err) { alert('Failed to record payment') }
    finally { setSubmitting(false); setManualPaymentModalOpen(false); setSelectedInstallmentId(null) }
  }

  const handleEdit = (installment: Installment) => {
    setEditingInstallment(installment.id)
    setEditAmount(installment.amount?.toString() || '0')
    setEditDueDate(installment.due_date || '')
    setEditAutoInvoice(installment.automatic_invoice || false)
    setActiveDropdown(null)
  }

  const handleSaveEdit = async (installmentId: string) => {
    const formData = new FormData()
    formData.set('amount', editAmount)
    formData.set('dueDate', editDueDate)
    formData.set('automaticInvoice', editAutoInvoice ? 'true' : 'false')
    await updateInstallment(installmentId, caseId, formData)
    setEditingInstallment(null)
    setEditAutoInvoice(false)
    onUpdate()
  }

  const handleDelete = (installmentId: string) => {
    setSelectedInstallmentId(installmentId)
    setDeleteModalOpen(true)
    setActiveDropdown(null)
  }

  const confirmDelete = async () => {
    if (!selectedInstallmentId) return
    setSubmitting(true)
    const result = await deleteInstallment(selectedInstallmentId, caseId)
    if (result?.error) { 
      alert(result.error) 
    } else { 
      await fetchInvoices() // Refresh invoices since they get deleted with installment
      onUpdate() 
    }
    setSubmitting(false)
    setDeleteModalOpen(false)
    setSelectedInstallmentId(null)
  }

  const handleRefund = (installmentId: string) => {
    const installment = installments.find(i => i.id === installmentId)
    setSelectedInstallmentId(installmentId)
    setRefundAmount(installment?.amount?.toString() || '0')
    setRefundReason('')
    setRefundModalOpen(true)
    setActiveDropdown(null)
  }

  const confirmRefund = async () => {
    if (!selectedInstallmentId || !refundAmount) return
    setSubmitting(true)
    try {
      const result = await recordRefund(caseId, selectedInstallmentId, parseFloat(refundAmount), refundReason || undefined)
      if (result.error) { alert(result.error); return }
      await fetchInvoices()
      onUpdate()
    } catch (err) { alert('Failed to record refund') }
    finally { setSubmitting(false); setRefundModalOpen(false); setSelectedInstallmentId(null); setRefundAmount(''); setRefundReason('') }
  }

  const handleAddInstallment = async () => {
    await addInstallment(caseId, 0)
    onUpdate()
  }

  const handleMarkAsPaid = async (invoiceId: string) => {
    // Check if invoice has a Stripe ID to determine if we should use Stripe's paid_out_of_band
    const invoice = invoices.find(inv => inv.id === invoiceId)
    
    if (invoice?.stripe_invoice_id) {
      // Use Stripe's mark as paid - this sends a receipt to the customer
      const result = await markStripeInvoicePaid(invoiceId)
      if (result.error) {
        alert(`Error: ${result.error}`)
        return
      }
    } else {
      // No Stripe invoice, just update local status
      await updateInvoiceStatus(invoiceId, caseId, 'paid')
    }
    
    await fetchInvoices()
    onUpdate()
  }

  const handleSendReceipt = async (invoiceId: string) => {
    setActiveDropdown(null)
    const result = await sendInvoiceReceipt(invoiceId)
    if (result.error) {
      alert(`Error: ${result.error}`)
      return
    }
    if (result.receiptUrl) {
      // Open receipt in new tab
      window.open(result.receiptUrl, '_blank')
    }
    alert('Receipt sent to customer')
  }

  const handleViewReceipt = async (invoiceId: string) => {
    setActiveDropdown(null)
    const result = await getInvoiceReceiptUrl(invoiceId)
    if (result.error) {
      alert(`Error: ${result.error}`)
      return
    }
    if (result.receiptUrl) {
      window.open(result.receiptUrl, '_blank')
    } else {
      alert('Receipt not available')
    }
  }

  const handleVoidInvoice = async (invoiceId: string) => {
    if (!confirm('Cancel this invoice? This will void it in Stripe and it cannot be undone.')) return
    setActiveDropdown(null)
    const result = await voidStripeInvoice(invoiceId)
    if (result.error) {
      alert(`Error: ${result.error}`)
      return
    }
    await fetchInvoices()
    onUpdate()
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Check if an installment is a refund (negative amount)
  const isRefund = (installment: Installment) => (installment.amount || 0) < 0

  const getInstallmentStatus = (installment: Installment) => {
    const invoice = getInvoiceForInstallment(installment.id)
    
    // Handle refunds
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

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
            <div className="text-xs text-[hsl(var(--color-text-secondary))] mb-1">Total</div>
            <div className="text-lg font-bold text-[hsl(var(--color-text-primary))]">{totalAmount.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="text-xs text-green-600 mb-1">Received</div>
            <div className="text-lg font-bold text-green-600">{paidAmount.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
            <div className="text-xs text-[hsl(var(--color-text-secondary))] mb-1">Remaining</div>
            <div className="text-lg font-bold text-[hsl(var(--color-text-primary))]">{remainingAmount.toFixed(2)}</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[hsl(var(--color-text-secondary))]">
            <span>Payment Progress</span>
            <span>{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-[hsl(var(--color-surface))] rounded-full overflow-hidden border border-[hsl(var(--color-border))]">
            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="space-y-2">
          {installments.map((installment, index) => {
            const status = getInstallmentStatus(installment)
            const isEditing = editingInstallment === installment.id
            const invoice = getInvoiceForInstallment(installment.id)
            const installmentIsRefund = isRefund(installment)
            
            // Get display name - handle refunds specially
            const getDisplayName = () => {
              if (installmentIsRefund) {
                // Find which installment this is a refund for (based on position)
                const refundInvoice = invoices.find(inv => inv.installment_id === installment.id)
                return refundInvoice?.invoice_name || 'Refund'
              }
              if (installment.is_down_payment) return 'Down Payment'
              // Count only non-refund installments for numbering
              const nonRefundInstallments = installments.filter(i => !isRefund(i))
              const displayIndex = nonRefundInstallments.findIndex(i => i.id === installment.id) + 1
              return `Installment ${displayIndex}`
            }
            
            return (
              <div key={installment.id} className={`p-3 rounded-lg border ${status.borderColor} ${status.bgColor} transition-all ${installmentIsRefund ? 'ml-6' : ''}`}>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="Amount" className="flex-1" />
                      <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-[140px]" title="Due date" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className={`flex items-center gap-2 text-sm cursor-pointer select-none ${!editDueDate ? 'opacity-50' : ''}`}>
                        <div 
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            editAutoInvoice 
                              ? 'bg-blue-500 border-blue-500' 
                              : 'bg-transparent border-[hsl(var(--color-border))]'
                          } ${!editDueDate ? 'cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}`}
                          onClick={() => editDueDate && setEditAutoInvoice(!editAutoInvoice)}
                        >
                          {editAutoInvoice && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span 
                          className={editAutoInvoice ? 'text-[hsl(var(--color-text-primary))]' : 'text-[hsl(var(--color-text-secondary))]'}
                          onClick={() => editDueDate && setEditAutoInvoice(!editAutoInvoice)}
                        >
                          Auto-send invoice on due date
                        </span>
                      </label>
                      {!editDueDate && (
                        <span className="text-xs text-[hsl(var(--color-text-secondary))]">(set due date first)</span>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingInstallment(null); setEditAutoInvoice(false) }}>Cancel</Button>
                      <Button size="sm" onClick={() => handleSaveEdit(installment.id)}>Save</Button>
                    </div>
                  </div>
                ) : (
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
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`font-bold ${installmentIsRefund ? 'text-orange-500' : 'text-[hsl(var(--color-text-primary))]'}`}>
                          {installmentIsRefund ? '' : ''}{Math.abs(installment.amount || 0).toFixed(2)} PLN
                        </div>
                      </div>
                      
                      {/* Actions menu - show for all installments */}
                      <div className="relative" ref={activeDropdown === installment.id ? dropdownRef : null}>
                        <button onClick={() => setActiveDropdown(activeDropdown === installment.id ? null : installment.id)} className="p-1 rounded hover:bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))]">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        
                        {activeDropdown === installment.id && (
                          <div className="absolute right-0 top-8 z-50 w-40 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg shadow-lg py-1">
                            {/* Draft/Unsent: Send Invoice, Edit */}
                            {!installmentIsRefund && !installment.paid && invoice?.status !== 'sent' && (
                              <>
                                <button onClick={() => handleSendInvoice(installment.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))]">
                                  Send Invoice
                                </button>
                                <button onClick={() => handleEdit(installment)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))]">
                                  Edit
                                </button>
                                <button onClick={() => handleManualPayment(installment.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))]">
                                  Record Payment
                                </button>
                              </>
                            )}
                            {/* Sent: Mark as Paid */}
                            {!installmentIsRefund && !installment.paid && invoice?.status === 'sent' && (
                              <button onClick={() => handleMarkAsPaid(invoice.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] text-green-600">
                                Mark as Paid
                              </button>
                            )}
                            {/* Paid: View Receipt, Send Receipt, Refund */}
                            {!installmentIsRefund && installment.paid && invoice?.stripe_invoice_id && (
                              <>
                                <button onClick={() => handleViewReceipt(invoice.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))]">
                                  View Receipt
                                </button>
                                <button onClick={() => handleSendReceipt(invoice.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))]">
                                  Send Receipt
                                </button>
                              </>
                            )}
                            {!installmentIsRefund && installment.paid && (
                              <button onClick={() => handleRefund(installment.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] text-orange-500">
                                Refund
                              </button>
                            )}
                            {/* Sent: Cancel Invoice (destructive) */}
                            {!installmentIsRefund && !installment.paid && invoice?.status === 'sent' && (
                              <button onClick={() => handleVoidInvoice(invoice.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] text-red-500">
                                Cancel Invoice
                              </button>
                            )}
                            {/* Draft only: Delete (destructive) */}
                            {!installment.is_down_payment && invoice?.status !== 'sent' && invoice?.status !== 'paid' && (
                              <button onClick={() => handleDelete(installment.id)} className="w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--color-surface-hover))] text-red-500">
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          
          <button onClick={handleAddInstallment} className="w-full p-3 rounded-lg border-2 border-dashed border-[hsl(var(--color-border))] text-[hsl(var(--color-text-secondary))] hover:border-[hsl(var(--color-primary))] hover:text-[hsl(var(--color-primary))] transition-colors text-sm">
            + Add Installment
          </button>
        </div>
      </div>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Installment">
        <div className="space-y-4">
          <p>Are you sure you want to delete this installment?</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={confirmDelete} disabled={submitting} className="bg-red-500 hover:bg-red-600 text-white">{submitting ? 'Deleting...' : 'Delete'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={sendInvoiceModalOpen} onClose={() => { setSendInvoiceModalOpen(false); setInvoicePaymentType('online'); setInvoiceName(''); setInvoiceDueDate('') }} title="Send Invoice">
        <div className="space-y-4">
          {selectedInstallmentId && (() => {
            const installment = installments.find(i => i.id === selectedInstallmentId)
            const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Unknown Client'
            return (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">Invoice Title</label>
                    <Input
                      value={invoiceName}
                      onChange={(e) => setInvoiceName(e.target.value)}
                      placeholder="e.g., Web Development - Down Payment"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
                      <div className="text-sm text-[hsl(var(--color-text-secondary))]">Client</div>
                      <div className="font-medium">{clientName}</div>
                    </div>
                    <div className="p-3 rounded bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
                      <div className="text-sm text-[hsl(var(--color-text-secondary))]">Amount</div>
                      <div className="font-bold text-lg">{installment?.amount?.toFixed(2)} PLN</div>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
                    <div className="text-sm text-[hsl(var(--color-text-secondary))]">Send to Email</div>
                    <div className="font-medium">{client?.contact_email || <span className="text-red-500">No email set</span>}</div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">Payment Method</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInvoicePaymentType('online')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                        invoicePaymentType === 'online'
                          ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]/10'
                          : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-border-hover))]'
                      }`}
                    >
                      <div className="font-medium">Online Payment</div>
                      <div className="text-xs text-[hsl(var(--color-text-secondary))]">Client pays via Stripe</div>
                    </button>
                    <button
                      onClick={() => setInvoicePaymentType('bank_transfer')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                        invoicePaymentType === 'bank_transfer'
                          ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]/10'
                          : 'border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-border-hover))]'
                      }`}
                    >
                      <div className="font-medium">Bank Transfer</div>
                      <div className="text-xs text-[hsl(var(--color-text-secondary))]">Client pays manually</div>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">Invoice Due Date</label>
                  <Input
                    type="date"
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">
                    The date by which payment is expected
                  </p>
                </div>
              </>
            )
          })()}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setSendInvoiceModalOpen(false); setInvoicePaymentType('online'); setInvoiceName(''); setInvoiceDueDate('') }} disabled={submitting}>Cancel</Button>
            <Button onClick={confirmSendInvoice} disabled={submitting || !client?.contact_email}>{submitting ? 'Sending...' : 'Send Invoice'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={manualPaymentModalOpen} onClose={() => setManualPaymentModalOpen(false)} title="Record Manual Payment">
        <div className="space-y-4">
          <p className="text-[hsl(var(--color-text-secondary))]">Record a payment received outside of Stripe (bank transfer, cash, etc.)</p>
          {selectedInstallmentId && (
            <div className="p-3 rounded bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
              <div className="text-sm text-[hsl(var(--color-text-secondary))]">Amount</div>
              <div className="text-lg font-bold">{installments.find(i => i.id === selectedInstallmentId)?.amount?.toFixed(2)} PLN</div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">Payment Method</label>
            <Select options={[{ id: 'bank_transfer', label: 'Bank Transfer' }, { id: 'cash', label: 'Cash' }, { id: 'other', label: 'Other' }]} value={paymentMethod} onChange={(val) => setPaymentMethod(val as 'cash' | 'bank_transfer' | 'other')} placeholder="Select method..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setManualPaymentModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={confirmManualPayment} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white">{submitting ? 'Recording...' : 'Record Payment'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={refundModalOpen} onClose={() => setRefundModalOpen(false)} title="Record Refund">
        <div className="space-y-4">
          <p className="text-[hsl(var(--color-text-secondary))]">Record a refund for this payment. The refund will appear as a separate entry.</p>
          {selectedInstallmentId && (
            <div className="p-3 rounded bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))]">
              <div className="text-sm text-[hsl(var(--color-text-secondary))]">Original Payment</div>
              <div className="text-lg font-bold">{installments.find(i => i.id === selectedInstallmentId)?.amount?.toFixed(2)} PLN</div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">Refund Amount</label>
            <Input 
              type="number" 
              value={refundAmount} 
              onChange={(e) => setRefundAmount(e.target.value)} 
              placeholder="Amount to refund"
              max={installments.find(i => i.id === selectedInstallmentId)?.amount || 0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">Reason (optional)</label>
            <Input 
              type="text" 
              value={refundReason} 
              onChange={(e) => setRefundReason(e.target.value)} 
              placeholder="e.g., Customer request, Service cancelled"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setRefundModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={confirmRefund} disabled={submitting || !refundAmount || parseFloat(refundAmount) <= 0} className="bg-orange-500 hover:bg-orange-600 text-white">
              {submitting ? 'Processing...' : 'Record Refund'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
