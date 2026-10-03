'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getMyOpenActions, getCasesMissingActions, type MyAction, type MissingActionCase } from '@/app/actions/workflow'
import { MobileBackHeader } from '@/components/mobile/MobileBackHeader'
import { usePaneLink } from '@/lib/panes'
import { ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'

function formatDeadline(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)

  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  if (diffDays < 0) return { label, tag: `${Math.abs(diffDays)}d overdue`, style: 'text-red-400' }
  if (diffDays === 0) return { label, tag: 'Today', style: 'text-orange-400' }
  if (diffDays <= 7) return { label, tag: `in ${diffDays}d`, style: 'text-orange-400' }
  return { label, tag: `in ${diffDays}d`, style: 'text-[hsl(var(--color-text-secondary))]' }
}

function MissingActionRow({ item }: { item: MissingActionCase }) {
  const paneLink = usePaneLink(`/cases/${item.case_id}/progress`)
  return (
    <li>
      <Link
        {...paneLink}
        className="flex items-center gap-3 px-4 py-3.5 active:bg-[hsl(var(--color-surface-hover))]"
      >
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
            {item.client_name || item.case_code || 'Case'}
          </p>
          <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5 truncate">
            {item.step_name || 'In service'}
            {item.case_code && item.client_name && ` · ${item.case_code}`}
          </p>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-amber-400/10 text-amber-400">
          Neglected
        </span>
        <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
      </Link>
    </li>
  )
}

function ActionRow({ action }: { action: MyAction }) {
  const paneLink = usePaneLink(`/cases/${action.case_id}/progress/${action.id}`)
  const deadline = formatDeadline(action.due_date!)
  return (
    <li>
      <Link
        {...paneLink}
        className="flex items-center gap-3 px-4 py-3.5 active:bg-[hsl(var(--color-surface-hover))]"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
            {action.body || 'Action'}
          </p>
          <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5 truncate">
            {action.client_name || action.case_code || 'Case'}
            {action.case_code && action.client_name && ` · ${action.case_code}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xs font-medium ${deadline.style}`}>{deadline.tag}</p>
          <p className="text-[10px] text-[hsl(var(--color-text-muted))]">{deadline.label}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
      </Link>
    </li>
  )
}

export function ActionsContent() {
  const [actions, setActions] = useState<MyAction[] | null>(null)
  const [missing, setMissing] = useState<MissingActionCase[]>([])

  useEffect(() => {
    Promise.all([getMyOpenActions(), getCasesMissingActions()]).then(([{ actions }, { cases }]) => {
      setActions(actions)
      setMissing(cases)
    })
  }, [])

  const withDates = (actions || []).filter(a => a.due_date)
  const empty = withDates.length === 0 && missing.length === 0

  return (
    <div className="space-y-5">
      <MobileBackHeader title="Actions" />

      {!actions ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
        </div>
      ) : empty ? (
        <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">No actions on your cases</p>
        </div>
      ) : (
        <>
          {missing.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-amber-400">
                Neglected · {missing.length}
              </p>
              <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
                {missing.map(c => <MissingActionRow key={c.case_id} item={c} />)}
              </ul>
            </section>
          )}
          {withDates.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-[hsl(var(--color-text-muted))]">
                Due · {withDates.length}
              </p>
              <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
                {withDates.map(a => <ActionRow key={a.id} action={a} />)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
