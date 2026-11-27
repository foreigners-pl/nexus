'use client'

import { useState } from 'react'
import {
  scanAccountingMonth, generateAccountingRegister,
  type MonthScan, type GenerateResult,
} from '@/app/actions/accounting'
import type { SaleRow } from '@/lib/accounting/statement'
import { Select } from '@/components/ui/Select'
import {
  FileText, Sheet, Landmark, File as FileIcon, Loader2, Plus, Trash2,
  ExternalLink, RefreshCw, CircleCheck,
} from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ id: String(i + 1), label: m }))
const CHANNEL_OPTIONS = [
  { id: 'Bank', label: 'Bank' },
  { id: 'Stripe', label: 'Stripe' },
  { id: 'Other', label: 'Other' },
]

const KIND = {
  statement: { label: 'Bank statement', icon: Landmark, cls: 'bg-blue-400/10 text-blue-400' },
  register: { label: 'Register', icon: Sheet, cls: 'bg-green-400/10 text-green-400' },
  invoice: { label: 'Invoice', icon: FileText, cls: 'bg-amber-400/10 text-amber-400' },
  other: { label: 'Other', icon: FileIcon, cls: 'bg-[hsl(var(--color-surface-hover))] text-[hsl(var(--color-text-secondary))]' },
} as const

const input =
  'w-full rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-bg))] px-2 py-1.5 text-sm text-[hsl(var(--color-text-primary))] focus:outline-none focus:border-[hsl(var(--color-primary))]'

