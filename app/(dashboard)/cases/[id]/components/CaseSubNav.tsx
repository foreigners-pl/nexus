'use client'

import Link from 'next/link'
import { ListChecks, Receipt, FolderOpen, ChevronRight } from 'lucide-react'
import { usePaneNavigate } from '@/lib/panes'

/** Process / Billing / Files navigation for a case, each row showing a summary. */
export function CaseSubNav({ caseId, processInfo, billingInfo, filesInfo }: {
  caseId: string
  processInfo?: string
  billingInfo?: string
  filesInfo?: string
}) {
  const paneNav = usePaneNavigate()
  const items = [
    { key: 'process', label: 'Process', info: processInfo, href: `/cases/${caseId}/progress`, icon: ListChecks },
    { key: 'billing', label: 'Billing', info: billingInfo, href: `/cases/${caseId}/billing`, icon: Receipt },
    { key: 'files', label: 'Files', info: filesInfo, href: `/cases/${caseId}/files`, icon: FolderOpen },
  ]

  return (
    <div className="space-y-2">
      {items.map(item => {
        const Icon = item.icon
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={(e) => { if (paneNav(item.href)) e.preventDefault() }}
            className="flex items-center gap-3 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3.5 hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
          >
            <Icon className="w-5 h-5 text-[hsl(var(--color-text-secondary))] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">{item.label}</p>
              {item.info && (
                <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate mt-0.5">{item.info}</p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-[hsl(var(--color-text-muted))] shrink-0" />
          </Link>
        )
      })}
    </div>
  )
}
