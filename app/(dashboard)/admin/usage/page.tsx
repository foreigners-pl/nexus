'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUsageOverview, type UsageRow, type UsageItem } from '@/app/actions/admin'
import { usePaneLink } from '@/lib/panes'
import { ChevronLeft, ChevronDown, Loader2, MessageSquare, Zap, AlertTriangle } from 'lucide-react'

function formatLastSeen(ts: string | null) {
  if (!ts) return 'Never'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 5) return 'Online now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function formatDate(ts: string | null) {
  if (!ts) return null
  const date = new Date(ts)
  const hasTime = ts.includes('T') && ts.length > 10
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    (hasTime ? ` ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : '')
}

const tagStyles: Record<UsageItem['tag'], { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-blue-400/10 text-blue-400' },
  late: { label: 'Late', cls: 'bg-red-400/10 text-red-400' },
  upcoming: { label: 'Due', cls: 'bg-orange-400/10 text-orange-400' },
  reply: { label: 'Reply needed', cls: 'bg-blue-400/10 text-blue-400' },
  review: { label: 'Review', cls: 'bg-amber-400/10 text-amber-400' },
  neglected: { label: 'Neglected', cls: 'bg-amber-400/10 text-amber-400' },
}

function ItemRow({ item }: { item: UsageItem }) {
  const paneLink = usePaneLink(item.href)
  const tag = tagStyles[item.tag]
  return (
    <li>
      <Link
        {...paneLink}
        className="flex items-center gap-3 px-4 py-3 active:bg-[hsl(var(--color-surface-hover))]"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[hsl(var(--color-text-primary))] truncate">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5 truncate">
              {item.subtitle}
            </p>
          )}
        </div>
        {item.date && (
          <span className="text-[11px] text-[hsl(var(--color-text-muted))] shrink-0">
            {formatDate(item.date)}
          </span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${tag.cls}`}>
          {tag.label}
        </span>
        <ChevronLeft className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0 rotate-180" />
      </Link>
    </li>
  )
}

function ItemGroup({ title, icon, accent, items }: {
  title: string
  icon: React.ReactNode
  accent: string
  items: UsageItem[]
}) {
  if (items.length === 0) return null
  return (
    <section className="mt-3 first:mt-0">
      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 px-1 flex items-center gap-1.5 ${accent}`}>
        {icon} {title} · {items.length}
      </p>
      <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
        {items.map(item => <ItemRow key={item.id} item={item} />)}
      </ul>
    </section>
  )
}

function CountChip({ n, warn }: { n: number; warn?: boolean }) {
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${
      n === 0
        ? 'text-[hsl(var(--color-text-muted))] bg-[hsl(var(--color-surface-hover))]'
        : warn
          ? 'text-red-400 bg-red-400/10'
          : 'text-[hsl(var(--color-text-primary))] bg-[hsl(var(--color-surface-hover))]'
    }`}>
      {n}
    </span>
  )
}

function UserRow({ row }: { row: UsageRow }) {
  const [open, setOpen] = useState(false)
  const total = row.requestsNew + row.requestsLate + row.actionsUpcoming + row.actionsLate + row.neglected

  return (
    <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))] truncate">{row.name}</p>
            {row.role && (
              <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--color-text-muted))] shrink-0">{row.role}</span>
            )}
          </div>
          <p className="text-[11px] text-[hsl(var(--color-text-secondary))] mt-0.5">
            Last seen {formatLastSeen(row.lastSeenAt)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {total > 0 && (
            <>
              <CountChip n={row.requestsNew + row.requestsLate} warn={row.requestsLate > 0} />
              <CountChip n={row.actionsUpcoming + row.actionsLate} warn={row.actionsLate > 0} />
              <CountChip n={row.neglected} warn={row.neglected > 0} />
            </>
          )}
          {total === 0 && <span className="text-[11px] text-[hsl(var(--color-text-muted))]">All clear</span>}
          <ChevronDown className={`w-4 h-4 text-[hsl(var(--color-text-muted))] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-[hsl(var(--color-border))]">
          {total === 0 ? (
            <p className="text-xs text-[hsl(var(--color-text-muted))] py-3 text-center">Nothing needs attention</p>
          ) : (
            <>
              <ItemGroup
                title="Requests"
                icon={<MessageSquare className="w-3.5 h-3.5" />}
                accent="text-blue-400"
                items={row.requests}
              />
              <ItemGroup
                title="Actions"
                icon={<Zap className="w-3.5 h-3.5" />}
                accent="text-orange-400"
                items={row.actions}
              />
              <ItemGroup
                title="Neglected cases"
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                accent="text-amber-400"
                items={row.neglectedCases}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminUsagePage() {
  const [rows, setRows] = useState<UsageRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getUsageOverview().then(res => {
      if (res.error) setError(res.error)
      setRows(res.users)
    })
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-20">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Admin
      </Link>
      <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-2">Usage overview</h1>
      <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-6">
        Activity and workload per team member — expand a row to see their items.
      </p>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!rows ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--color-text-secondary))]" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(r => <UserRow key={r.userId} row={r} />)}
        </div>
      )}
    </div>
  )
}