export default function AccountingPage() {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const [year, setYear] = useState(prev.getFullYear())
  const [month, setMonth] = useState(prev.getMonth() + 1)
  const [scan, setScan] = useState<MonthScan | null>(null)
  const [sales, setSales] = useState<SaleRow[]>([])
  const [busy, setBusy] = useState<'scan' | 'gen' | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const included = sales.filter(s => s.include !== false)
  const total = included.reduce((a, s) => a + (Number(s.gross) || 0), 0)

  const run = async () => {
    setBusy('scan'); setError(null); setResult(null)
    try {
      const s = await scanAccountingMonth(year, month)
      setScan(s); setSales(s.sales)
    } catch (e: any) {
      setError(e.message || 'Scan failed'); setScan(null)
    } finally { setBusy(null) }
  }

  const generate = async () => {
    setBusy('gen'); setError(null)
    try { setResult(await generateAccountingRegister(year, month, sales)) }
    catch (e: any) { setError(e.message || 'Generation failed') }
    finally { setBusy(null) }
  }

  const set = (i: number, patch: Partial<SaleRow>) =>
    setSales(rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const addRow = () =>
    setSales(rows => [...rows, {
      date: `01.${String(month).padStart(2, '0')}.${year}`,
      description: '', gross: 0, vatRate: 0.23,
      paymentId: 0, channel: 'Bank', payer: '', note: '', include: true,
    }])

  const section = 'text-xs font-semibold uppercase tracking-wide text-[hsl(var(--color-text-secondary))] mb-2'

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
      <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-1">Accounting</h1>
      <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-6">
        Pull the month's docs from Drive, review the sales rows, generate the ewidencja register.
      </p>

      {/* month picker */}
      <div className="flex items-end gap-2 mb-6">
        <div className="flex-1 max-w-[8rem]">
          <label className={section}>Year</label>
          <input type="number" className={input} value={year} onChange={e => setYear(Number(e.target.value))} />
        </div>
        <div className="flex-1 max-w-[12rem]">
          <label className={section}>Month</label>
          <Select
            options={MONTH_OPTIONS}
            value={String(month)}
            onChange={v => setMonth(Number(v))}
            searchable={false}
          />
        </div>
        <button
          onClick={run} disabled={!!busy}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--color-primary))] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy === 'scan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Scan Drive
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400 mb-4">{error}</div>
      )}

      {scan && (
        <>
          {/* docs */}
          <p className={section}>Documents in {scan.folderName} ({scan.docs.length})</p>
          <ul className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] divide-y divide-[hsl(var(--color-border))] mb-6">
            {scan.docs.map(d => {
              const k = KIND[d.kind]
              const Icon = k.icon
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon className="w-4 h-4 text-[hsl(var(--color-text-secondary))] shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-sm text-[hsl(var(--color-text-primary))]">{d.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${k.cls}`}>{k.label}</span>
                </li>
              )
            })}
          </ul>

          {/* sales preview */}
          <div className="flex items-center justify-between mb-2">
            <p className={section}>
              Sales rows{!scan.statementFound && ' — no statement found, add manually'}
            </p>
            <button onClick={addRow} className="flex items-center gap-1 text-xs font-medium text-[hsl(var(--color-primary))]">
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
          </div>
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] divide-y divide-[hsl(var(--color-border))] mb-2">
            {sales.map((s, i) => (
              <div key={i} className={`px-3 py-3 ${s.include === false ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox" checked={s.include !== false}
                    onChange={e => set(i, { include: e.target.checked })}
                    className="w-4 h-4 accent-[hsl(var(--color-primary))] shrink-0"
                  />
                  <input
                    className={`${input} !w-28`} value={s.date}
                    onChange={e => set(i, { date: e.target.value })}
                  />
                  <input
                    className={`${input} !w-24 text-right`} inputMode="decimal" value={s.gross}
                    onChange={e => set(i, { gross: Number(e.target.value.replace(',', '.')) || 0 })}
                  />
                  <div className="w-24 shrink-0">
                    <Select
                      options={CHANNEL_OPTIONS}
                      value={s.channel}
                      onChange={v => set(i, { channel: v as SaleRow['channel'] })}
                      searchable={false}
                    />
                  </div>
                  <button
                    onClick={() => setSales(rows => rows.filter((_, j) => j !== i))}
                    className="p-1.5 text-[hsl(var(--color-text-secondary))] hover:text-red-400 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  className={input} value={s.description} placeholder="Name – service"
                  onChange={e => set(i, { description: e.target.value })}
                />
                {(s.payer || s.note) && (
                  <p className="mt-1.5 text-[11px] text-[hsl(var(--color-text-secondary))] truncate" title={s.note}>
                    {s.payer && <span className="font-medium">{s.payer}</span>}
                    {s.note && <span className="ml-2 opacity-70">{s.note}</span>}
                  </p>
                )}
              </div>
            ))}
            {sales.length === 0 && (
              <p className="px-4 py-6 text-sm text-[hsl(var(--color-text-secondary))] text-center">
                No credits parsed — add rows manually or check the statement file.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between py-3 mb-4">
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">
              {included.length} row{included.length === 1 ? '' : 's'} · gross{' '}
              <span className="font-semibold text-[hsl(var(--color-text-primary))]">
                {total.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
              </span>
            </p>
            <button
              onClick={generate} disabled={!!busy || !scan.templateAvailable}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === 'gen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sheet className="w-4 h-4" />}
              Generate register
            </button>
          </div>
          {!scan.templateAvailable && (
            <p className="text-xs text-amber-400 -mt-3 mb-4">
              No register xlsx found in this or earlier months to use as a template — drop last month's file into Drive.
            </p>
          )}

          {result && (
            <div className="rounded-xl border border-green-400/30 bg-green-400/10 px-4 py-3 flex items-center gap-3">
              <CircleCheck className="w-5 h-5 text-green-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))] truncate">{result.fileName}</p>
                <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                  {result.rowCount} rows · {result.totalGross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł gross — saved to the month folder
                </p>
              </div>
              <a
                href={`https://drive.google.com/file/d/${result.driveFileId}/view`}
                target="_blank" rel="noreferrer"
                className="p-2 text-green-400 hover:text-green-300"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
