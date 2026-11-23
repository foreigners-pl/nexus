'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import type { MyQuery } from '@/app/actions/workflow'
import { fetchMyOpenTasks } from '@/lib/data'
import { getMyQueries } from '@/app/actions/workflow'
import { markRequestSeen, markAllRequestsSeen, getMyAnsweredHistory } from '@/app/actions/feed'
import { MobileBackHeader } from '@/components/mobile/MobileBackHeader'
import { usePaneLink } from '@/lib/panes'
import { ChevronRight, MessageSquare, Loader2, CheckCheck } from 'lucide-react'

const DAY_MS = 86400000

type Task = Awaited<ReturnType<typeof fetchMyOpenTasks>>['tasks'][number]
type AnsweredHistoryItem = Awaited<ReturnType<typeof getMyAnsweredHistory>>['queries'][number]

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
  const paneLink = usePaneLink(
    query.step_id
      ? `/cases/${query.case_id}/progress?s=${query.step_id}`
      : `/cases/${query.case_id}/progress`
  )
  return (
    <li>
      <Link
        {...paneLink}
        className="flex items-center gap-3 px-4 py-3.5 active:bg-[hsl(var(--color-surface-hover))]"
      >
        <MessageSquare className={`w-4 h-4 shrink-0 ${query.needs_me === 'respond' ? 'text-blue-400' : 'text-green-400'}`} />
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
            : 'bg-green-500/10 text-green-400'
        }`}>
          {query.needs_me === 'respond' ? 'Reply needed' : 'Mark as seen'}
        </span>
        <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
      </Link>
    </li>
  )
}

function HistoryRow({ item }: { item: AnsweredHistoryItem }) {
  const paneLink = usePaneLink(
    item.step_id
      ? `/cases/${item.case_id}/progress?s=${item.step_id}`
      : `/cases/${item.case_id}/progress`
  )
  return (
    <li>
      <Link
        {...paneLink}
        className="flex items-center gap-3 px-4 py-3 active:bg-[hsl(var(--color-surface-hover))]"
      >
        <CheckCheck className={`w-4 h-4 shrink-0 ${item.seen_at ? 'text-[hsl(var(--color-text-muted))]' : 'text-green-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[hsl(var(--color-text-primary))] truncate">
            {item.client_name || item.case_code || 'Case'}
            {item.step_name && ` · ${item.step_name}`}
          </p>
          <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-0.5">
            Answered {item.answered_at ? new Date(item.answered_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
            {item.seen_at ? ' · seen' : ' · unseen'}
          </p>
        </div>
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
  const queryClient = useQueryClient()
  const [showHistory, setShowHistory] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const { data } = useQuery({
    queryKey: queryKeys.requests,
    queryFn: async () => {
      const [tasksRes, queriesRes, historyRes] = await Promise.all([
        fetchMyOpenTasks(),
        getMyQueries(),
        getMyAnsweredHistory(10),
      ])
      return { tasks: tasksRes.tasks, queries: queriesRes.queries, history: historyRes.queries }
    },
    staleTime: 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: false,
  })

  const tasks = data?.tasks ?? null
  const queries = data?.queries ?? []
  const history = data?.history ?? []

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
  const pendingSince = (q: MyQuery) => new Date(q.pending_since ?? q.created_at).getTime()
  const toAnswer = queries.filter(q => q.needs_me === 'respond')
  const answered = queries.filter(q => q.needs_me === 'seen')
  const lateQueries = toAnswer.filter(q => pendingSince(q) < cutoff)
  const freshQueries = toAnswer.filter(q => pendingSince(q) >= cutoff)
  const empty = tasks.length === 0 && queries.length === 0

  const markAll = async () => {
    setMarkingAll(true)
    await markAllRequestsSeen()
    setMarkingAll(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.requests })
  }

  return (
    <div className="space-y-5">
      <MobileBackHeader title="Requests" />

      {empty ? (
        <div className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl p-8 text-center">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">Nothing needs your attention</p>
        </div>
      ) : (
        <>
          {lateQueries.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-red-400">
                Late requests · {lateQueries.length}
              </p>
              <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
                {lateQueries.map(q => <QueryRow key={q.id} query={q} />)}
              </ul>
            </section>
          )}
          {freshQueries.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-blue-400">
                New requests · {freshQueries.length}
              </p>
              <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
                {freshQueries.map(q => <QueryRow key={q.id} query={q} />)}
              </ul>
            </section>
          )}
          {answered.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-400">
                  Answered · {answered.length}
                </p>
                <button
                  onClick={markAll}
                  disabled={markingAll}
                  className="text-xs font-medium text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] disabled:opacity-40"
                >
                  {markingAll ? 'Marking…' : 'Mark all as seen'}
                </button>
              </div>
              <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
                {answered.map(q => <QueryRow key={q.id} query={q} />)}
              </ul>
            </section>
          )}
          <TaskGroup title="Late tasks" tasks={late} accent="text-red-400" />
          <TaskGroup title="New tasks" tasks={fresh} accent="text-blue-400" />
        </>
      )}

      {history.length > 0 && (
        <section>
          {!showHistory ? (
            <button
              onClick={() => setShowHistory(true)}
              className="w-full text-center text-xs font-medium text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] py-2"
            >
              Show last {history.length} answers
            </button>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-[hsl(var(--color-text-muted))]">
                Last {history.length} answers
              </p>
              <ul className="bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-2xl divide-y divide-[hsl(var(--color-border))] overflow-hidden">
                {history.map(item => <HistoryRow key={item.id} item={item} />)}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  )
}
