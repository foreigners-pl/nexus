'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUsageOverview, type UsageRow } from '@/app/actions/admin'
import { ChevronLeft, Loader2 } from 'lucide-react'

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

function Count({ n, warn }: { n: number; warn?: boolean }) {
  if (n === 0) return <span className="text-[hsl(var(--color-text-muted))]">0</span>
  return (
    <span className={`font-semibold ${warn ? 'text-red-400' : 'text-[hsl(var(--color-text-primary))]'}`}>
      {n}
    </span>
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
        Activity and workload per team member.
      </p>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!rows ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--color-text-secondary))]" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[hsl(var(--color-border))] text-left text-xs text-[hsl(var(--color-text-muted))]">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
                <th className="px-4 py-3 font-medium text-center">Req. new</th>
                <th className="px-4 py-3 font-medium text-center">Req. late</th>
                <th className="px-4 py-3 font-medium text-center">Actions upcoming</th>
                <th className="px-4 py-3 font-medium text-center">Actions late</th>
                <th className="px-4 py-3 font-medium text-center">Neglected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--color-border))]">
              {rows.map(r => (
                <tr key={r.userId}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[hsl(var(--color-text-primary))]">{r.name}</p>
                    {r.role && <p className="text-[11px] text-[hsl(var(--color-text-muted))] uppercase">{r.role}</p>}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--color-text-secondary))]">
                    {formatLastSeen(r.lastSeenAt)}
                  </td>
                  <td className="px-4 py-3 text-center"><Count n={r.requestsNew} /></td>
                  <td className="px-4 py-3 text-center"><Count n={r.requestsLate} warn /></td>
                  <td className="px-4 py-3 text-center"><Count n={r.actionsUpcoming} /></td>
                  <td className="px-4 py-3 text-center"><Count n={r.actionsLate} warn /></td>
                  <td className="px-4 py-3 text-center"><Count n={r.neglected} warn /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
