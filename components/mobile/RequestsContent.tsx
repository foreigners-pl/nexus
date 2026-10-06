'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import type { MyQuery } from '@/app/actions/workflow'
import { fetchMyOpenTasks } from '@/lib/data'
import { getMyQueries } from '@/app/actions/workflow'
import { MobileBackHeader } from '@/components/mobile/MobileBackHeader'
import { usePaneLink } from '@/lib/panes'
import { usePrefetchEntry } from '@/lib/query'
import { ChevronRight, MessageSquare, Loader2 } from 'lucide-react'

const DAY_MS = 86400000

type Task = Awaited<ReturnType<typeof fetchMyOpenTasks>>['tasks'][number]

function formatDueDate(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / DAY_MS)

  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (diffDays < 0) return { label, style: 'text-red-400' }
  if (diffDays === 0) return { label: 'Today', style: 'text-orange-400' }
  if (diffDays === 1) return { label: 'Tomorrow', style: 'text-[hsl(var(--color-text-secondary))]' }
  return { label, style: 'text-[hsl(var(--color-text-secondary))]' }
}

function TaskRow({ task }: { task: Task }) {
  const paneLink = usePaneLink(`/board/${task.board_id}?cardId=${task.id}`)
  const due = formatDueDate(task.due_date)
  return (
    <li>
      <Link
        {...paneLink}
        className="flex items-center gap-3 px-4 py-3.5 active:bg-[hsl(var(--color-surface-hover))]"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {task.boards?.name && (
              <span className="text-xs text-[hsl(var(--color-text-secondary))] truncate">
                {task.boards.name}
              </span>
            )}
            {task.board_statuses?.name && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: `${task.board_statuses.color || '#636366'}20`,
                  color: task.board_statuses.color || '#8E8E93',
                }}
              >
                {task.board_statuses.name}
              </span>
            )}
          </div>
        </div>
        {due && (
          <span className={`text-xs font-medium shrink-0 ${due.style}`}>
            {due.label}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
      </Link>
    </li>
  )
}

function QueryRow({ query }: { query: MyQuery }) {
  const prefetchEntry = usePrefetchEntry()
  const paneLink = usePaneLink(
    query.entry_id
      ? `/cases/${query.case_id}/progress/${query.entry_id}`
      : `/cases/${query.case_id}/progress?q=${query.id}`
  )
  return (
    <li>
      <Link
        {...paneLink}
        onMouseEnter={() => query.entry_id && prefetchEntry(query.entry_id)}
        onTouchStart={() => query.entry_id && prefetchEntry(query.entry_id)}
        className="flex items-center gap-3 px-4 py-3.5 active:bg-[hsl(var(--color-surface-hover))]"
      >
        <MessageSquare className={`w-4 h-4 shrink-0 ${query.needs_me === 'respond' ? 'text-blue-400' : 'text-amber-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[hsl(var(--color-text-primary))] truncate">
            {query.preview || 'Request'}
          </p>
          <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5 truncate">
            {query.client_name || query.case_code || 'Case'}
            {query.step_name && ` · ${query.step_name}`}
          </p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
          query.needs_me === 'respond'
            ? 'bg-blue-400/10 text-blue-400'
            : 'bg-amber-400/10 text-amber-400'
        }`}>
          {query.needs_me === 'respond' ? 'Reply needed' : 'Review answer'}
        </span>
        <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
      </Link>
    </li>
  )
}

function TaskGroup({ title, tasks, accent }: { title: string; tasks: Task[]; accent: string }) {
  if (tasks.length === 0) return null
  return (
    <section>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 px-1 ${accent}`}>
        {title} · {tasks.length}
      </p>
      <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
        {tasks.map(task => <TaskRow key={task.id} task={task} />)}
      </ul>
    </section>
  )
}

export function RequestsContent() {
  const { data } = useQuery({
    queryKey: queryKeys.requests,
    queryFn: async () => {
      const [tasksRes, queriesRes] = await Promise.all([fetchMyOpenTasks(), getMyQueries()])
      return { tasks: tasksRes.tasks, queries: queriesRes.queries }
    },
    staleTime: 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false,
  })

  const tasks = data?.tasks ?? null
  const queries = data?.queries ?? []

  if (!tasks) {
    return (
      <div>
        <MobileBackHeader title="Requests" />
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
        </div>
      </div>
    )
  }

  const cutoff = Date.now() - DAY_MS
  const late = tasks.filter(t => new Date(t.created_at).getTime() < cutoff)
  const fresh = tasks.filter(t => new Date(t.created_at).getTime() >= cutoff)
  const empty = tasks.length === 0 && queries.length === 0

  return (
    <div className="space-y-5">
      <MobileBackHeader title="Requests" />

      {empty ? (
        <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">Nothing needs your attention</p>
        </div>
      ) : (
        <>
          {queries.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-blue-400">
                Requests · {queries.length}
              </p>
              <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
                {queries.map(q => <QueryRow key={q.id} query={q} />)}
              </ul>
            </section>
          )}
          <TaskGroup title="Late tasks" tasks={late} accent="text-red-400" />
          <TaskGroup title="New tasks" tasks={fresh} accent="text-blue-400" />
        </>
      )}
    </div>
  )
}
