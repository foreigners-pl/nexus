'use client'

import { use, useCallback, useEffect, useState } from 'react'
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
  query: { label: 'Query', icon: MessageSquare, cls: 'text-blue-400' },
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
  const [query, setQuery] = useState<CaseQuery | null>(null)
  const [openerName, setOpenerName] = useState<string | null>(null)
  const [assigneeName, setAssigneeName] = useState<string | null>(null)
  const [completedByName, setCompletedByName] = useState<string | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const d = await getCaseEntry(entryId)
    setEntry(d.entry)
    setStepName(d.stepName)
    setQuery(d.query)
    setOpenerName(d.openerName)
    setAssigneeName(d.assigneeName)
    setCompletedByName(d.completedByName)
    setMeId(d.meId)
    setLoading(false)
  }, [entryId])

  useEffect(() => { load() }, [load])

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
        title={meta.label}
        subtitle={stepName ? `Step · ${stepName}` : undefined}
        icon={<Icon className="w-4 h-4 text-white" />}
      />

      {/* Entry body */}
      <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <Icon className={`w-4 h-4 shrink-0 ${meta.cls}`} />
          <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">{meta.label}</p>
          {query && (
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[query.status].cls}`}>
              {STATUS_BADGE[query.status].label}
            </span>
          )}
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

        {query && (
          <p className="text-xs text-[hsl(var(--color-text-muted))] mt-3 pt-3 border-t border-[hsl(var(--color-border))]">
            {query.direction === 'legal_to_csr' ? 'Legal → CSR' : 'CSR → Legal'}
            {openerName && ` · ${openerName} → ${assigneeName || 'unassigned'}`}
            {query.closed_at && ` · closed ${new Date(query.closed_at).toLocaleDateString()}`}
          </p>
        )}
      </div>

      {/* Query thread */}
      {query && (
        <QueryThread
          query={query}
          caseId={entry.case_id}
          meId={meId}
          onChanged={load}
        />
      )}
    </div>
  )
}

function QueryThread({ query, caseId, meId, onChanged }: {
  query: CaseQuery
  caseId: string
  meId: string | null
  onChanged: () => void
}) {
  const [thread, setThread] = useState<QueryMessage[] | null>(null)
  const [status, setStatus] = useState<CaseQuery['status']>(query.status)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)

  const loadThread = useCallback(async () => {
    const data = await getQueryThread(query.id)
    setThread(data.messages)
    if (data.query) setStatus(data.query.status)
  }, [query.id])

  useEffect(() => { loadThread() }, [loadThread])

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
  }

  const close = async () => {
    setSaving(true)
    await closeQuery(query.id, caseId)
    setStatus('closed')
    setSaving(false)
    onChanged()
  }

  const canReply = status !== 'closed' && (meId === query.opened_by || meId === query.assigned_to)
  const canClose = status !== 'closed' && meId === query.opened_by

  return (
    <div className="mt-4 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
      <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Thread</p>

      {!thread ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
        </div>
      ) : (
        <>
          {thread.map(m => {
            const mAuthor = m.author?.display_name || m.author?.email?.split('@')[0] || 'Someone'
            const mine = m.author_id === meId
            return (
              <div key={m.id} className={`text-sm ${mine ? 'text-right' : ''}`}>
                <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-left ${
                  mine
                    ? 'bg-[hsl(var(--color-primary))]/15 text-[hsl(var(--color-text-primary))]'
                    : 'bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-primary))]'
                }`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
                <p className="text-[10px] text-[hsl(var(--color-text-muted))] mt-0.5">
                  {mAuthor} · {new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            )
          })}

          {canReply && (
            <div className="flex gap-2 pt-1">
              <input
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendReply()}
                placeholder="Reply…"
                className="flex-1 h-9 px-3 rounded-lg bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] outline-none"
              />
              <button
                onClick={sendReply}
                disabled={saving || !reply.trim()}
                className="w-9 h-9 rounded-lg bg-[hsl(var(--color-primary))] text-white flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}

          {canClose && (
            <button
              onClick={close}
              disabled={saving}
              className="text-xs font-medium text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]"
            >
              Close query
            </button>
          )}
        </>
      )}
    </div>
  )
}
