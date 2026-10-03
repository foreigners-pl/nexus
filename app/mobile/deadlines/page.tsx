import Link from 'next/link'
import { getMyOpenActions } from '@/app/actions/workflow'
import { MobileBackHeader } from '@/app/mobile/components/MobileBackHeader'
import { ChevronRight } from 'lucide-react'

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

export default async function MobileDeadlinesPage() {
  const { actions } = await getMyOpenActions()
  const withDates = actions.filter(a => a.due_date)

  return (
    <div>
      <MobileBackHeader title="Deadlines" />

      {withDates.length === 0 ? (
        <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">No upcoming action deadlines</p>
        </div>
      ) : (
        <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
          {withDates.map((a) => {
            const deadline = formatDeadline(a.due_date!)
            return (
              <li key={a.id}>
                <Link
                  href={`/cases/${a.case_id}/progress?e=${a.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-[hsl(var(--color-surface-hover))]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
                      {a.body || 'Action'}
                    </p>
                    <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5 truncate">
                      {a.client_name || a.case_code || 'Case'}
                      {a.case_code && a.client_name && ` · ${a.case_code}`}
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
          })}
        </ul>
      )}
    </div>
  )
}
