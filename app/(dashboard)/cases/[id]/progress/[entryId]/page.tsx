'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import {
  getCaseEntry,
  getQueryThread,
  replyToQuery,
  closeQuery,
  type CaseEntry,
  type CaseQuery,
  type QueryMessage,
} from '@/app/actions/workflow'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, fetchEntryQuery } from '@/lib/query'
import {
  Loader2,
  StickyNote,
  Zap,
  MessageSquare,
  Send,
} from 'lucide-react'

const KIND_META = {
  note: { label: 'Note', icon: StickyNote, cls: 'text-[hsl(var(--color-text-secondary))]' },
  action: { label: 'Action', icon: Zap, cls: 'text-[hsl(var(--color-primary))]' },
  query: { label: 'Request', icon: MessageSquare, cls: 'text-blue-400' },
} as const

const STATUS_BADGE: Record<CaseQuery['status'], { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'text-blue-400 bg-blue-400/10' },
  answered: { label: 'Answered', cls: 'text-amber-400 bg-amber-400/10' },
  closed: { label: 'Closed', cls: 'text-[hsl(var(--color-text-muted))] bg-[hsl(var(--color-surface-active))]' },
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function EntryPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id: urlId, entryId } = use(params)
  const [entry, setEntry] = useState<CaseEntry | null>(null)
  const [stepName, setStepName] = useState<string | null>(null)
  const [caseTitle, setCaseTitle] = useState<string | null>(null)
  const [caseSubtitle, setCaseSubtitle] = useState<string | null>(null)
  const [query, setQuery] = useState<CaseQuery | null>(null)
  const [completedByName, setCompletedByName] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  const applyData = useCallback((d: Awaited<ReturnType<typeof getCaseEntry>>) => {
    setEntry(d.entry)
    setStepName(d.stepName)
    setCaseTitle(d.caseTitle)
    setCaseSubtitle(d.caseSubtitle)
    setQuery(d.query)
    setCompletedByName(d.completedByName)
    setClientId(d.clientId)
    setMeId(d.meId)
  }, [])

  const load = useCallback(async () => {
    // fetchQuery joins an in-flight row-hover prefetch; staleTime:0 keeps
    // post-mutation refreshes (replies, closes) fetching fresh data.
    const d = await fetchEntryQuery(queryClient, entryId)
    applyData(d)
    setLoading(false)
  }, [entryId, applyData, queryClient])

  useEffect(() => {
    const cached = queryClient.getQueryData<Awaited<ReturnType<typeof getCaseEntry>>>(queryKeys.entry(entryId))
    if (cached?.entry) {
      applyData(cached)
      setLoading(false)
    }
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Entry not found</p>
      </div>
    )
  }

  const meta = KIND_META[entry.kind] || KIND_META.note
  const Icon = meta.icon
  const author = entry.author?.display_name || entry.author?.email?.split('@')[0] || 'Someone'

  return (
    <div className="pb-20">
      <SubPageHeader
        backHref={`/cases/${urlId}/progress`}
        title={caseTitle || meta.label}
        subtitle={caseSubtitle || (stepName ? `Step · ${stepName}` : undefined)}
        icon={<Icon className="w-4 h-4 text-white" />}
        titleHref={clientId ? `/clients/${clientId}` : undefined}
      />

      {query ? (
        <QueryChat
          query={query}
          stepName={stepName}
          caseId={entry.case_id}
          meId={meId}
          onChanged={load}
        />
      ) : (
        /* Entry body */
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <Icon className={`w-4 h-4 shrink-0 ${meta.cls}`} />
            <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
              {meta.label}
              {stepName ? ` · ${stepName}` : ''}
            </p>
          </div>

          {entry.body && (
            <p className="text-sm text-[hsl(var(--color-text-primary))] whitespace-pre-wrap">
              {entry.body}
            </p>
          )}

          <p className="text-xs text-[hsl(var(--color-text-muted))] mt-3">
            {author} · {fmtDateTime(entry.created_at)}
          </p>

          {entry.kind === 'action' && (
            <div className="mt-3 pt-3 border-t border-[hsl(var(--color-border))] space-y-1.5">
              {entry.due_date && (
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  <span className="text-[hsl(var(--color-text-muted))]">Due:</span>{' '}
                  {new Date(entry.due_date).toLocaleDateString()}
                </p>
              )}
              {entry.waiting_on && (
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  <span className="text-[hsl(var(--color-text-muted))]">Waiting on:</span>{' '}
                  {entry.waiting_on}
                </p>
              )}
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                <span className="text-[hsl(var(--color-text-muted))]">Status:</span>{' '}
                {entry.completed_at
                  ? `Completed ${new Date(entry.completed_at).toLocaleDateString()}${completedByName ? ` by ${completedByName}` : ''}`
                  : 'Open'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QueryChat({ query, stepName, caseId, meId, onChanged }: {
  query: CaseQuery
  stepName: string | null
  caseId: string
  meId: string | null
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [thread, setThread] = useState<QueryMessage[] | null>(null)
  const [status, setStatus] = useState<CaseQuery['status']>(query.status)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadThread = useCallback(async () => {
    const data = await getQueryThread(query.id)
    setThread(data.messages)
    if (data.query) setStatus(data.query.status)
  }, [query.id])

  useEffect(() => { loadThread() }, [loadThread])

  // Scroll to the newest message when the thread loads or grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [thread?.length])

  const sendReply = async () => {
    if (!reply.trim()) return
    setSaving(true)
    await replyToQuery(query.id, caseId, reply)
    const data = await getQueryThread(query.id)
    setThread(data.messages)
    if (data.query) setStatus(data.query.status)
    setReply('')
    setSaving(false)
    onChanged()
    queryClient.invalidateQueries({ queryKey: queryKeys.requests })
  }

  const close = async () => {
    setSaving(true)
    await closeQuery(query.id, caseId)
    setStatus('closed')
    setSaving(false)
    onChanged()
    queryClient.invalidateQueries({ queryKey: queryKeys.requests })
  }

  const canReply = status !== 'closed' && (meId === query.opened_by || meId === query.assigned_to)
  const canClose = status !== 'closed' && meId === query.opened_by
  const badge = STATUS_BADGE[status]

  return (
    <div className="flex flex-col">
      {/* Status row */}
      <div className="flex items-center gap-2 px-1 mb-4">
        <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="text-xs text-[hsl(var(--color-text-muted))] truncate">
          {query.direction === 'legal_to_csr' ? 'Legal → CSR' : 'CSR → Legal'}
          {stepName ? ` · ${stepName}` : ''}
        </span>
        {canClose && (
          <button
            onClick={close}
            disabled={saving}
            className="ml-auto text-xs font-medium text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] shrink-0"
          >
            Close request
          </button>
        )}
      </div>

      {/* Messages */}
      {!thread ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {thread.map(m => {
            const mAuthor = m.author?.display_name || m.author?.email?.split('@')[0] || 'Someone'
            const mine = m.author_id === meId
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  mine
                    ? 'bg-[hsl(var(--color-primary))] text-white rounded-br-md'
                    : 'bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-primary))] rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                </div>
                <p className="text-[10px] text-[hsl(var(--color-text-muted))] mt-1 px-1">
                  {mAuthor} · {new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            )
          })}
          {status === 'closed' && (
            <p className="text-center text-xs text-[hsl(var(--color-text-muted))] py-2">
              Request closed
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Composer — pinned above the mobile bottom nav, flush on desktop */}
      {canReply && (
        <div className="sticky bottom-20 md:bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-[hsl(var(--color-background))]/95 backdrop-blur">
          <div className="flex gap-2 items-center">
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendReply()}
              placeholder="Reply…"
              className="flex-1 h-11 px-4 rounded-full bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none"
            />
            <button
              onClick={sendReply}
              disabled={saving || !reply.trim()}
              className="w-11 h-11 rounded-full bg-[hsl(var(--color-primary))] text-white flex items-center justify-center disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
