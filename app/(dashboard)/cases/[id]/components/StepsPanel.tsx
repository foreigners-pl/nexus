'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  getCaseWorkflow,
  moveToStep,
  addNote,
  createAction,
  completeAction,
  updateAction,
  openQuery,
  type CaseStep,
  type CaseEntry,
  type CaseQuery,
} from '@/app/actions/workflow'
import { usePaneLink } from '@/lib/panes'
import { isDesktopViewport } from '@/lib/viewport'
import {
  ChevronRight,
  ChevronLeft,
  StickyNote,
  Zap,
  Loader2,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'

interface StepsPanelProps {
  caseId: string
}

export function StepsPanel({ caseId }: StepsPanelProps) {
  const [steps, setSteps] = useState<CaseStep[]>([])
  const [entries, setEntries] = useState<CaseEntry[]>([])
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [openAction, setOpenAction] = useState<CaseEntry | null>(null)
  const [queries, setQueries] = useState<Record<string, CaseQuery>>({})
  const [loading, setLoading] = useState(true)
  const [viewIdx, setViewIdx] = useState(0)
  const [dragPct, setDragPct] = useState(0)
  const [animating, setAnimating] = useState(false)
  const didInit = useRef(false)
  const touchStartX = useRef<number | null>(null)
  const slideRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const data = await getCaseWorkflow(caseId)
    setSteps(data.steps)
    setEntries(data.entries)
    setQueries(data.queries)
    setCurrentStepId(data.currentStepId)
    setOpenAction(data.openAction)
    setLoading(false)
    if (!didInit.current) {
      const idx = data.steps.findIndex(s => s.id === data.currentStepId)
      setViewIdx(idx >= 0 ? idx : 0)
      didInit.current = true
    }
  }, [caseId])

  useEffect(() => { load() }, [load])

  const handleMove = async (stepId: string) => {
    await moveToStep(caseId, stepId)
    setCurrentStepId(stepId)
    load()
  }

  // All steps live on one track; the transform is -viewIdx*100 + dragPct.
  // navTo animates the drag delta to the target, then swaps the index —
  // the end position is identical so there's no visual jump.
  const navTo = (i: number) => {
    if (i === viewIdx || i < 0 || i >= steps.length || animating) return
    setAnimating(true)
    setDragPct((viewIdx - i) * 100)
    window.setTimeout(() => {
      setViewIdx(i)
      setDragPct(0)
      setAnimating(false)
    }, 220)
  }

  const snapBack = () => {
    setAnimating(true)
    setDragPct(0)
    window.setTimeout(() => setAnimating(false), 200)
    touchStartX.current = null
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || animating) return
    const dx = e.touches[0].clientX - touchStartX.current
    const w = slideRef.current?.offsetWidth || 1
    const atEdge = (viewIdx === 0 && dx > 0) || (viewIdx === steps.length - 1 && dx < 0)
    setDragPct((dx / w) * (atEdge ? 25 : 100)) // rubber-band at the ends
  }

  const onTouchEnd = () => {
    if (touchStartX.current === null) return
    if (dragPct < -30) navTo(viewIdx + 1)
    else if (dragPct > 30) navTo(viewIdx - 1)
    else snapBack()
    touchStartX.current = null
  }

  if (loading) {
    return (
      <div className="py-8 flex justify-center text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  // The open action is pinned inside the active step view, not listed as a row
  const boardEntries = (stepId: string) =>
    entries.filter(e => e.step_id === stepId && e.id !== openAction?.id)

  // One full step view (header + dots + board). All steps stay mounted on
  // the track so mid-gesture DOM never changes — that's what kills drags.
  const renderStep = (i: number) => {
    const s = steps[i]
    if (!s) return null
    const isActive = s.id === currentStepId
    const isDone = !!s.completed_at && !isActive
    const stepEntries = boardEntries(s.id)

    return (
      <div key={s.id} className="w-full shrink-0 align-top px-4 md:px-6">
        {/* Step header panel — state shown by a left accent strip */}
        <div
          className={`rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-3 py-3 flex items-center gap-2 mb-2 border-l-[3px] ${
            isActive
              ? 'border-l-[hsl(var(--color-primary))]'
              : isDone
                ? 'border-l-green-500'
                : 'border-l-transparent'
          }`}
        >
          <button
            onClick={() => navTo(i - 1)}
            disabled={i === 0}
            className="w-9 h-9 rounded-lg bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-[hsl(var(--color-text-secondary))] disabled:opacity-30 shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--color-text-muted))]">
              Step {i + 1} of {steps.length}
            </p>
            <p className="text-base font-semibold text-[hsl(var(--color-text-primary))] truncate mt-0.5">
              {s.name}
            </p>
            <p className={`text-[11px] font-medium mt-0.5 ${
              isActive
                ? 'text-[hsl(var(--color-primary))]'
                : isDone
                  ? 'text-green-500'
                  : 'text-[hsl(var(--color-text-muted))]'
            }`}>
              {isActive ? 'Active' : isDone ? 'Completed' : 'Upcoming'}
              {!s.is_required ? ' · optional' : ''}
            </p>
          </div>
          <button
            onClick={() => navTo(i + 1)}
            disabled={i === steps.length - 1}
            className="w-9 h-9 rounded-lg bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-[hsl(var(--color-text-secondary))] disabled:opacity-30 shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Step position dots */}
        <div className="flex justify-center gap-1.5 mb-3">
          {steps.map((st, di) => (
            <button
              key={st.id}
              onClick={() => navTo(di)}
              className={`h-1.5 rounded-full transition-all ${
                di === i
                  ? 'w-5 bg-[hsl(var(--color-primary))]'
                  : st.completed_at && st.id !== currentStepId
                    ? 'w-1.5 bg-green-500/60'
                    : 'w-1.5 bg-[hsl(var(--color-surface-active))]'
              }`}
            />
          ))}
        </div>

        {/* Step content — sits directly on the page background */}
        <div className="space-y-3">
          {isActive && (
            <ActionPanel caseId={caseId} openAction={openAction} onChanged={load} />
          )}

          {!isActive && (
            <button
              onClick={() => handleMove(s.id)}
              className="w-full h-10 rounded-xl bg-[hsl(var(--color-primary))] text-white text-sm font-semibold active:bg-[hsl(var(--color-primary-hover))]"
            >
              Move to this step
            </button>
          )}

          {isActive && <EntryComposer caseId={caseId} onAdded={load} />}

          {stepEntries.length === 0 ? (
            <p className="text-xs text-[hsl(var(--color-text-muted))] py-6 text-center">
              Nothing logged in this step yet
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--color-border))]">
              {stepEntries.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  query={entry.query_id ? queries[entry.query_id] : undefined}
                  caseId={caseId}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={slideRef}
      className="space-y-3 min-h-[70dvh] [touch-action:pan-y]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={snapBack}
    >
      {steps.length === 0 ? (
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-secondary))] p-6 text-center">
          <p className="text-sm text-[hsl(var(--color-text-secondary))]">No steps on this case yet</p>
        </div>
      ) : (
        // Bleed to the screen edges; each panel carries the page padding
        // itself so neighbors never touch during the slide.
        <div className="-mx-4 md:-mx-6 overflow-hidden">
          <div
            className="flex items-start will-change-transform"
            style={{
              transform: `translateX(${-viewIdx * 100 + dragPct}%)`,
              transition: animating ? 'transform 200ms ease-out' : 'none',
            }}
          >
            {steps.map((_, i) => renderStep(i))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Current action panel — pinned inside the active step
// ============================================================
function ActionPanel({ caseId, openAction, onChanged }: {
  caseId: string
  openAction: CaseEntry | null
  onChanged: () => void
}) {
  const [modal, setModal] = useState<'set' | 'edit' | 'next' | null>(null)

  const isOverdue = openAction?.due_date &&
    new Date(openAction.due_date) < new Date(new Date().toDateString())

  return (
    <>
      {openAction ? (
        // --- Action set: centered row, tap to edit in a popup ---
        <button
          onClick={() => setModal('edit')}
          className={`w-full rounded-xl border border-[hsl(var(--color-border))] border-l-[3px] bg-[hsl(var(--color-surface))] px-4 py-3 flex flex-col items-center justify-center gap-0.5 text-center hover:bg-[hsl(var(--color-surface-hover))] active:bg-[hsl(var(--color-surface-hover))] transition-colors ${
            isOverdue ? 'border-l-red-500' : 'border-l-[hsl(var(--color-primary))]'
          }`}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--color-text-primary))] max-w-full">
            <Zap className={`w-4 h-4 shrink-0 ${isOverdue ? 'text-red-400' : 'text-[hsl(var(--color-primary))]'}`} />
            <span className="truncate">{openAction.body}</span>
          </span>
          <span className={`text-[11px] ${isOverdue ? 'text-red-400 font-semibold' : 'text-[hsl(var(--color-text-muted))]'}`}>
            {isOverdue ? 'Overdue' : `Due ${new Date(openAction.due_date!).toLocaleDateString()}`} · Tap to open
          </span>
        </button>
      ) : (
        // --- No action set: warning CTA, opens the set-action popup ---
        <button
          onClick={() => setModal('set')}
          className="w-full rounded-xl bg-amber-500 text-amber-950 py-2.5 flex flex-col items-center justify-center gap-0.5 hover:bg-amber-400 active:bg-amber-400 transition-colors"
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4" />
            No action set
          </span>
          <span className="text-[11px] font-medium text-amber-900/70">Tap to add</span>
        </button>
      )}

      <Modal isOpen={modal === 'set'} onClose={() => setModal(null)} title="Set the next action">
        <ActionForm
          caseId={caseId}
          submitLabel="Set action"
          skipLabel="Not now"
          onDone={() => { setModal(null); onChanged() }}
          onSkip={() => setModal(null)}
        />
      </Modal>

      <Modal isOpen={modal === 'edit' && !!openAction} onClose={() => setModal(null)} title="Current action">
        {openAction && (
          <ActionForm
            caseId={caseId}
            existing={openAction}
            submitLabel="Save"
            onDone={() => { setModal(null); onChanged() }}
            onComplete={async () => {
              await completeAction(openAction.id, caseId)
              onChanged()
              setModal('next')
            }}
          />
        )}
      </Modal>

      <Modal isOpen={modal === 'next'} onClose={() => setModal(null)} title="Done — what's next?">
        <ActionForm
          caseId={caseId}
          submitLabel="Set next action"
          skipLabel="Not now"
          onDone={() => { setModal(null); onChanged() }}
          onSkip={() => setModal(null)}
        />
      </Modal>
    </>
  )
}

function ActionForm({ caseId, existing, submitLabel, skipLabel = 'Skip', onDone, onSkip, onComplete }: {
  caseId: string
  existing?: CaseEntry
  submitLabel: string
  skipLabel?: string
  onDone: () => void
  onSkip?: () => void
  onComplete?: () => void
}) {
  const [body, setBody] = useState(existing?.body || '')
  const [dueDate, setDueDate] = useState(existing?.due_date || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    const result = existing
      ? await updateAction(existing.id, caseId, body, dueDate)
      : await createAction(caseId, body, dueDate)
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      onDone()
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1.5">Action</p>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="What needs to happen? e.g. Chase client for passport scans"
          className="w-full h-10 px-3 rounded-lg bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1.5">Deadline</p>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="h-10 px-3 rounded-lg bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))]"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !body.trim() || !dueDate}
          className="flex-1 h-9 rounded-lg bg-[hsl(var(--color-primary))] text-white text-sm font-semibold disabled:opacity-40 active:bg-[hsl(var(--color-primary-hover))]"
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onComplete && (
          <button
            onClick={onComplete}
            className="h-9 px-3 rounded-lg bg-green-600 text-white text-sm font-semibold active:bg-green-700"
          >
            Complete
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="px-4 h-9 rounded-lg bg-[hsl(var(--color-surface-active))] text-sm text-[hsl(var(--color-text-secondary))]"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Entry composer (active step only) — note or query
// ============================================================
function EntryComposer({ caseId, onAdded }: { caseId: string; onAdded: () => void }) {
  const [kind, setKind] = useState<'note' | 'query' | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = (k: 'note' | 'query') => { setKind(k); setText(''); setError(null) }
  const close = () => { setKind(null); setText(''); setError(null) }

  const submit = async () => {
    if (!text.trim() || !kind) return
    setSaving(true)
    setError(null)
    const result = kind === 'note'
      ? await addNote(caseId, text)
      : await openQuery(caseId, text)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    close()
    onAdded()
  }

  return (
    <div className="py-1">
      <div className="flex gap-2">
        <button
          onClick={() => open('note')}
          className="flex-1 h-10 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-border))]"
        >
          <StickyNote className="w-4 h-4" />
          Note
        </button>
        <button
          onClick={() => open('query')}
          className="flex-1 h-10 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-[hsl(var(--color-primary))] text-white hover:bg-[hsl(var(--color-primary-hover))]"
        >
          <MessageSquare className="w-4 h-4" />
          Query
        </button>
      </div>
      <Modal isOpen={kind !== null} onClose={close} title={kind === 'note' ? 'Add note' : 'New query'}>
        <div className="space-y-4">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            autoFocus={isDesktopViewport()}
            placeholder={
              kind === 'note'
                ? 'Write a note for this step…'
                : 'Ask the other side something…'
            }
            className="w-full px-3 py-2.5 rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none resize-y min-h-[100px]"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !text.trim()}>
              {saving ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ============================================================
// Board entry rows — one-line previews that open the entry page
// ============================================================
function EntryRow({ entry, query, caseId }: {
  entry: CaseEntry
  query?: CaseQuery
  caseId: string
}) {
  const link = usePaneLink(`/cases/${caseId}/progress/${entry.id}`)
  const author = entry.author?.display_name || entry.author?.email?.split('@')[0] || 'Someone'
  const date = new Date(entry.created_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  })

  const isQuery = entry.kind === 'query' && entry.query_id
  const isAction = entry.kind === 'action'
  const done = !!entry.completed_at
  const queryStatus = query?.status

  const statusBadge = queryStatus ? {
    open: { label: 'Open', cls: 'text-blue-400 bg-blue-400/10' },
    answered: { label: 'Answered', cls: 'text-amber-400 bg-amber-400/10' },
    closed: { label: 'Closed', cls: 'text-[hsl(var(--color-text-muted))] bg-[hsl(var(--color-surface-active))]' },
  }[queryStatus] : null

  const Icon = isQuery ? MessageSquare : isAction ? Zap : StickyNote
  const chipCls = isQuery
    ? (queryStatus === 'closed'
        ? 'bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-muted))]'
        : 'bg-blue-400/15 text-blue-400')
    : isAction
      ? (done ? 'bg-green-500/15 text-green-500' : 'bg-orange-500/15 text-orange-400')
      : 'bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-muted))]'

  return (
    <li>
      <Link {...link} className={`py-2.5 flex items-center gap-2.5 active:bg-[hsl(var(--color-surface-hover))] -mx-2 px-2 rounded-lg ${isQuery && queryStatus !== 'closed' ? 'bg-blue-400/5' : ''}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${chipCls}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${isQuery && queryStatus === 'closed' ? 'text-[hsl(var(--color-text-secondary))]' : 'text-[hsl(var(--color-text-primary))] font-medium'}`}>
            {entry.body}
          </p>
          <p className="text-xs text-[hsl(var(--color-text-muted))] mt-0.5 truncate">
            {author} · {date}
            {isAction && entry.due_date && ` · due ${new Date(entry.due_date).toLocaleDateString()}`}
            {isAction && done && ` · done ${new Date(entry.completed_at!).toLocaleDateString()}`}
            {isQuery && (query?.direction === 'legal_to_csr' ? ' · Legal → CSR' : ' · CSR → Legal')}
          </p>
        </div>
        {statusBadge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-[hsl(var(--color-text-muted))] shrink-0" />
      </Link>
    </li>
  )
}


