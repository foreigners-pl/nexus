'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui'
import { updateMrcCharge, deleteMrcCharge } from '@/app/actions/mrc'
import { sendInvoiceEmail, updateInvoiceStatus, duplicateInvoice } from '@/app/actions/invoices'
import { Plus, X, Repeat, Download, Copy } from 'lucide-react'
import type { MrcCharge, Invoice } from '@/types/database'

interface MrcSectionProps {
  caseId: string
}

const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function MrcSection({ caseId }: MrcSectionProps) {
  const supabase = createClient()
  const [charges, setCharges] = useState<MrcCharge[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [busy, setBusy] = useState(false)

  const [editCharge, setEditCharge] = useState<MrcCharge | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editDay, setEditDay] = useState('1')
  const [editEmails, setEditEmails] = useState<string[]>([])

  const load = async () => {
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from('mrc_charges').select('*').eq('case_id', caseId).order('created_at'),
      supabase.from('invoices').select('*').eq('case_id', caseId).not('mrc_charge_id', 'is', null).order('created_at', { ascending: false }),
    ])
    setCharges(c || [])
    setInvoices(i || [])
  }

  useEffect(() => { load() }, [caseId])

  const openEdit = (c: MrcCharge) => {
    setEditCharge(c)
    setEditName(c.name || '')
    setEditAmount(String(c.amount))
    setEditDay(String(c.day_of_month))
    setEditEmails(c.recipient_emails?.length ? [...c.recipient_emails] : [''])
  }

  const saveEdit = async () => {
    if (!editCharge) return
    setBusy(true)
    try {
      const result = await updateMrcCharge(editCharge.id, caseId, {
        name: editName,
        amount: parseFloat(editAmount) || 0,
        dayOfMonth: parseInt(editDay) || 1,
        recipientEmails: editEmails,
      })
      if (result.error) { alert(result.error); return }
      setEditCharge(null)
      await load()
    } finally { setBusy(false) }
  }

  const toggleAutosend = async (c: MrcCharge) => {
    await updateMrcCharge(c.id, caseId, { autosend: !c.autosend })
    await load()
  }

  const toggleActive = async (c: MrcCharge) => {
    if (c.active && !confirm('Pause this recurring charge? It will stop generating invoices.')) return
    await updateMrcCharge(c.id, caseId, { active: !c.active })
    await load()
  }

  const remove = async (c: MrcCharge) => {
    if (!confirm('Delete this recurring charge? Generated invoices are kept.')) return
    setBusy(true)
    await deleteMrcCharge(c.id, caseId)
    setBusy(false)
    await load()
  }

  const sendInv = async (inv: Invoice) => {
    setBusy(true)
    const result = await sendInvoiceEmail(inv.id, caseId)
    if (result.error) alert(`Error: ${result.error}`)
    setBusy(false)
    await load()
  }

  const markPaid = async (inv: Invoice) => {
    if (!confirm('Mark this invoice as paid?')) return
    setBusy(true)
    await updateInvoiceStatus(inv.id, caseId, 'paid')
    setBusy(false)
    await load()
  }

  const dup = async (inv: Invoice) => {
    setBusy(true)
    const result = await duplicateInvoice(inv.id, caseId)
    if (result.error) alert(result.error)
    setBusy(false)
    await load()
  }

  if (charges.length === 0 && invoices.length === 0) return null

  const statusColor = (s: string) =>
    s === 'paid' ? 'text-green-500 bg-green-500/10 border-green-500/30'
    : s === 'sent' ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    : s === 'cancelled' ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : 'text-amber-400 bg-amber-500/10 border-amber-500/30'

  return (
    <div className="border-t border-[hsl(var(--color-border))] pt-6 space-y-4">
      <div className="flex items-center gap-2">
        <Repeat className="w-4 h-4 text-[hsl(var(--color-text-secondary))]" />
        <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Recurring</h3>
        <span className="text-xs text-[hsl(var(--color-text-muted))]">Monthly charges — not counted toward left to pay</span>
      </div>

      {/* Plans */}
      <div className="space-y-2">
        {charges.map(c => (
          <div key={c.id} className={`rounded-xl border p-4 space-y-2 ${c.active ? 'border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]' : 'border-[hsl(var(--color-border))] opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[hsl(var(--color-text-primary))] truncate">{c.name || 'Recurring charge'}</div>
                <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                  {Number(c.amount).toFixed(2)} PLN / month · due on the {ordinal(c.day_of_month)}
                  {!c.active && ' · paused'}
                </div>
              </div>
              <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                <span className="text-xs text-[hsl(var(--color-text-secondary))]">Auto-send</span>
                <button
                  type="button"
                  onClick={() => toggleAutosend(c)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${c.autosend ? 'bg-[hsl(var(--color-primary))]' : 'bg-[hsl(var(--color-border))]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${c.autosend ? 'translate-x-4' : ''}`} />
                </button>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => toggleActive(c)}>{c.active ? 'Pause' : 'Resume'}</Button>
              <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => remove(c)} disabled={busy}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Generated invoices */}
      {invoices.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-[hsl(var(--color-text-secondary))] uppercase tracking-wide">Generated invoices</div>
          <div className="divide-y divide-[hsl(var(--color-border))] rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]">
            {invoices.map(inv => (
              <div key={inv.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[hsl(var(--color-text-primary))] truncate">
                      {inv.invoice_number && <span className="font-mono text-xs mr-1.5">{inv.invoice_number}</span>}
                      {inv.invoice_name}
                    </div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                      {Math.abs(inv.amount).toFixed(2)} PLN
                      {inv.due_date ? ` · due ${fmt(inv.due_date)}` : ''}
                      {inv.sent_at ? ` · sent ${fmt(inv.sent_at)}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize shrink-0 ${statusColor(inv.status)}`}>{inv.status}</span>
                </div>
                {inv.status !== 'cancelled' && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => window.open(`/print/invoice/${inv.id}`, '_blank')}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Invoice
                    </Button>
                    {(inv.status === 'issued' || inv.status === 'draft') && (
                      <Button size="sm" variant="outline" onClick={() => sendInv(inv)} disabled={busy}>Send</Button>
                    )}
                    {inv.status === 'sent' && (
                      <Button size="sm" variant="outline" onClick={() => sendInv(inv)} disabled={busy}>Resend</Button>
                    )}
                    {inv.status !== 'paid' && (
                      <Button size="sm" variant="ghost" className="text-green-500 hover:bg-green-500/10" onClick={() => markPaid(inv)} disabled={busy}>Mark paid</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => dup(inv)} disabled={busy}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit plan modal */}
      <Modal isOpen={!!editCharge} onClose={() => setEditCharge(null)} title="Edit recurring charge">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Title</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Amount (PLN / month)</label>
              <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Due day (1-31)</label>
              <Input type="number" min={1} max={31} value={editDay} onChange={(e) => setEditDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))]">Send to</label>
            {editEmails.map((email, i) => (
              <div key={i} className="flex gap-2">
                <Input type="email" value={email} onChange={(e) => setEditEmails(editEmails.map((r, j) => j === i ? e.target.value : r))} placeholder="client@email.com" />
                {editEmails.length > 1 && (
                  <button onClick={() => setEditEmails(editEmails.filter((_, j) => j !== i))} className="p-2 text-[hsl(var(--color-text-muted))] hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setEditEmails([...editEmails, ''])} className="flex items-center gap-1.5 text-sm text-[hsl(var(--color-primary))] hover:opacity-80">
              <Plus className="w-4 h-4" /> Add email
            </button>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditCharge(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
