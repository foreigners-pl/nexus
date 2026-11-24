'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef, type RefObject, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getCaseWorkflow,
  moveToStep,
  type CaseStep,
  type CaseEntry,
  type CaseQuery,
  type CaseEligibilityState,
  type ServiceEligibilityItem,
} from '@/app/actions/workflow'
import {
  postStepMessage,
  sendStepRequest,
  answerStepRequest,
  markRequestSeen,
  cancelStepRequest,
} from '@/app/actions/feed'
import { saveAttachment, getAttachmentUrl } from '@/app/actions/attachments'
import { createClient } from '@/lib/supabase/client'
import { usePaneNavigate } from '@/lib/panes'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import { fetchCaseWorkflow } from '@/lib/data'
import {
  ChevronRight,
  ChevronLeft,
  Zap,
  ShieldCheck,
  FileSignature,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  MessageSquare,
  CornerDownRight,
  X,
  Paperclip as PaperclipIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface StepsPanelProps {
  caseId: string
  /** Step to land on — passed by the page because pane renders can't read
   *  the base URL's search params via useSearchParams. */
  focusStepId?: string | null
}

export function StepsPanel({ caseId, focusStepId: focusStepIdProp }: StepsPanelProps) {
  const [steps, setSteps] = useState<CaseStep[]>([])
  const [entries, setEntries] = useState<CaseEntry[]>([])
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const [openAction, setOpenAction] = useState<CaseEntry | null>(null)
  const [queries, setQueries] = useState<Record<string, CaseQuery>>({})
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [eligibility, setEligibility] = useState<CaseEligibilityState>({ statusCompleted: false, documentsCompleted: false, statusAt: null, documentsAt: null })
  const [eligibilityItems, setEligibilityItems] = useState<ServiceEligibilityItem[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [csrId, setCsrId] = useState<string | null>(null)
  const [legalId, setLegalId] = useState<string | null>(null)
  const [attachmentsByEntry, setAttachmentsByEntry] = useState<Record<string, FeedAttachment[]>>({})
  const [usersById, setUsersById] = useState<Record<string, { display_name: string | null; email: string }>>({})
  const [viewIdx, setViewIdx] = useState(0)
  const [dragPct, setDragPct] = useState(0)
  const [animating, setAnimating] = useState(false)
  const didInit = useRef(false)
  const touchStartX = useRef<number | null>(null)
  const slideRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const paneNav = usePaneNavigate()
  const router = useRouter()
  const searchParams = useSearchParams()
  const focusStepId = focusStepIdProp ?? searchParams.get('s')

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.workflow(caseId),
    queryFn: () => fetchCaseWorkflow(caseId),
    staleTime: 0,
  })

  const applyData = useCallback((data: Awaited<ReturnType<typeof getCaseWorkflow>>) => {
    setSteps(data.steps)
    setEntries(data.entries)
    setQueries(data.queries)
    setCurrentStepId(data.currentStepId)
    setOpenAction(data.openAction)
    setServiceId(data.serviceId)
    setEligibility(data.eligibility)
    setEligibilityItems(data.eligibilityItems)
    setMeId(data.meId)
    setCsrId((data as any).csrId ?? null)
    setLegalId((data as any).legalId ?? null)
    setAttachmentsByEntry((data as any).attachmentsByEntry || {})
    setUsersById((data as any).usersById || {})
    if (!didInit.current) {
      // Deep-linked step (e.g. ?s=<step_id> from an action row) wins over current step
      const focusIdx = focusStepId ? data.steps.findIndex(s => s.id === focusStepId) : -1
      const idx = focusIdx >= 0 ? focusIdx : data.steps.findIndex(s => s.id === data.currentStepId)
      setViewIdx(idx >= 0 ? idx : 0)
      didInit.current = true
    }
  }, [focusStepId])

  useEffect(() => {
    if (data) applyData(data)
  }, [data, applyData])

  useEffect(() => {
    if (data) {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests })
      queryClient.invalidateQueries({ queryKey: queryKeys.myActions })
    }
  }, [data, queryClient])

  // Re-navigation to a different ?s= after first mount (mobile keeps the
  // page mounted) — jump the carousel to that step.
  useEffect(() => {
    if (!focusStepId || !didInit.current) return
    const idx = steps.findIndex(s => s.id === focusStepId)
    if (idx >= 0 && idx !== viewIdx) navTo(idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusStepId])

  // Swiping to another step drops any in-progress message selection — the
  // select state belongs to the step it was started on.
  useEffect(() => {
    setSelect(null)
    setSelectedIds(new Set())
  }, [viewIdx])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workflow(caseId) })
  }

  // ---- Shared feed composer + request-select state ----
  // Lives here (not inside each step panel) because the mobile composer is a
  // fixed overlay rendered outside the swipe track — the track's transform
  // would hijack position:fixed inside it.
  const [feedText, setFeedText] = useState('')
  const [staged, setStaged] = useState<{ id: string; name: string }[]>([])
  const [feedBusy, setFeedBusy] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [select, setSelect] = useState<null | { mode: 'request' | 'answer'; stepId: string; queryId?: string }>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshAll = () => {
    refresh()
    queryClient.invalidateQueries({ queryKey: queryKeys.requests })
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setFeedBusy(true)
    setFeedError(null)
    const supabase = createClient()
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${caseId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
      const { data: up, error: upErr } = await supabase.storage
        .from('case_attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) { setFeedError(`Upload failed: ${file.name}`); continue }
      const res = await saveAttachment(caseId, {
        file_name: file.name,
        file_path: up.path,
        file_size: file.size,
        file_type: file.type,
      })
      const savedId = (res as { data?: { id?: string } }).data?.id
      if (savedId) setStaged(s => [...s, { id: savedId, name: file.name }])
      else setFeedError(`Upload failed: ${file.name}`)
    }
    setFeedBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const sendFeedMessage = async (stepId: string) => {
    if (feedBusy || (!feedText.trim() && staged.length === 0)) return
    // Optimistic — the message renders immediately; the server action and
    // refetch confirm it in the background. Rolled back on failure.
    const text = feedText
    const files = staged
    const tempId = `temp-${Date.now()}`
    const optimistic: CaseEntry = {
      id: tempId,
      case_id: caseId,
      step_id: stepId,
      kind: 'note',
      body: text.trim() || null,
      created_by: meId,
      created_at: new Date().toISOString(),
      due_date: null,
      waiting_on: null,
      completed_at: null,
      completed_by: null,
      query_id: null,
      request_part: null,
      author: meId ? usersById[meId] ?? { display_name: 'Me', email: '' } : null,
    }
    setEntries(prev => [...prev, optimistic])
    if (files.length) {
      setAttachmentsByEntry(prev => ({
        ...prev,
        [tempId]: files.map(f => ({ id: f.id, file_name: f.name, file_path: '', file_type: null, file_size: null })),
      }))
    }
    setFeedText('')
    setStaged([])
    setFeedError(null)
    setFeedBusy(true)
    const r = await postStepMessage(caseId, stepId, text, files.map(f => f.id))
    setFeedBusy(false)
    if (r.error) {
      setEntries(prev => prev.filter(e => e.id !== tempId))
      setAttachmentsByEntry(prev => { const n = { ...prev }; delete n[tempId]; return n })
      setFeedText(text)
      setStaged(files)
      setFeedError(r.error)
      return
    }
    refreshAll()
  }

  const startSelect = (mode: 'request' | 'answer', stepId: string, queryId?: string) => {
    setSelect({ mode, stepId, queryId })
    setSelectedIds(new Set())
  }

  const cancelSelect = () => {
    setSelect(null)
    setSelectedIds(new Set())
  }

  const toggleSelectEntry = (entryId: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(entryId)) n.delete(entryId)
      else n.add(entryId)
      return n
    })
  }

  // Query/entry mutations apply locally first (the UI flips instantly),
  // then the server action confirms in the background. On failure the
  // snapshots are restored and the error surfaces in the composer.
  const patchEntries = (ids: string[], patch: Partial<CaseEntry>) => {
    const before = new Map(entries.filter(e => ids.includes(e.id)).map(e => [e.id, e]))
    setEntries(entries.map(e => (ids.includes(e.id) ? { ...e, ...patch } : e)))
    return before
  }

  const confirmSelect = async () => {
    if (!select || selectedIds.size === 0) return
    const mode = select.mode
    const stepId = select.stepId
    const queryId = select.queryId
    const ids = [...selectedIds]
    const now = new Date().toISOString()
    const tempQueryId = `temp-q-${Date.now()}`
    setFeedError(null)

    let prevEntries: Map<string, CaseEntry>
    let prevQuery: CaseQuery | undefined
    if (mode === 'request') {
      const isCsr = meId === csrId
      const optimisticQuery: CaseQuery = {
        id: tempQueryId,
        case_id: caseId,
        step_id: stepId,
        opened_by: meId,
        assigned_to: isCsr ? legalId : csrId,
        direction: isCsr ? 'csr_to_legal' : 'legal_to_csr',
        status: 'open',
        created_at: now,
        closed_at: null,
        answered_at: null,
        answered_by: null,
        seen_at: null,
        seen_by: null,
      }
      prevEntries = patchEntries(ids, { request_part: 'question', query_id: tempQueryId })
      setQueries(q => ({ ...q, [tempQueryId]: optimisticQuery }))
    } else {
      prevQuery = queries[queryId!]
      prevEntries = patchEntries(ids, { request_part: 'answer', query_id: queryId })
      if (prevQuery) {
        setQueries(q => ({ ...q, [queryId!]: { ...prevQuery!, status: 'answered', answered_at: now, answered_by: meId } }))
      }
    }
    cancelSelect()

    const r = mode === 'request'
      ? await sendStepRequest(caseId, stepId, ids)
      : await answerStepRequest(queryId!, ids)

    if (r.error) {
      setEntries(prev => prev.map(e => prevEntries.get(e.id) ?? e))
      if (mode === 'request') {
        setQueries(q => { const n = { ...q }; delete n[tempQueryId]; return n })
      } else if (prevQuery) {
        setQueries(q => ({ ...q, [queryId!]: prevQuery! }))
      }
      setFeedError(r.error)
      return
    }
    // Swap the temp query for the real id so highlights stay wired until refetch
    if (mode === 'request' && 'queryId' in r && r.queryId) {
      setQueries(q => {
        const temp = q[tempQueryId]
        if (!temp) return q
        const n = { ...q }
        delete n[tempQueryId]
        n[r.queryId as string] = { ...temp, id: r.queryId as string }
        return n
      })
      setEntries(prev => prev.map(e => (e.query_id === tempQueryId ? { ...e, query_id: r.queryId as string } : e)))
    }
    refreshAll()
  }

  const markSeen = async (queryId: string) => {
    const prev = queries[queryId]
    if (!prev) return
    const now = new Date().toISOString()
    setQueries(q => ({ ...q, [queryId]: { ...prev, status: 'closed', seen_at: now, seen_by: meId, closed_at: now } }))
    const r = await markRequestSeen(queryId)
    if (r.error) {
      setQueries(q => ({ ...q, [queryId]: prev }))
      setFeedError(r.error)
      return
    }
    refreshAll()
  }

  const cancelRequest = async (queryId: string) => {
    const prev = queries[queryId]
    if (!prev) return
    setQueries(q => ({ ...q, [queryId]: { ...prev, status: 'cancelled', closed_at: new Date().toISOString() } }))
    const r = await cancelStepRequest(queryId)
    if (r.error) {
      setQueries(q => ({ ...q, [queryId]: prev }))
      setFeedError(r.error)
      return
    }
    refreshAll()
  }

  const handleMove = async (stepId: string) => {
    await moveToStep(caseId, stepId)
    refresh()
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

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 space-y-3 animate-pulse">
        <div className="h-12 rounded-xl bg-[hsl(var(--color-surface-hover))]" />
        <div className="flex gap-1.5 justify-center py-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-[hsl(var(--color-surface-hover))]" />
          ))}
        </div>
        <div className="h-24 rounded-xl bg-[hsl(var(--color-surface-hover))]" />
        <div className="h-16 rounded-xl bg-[hsl(var(--color-surface-hover))]" />
        <div className="h-16 rounded-xl bg-[hsl(var(--color-surface-hover))]" />
      </div>
    )
  }

  if (queryError) {
    return (
      <div className="px-4 md:px-6 py-8 text-center text-red-400">
        Failed to load workflow.
        <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-2">{queryError.message}</p>
      </div>
    )
  }

  const nameOf = (id?: string | null) => {
    if (!id) return 'Someone'
    const u = usersById[id]
    return u?.display_name || u?.email?.split('@')[0] || 'Someone'
  }

  // One chronological feed per step: plain messages (old notes, request
  // messages) + thin event lines for request lifecycle and action set/done.
  const feedFor = (stepId: string): FeedItem[] => {
    const items: FeedItem[] = []
    for (const e of entries.filter(e => e.step_id === stepId)) {
      if (e.kind === 'action') {
        items.push({ kind: 'event', at: e.created_at, key: `a-${e.id}`, icon: 'action', text: `${nameOf(e.created_by)} set an action` })
        if (e.completed_at) {
          items.push({ kind: 'event', at: e.completed_at, key: `ad-${e.id}`, icon: 'done', text: `${nameOf(e.completed_by)} completed an action` })
        }
      } else if (e.kind === 'system') {
        items.push({ kind: 'event', at: e.created_at, key: `s-${e.id}`, icon: 'system', text: `${nameOf(e.created_by)} ${e.body}` })
      } else {
        items.push({ kind: 'msg', at: e.created_at, key: e.id, entry: e })
      }
    }
    for (const q of Object.values(queries).filter(q => q.step_id === stepId)) {
      items.push({ kind: 'event', at: q.created_at, key: `q-${q.id}`, icon: 'request', text: `${nameOf(q.opened_by)} sent a request` })
      if (q.answered_at) items.push({ kind: 'event', at: q.answered_at, key: `qa-${q.id}`, icon: 'answer', text: `${nameOf(q.answered_by)} answered the request` })
      if (q.seen_at) items.push({ kind: 'event', at: q.seen_at, key: `qs-${q.id}`, icon: 'seen', text: `${nameOf(q.seen_by)} marked the request seen` })
      if (q.status === 'cancelled' && q.closed_at) items.push({ kind: 'event', at: q.closed_at, key: `qc-${q.id}`, icon: 'cancel', text: `${nameOf(q.opened_by)} cancelled the request` })
    }
    // Newest first — the feed reads top-down like an activity stream
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }

  const viewedStep = steps[viewIdx]

  const composerProps = {
    text: feedText,
    setText: setFeedText,
    staged,
    onRemoveStaged: (id: string) => setStaged(s => s.filter(x => x.id !== id)),
    busy: feedBusy,
    error: feedError,
    fileRef,
    onUpload: uploadFiles,
    select,
    selectedCount: selectedIds.size,
    onCancelSelect: cancelSelect,
    onConfirmSelect: confirmSelect,
  }

  // One full step view (header + dots + board). All steps stay mounted on
  // the track so mid-gesture DOM never changes — that's what kills drags.
  const renderStep = (i: number) => {
    const s = steps[i]
    if (!s) return null
    const isActive = s.id === currentStepId
    const isDone = !!s.completed_at && !isActive
    const feed = feedFor(s.id)

    return (
      <div key={s.id} data-step-panel className="w-full shrink-0 align-top px-4 md:px-6">
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
            className="w-9 h-9 rounded-xl bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-[hsl(var(--color-text-secondary))] disabled:opacity-30 shrink-0"
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
            className="w-9 h-9 rounded-xl bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-[hsl(var(--color-text-secondary))] disabled:opacity-30 shrink-0"
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
          {isActive && s.step_type !== 'eligibility' && s.step_type !== 'presale' && (
            <button
              onClick={() => { if (!paneNav(`/cases/${caseId}/actions`)) router.push(`/cases/${caseId}/actions`) }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
            >
              <Zap className="w-4 h-4 text-[hsl(var(--color-primary))]" />
              Actions
              {openAction && (
                <span className="text-xs text-[hsl(var(--color-text-muted))]">
                  · {openAction.body}
                </span>
              )}
            </button>
          )}

          {!isActive && (
            <Button
              onClick={() => handleMove(s.id)}
              disabled={s.step_type === 'presale' && eligibilityItems.length > 0 && (!eligibility.statusCompleted || !eligibility.documentsCompleted)}
              className="w-full"
            >
              {s.step_type === 'presale' && eligibilityItems.length > 0 && (!eligibility.statusCompleted || !eligibility.documentsCompleted)
                ? 'Complete eligibility first'
                : 'Move to this step'}
            </Button>
          )}

          {s.step_type === 'presale' && (
            <button
              onClick={() => { if (!paneNav(`/cases/${caseId}/agreement`)) router.push(`/cases/${caseId}/agreement`) }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--color-text-primary))] hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
            >
              <FileSignature className="w-4 h-4" />
              Service agreement
            </button>
          )}

          {s.step_type === 'eligibility' && (
            <EligibilityButton caseId={caseId} eligibility={eligibility} inactive={!isActive} />
          )}

          <StepFeed
            stepId={s.id}
            canPost={isActive}
            feed={feed}
            queries={queries}
            meId={meId}
            csrId={csrId}
            legalId={legalId}
            attachmentsByEntry={attachmentsByEntry}
            select={select && select.stepId === s.id ? select : null}
            selectedIds={selectedIds}
            busy={feedBusy}
            onToggleEntry={toggleSelectEntry}
            onStartSelect={(mode, queryId) => startSelect(mode, s.id, queryId)}
            onMarkSeen={markSeen}
            onCancelRequest={cancelRequest}
            composer={<FeedComposer stepId={s.id} {...composerProps} onSend={() => sendFeedMessage(s.id)} />}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={slideRef}
      className="space-y-3 [touch-action:pan-y]"
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
        <div className="-mx-4 md:-mx-6 overflow-x-clip">
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

      {/* Mobile composer — fixed above the tab bar like the nav overlay,
          bound to the viewed step. Outside the transform track so it never
          rides along with a swipe. */}
      {viewedStep && viewedStep.id === currentStepId && (
        <div
          data-step-composer
          onTouchStart={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
          className="md:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-4 py-2.5 bg-[hsl(var(--color-background))]"
        >
          <FeedComposer stepId={viewedStep.id} {...composerProps} onSend={() => sendFeedMessage(viewedStep.id)} />
        </div>
      )}
    </div>
  )
}

// ============================================================
// Eligibility — one button into the combined confirm page
// ============================================================
function EligibilityButton({ caseId, eligibility, inactive = false }: {
  caseId: string
  eligibility: CaseEligibilityState
  inactive?: boolean
}) {
  const paneNav = usePaneNavigate()
  const doneCount = (eligibility.statusCompleted ? 1 : 0) + (eligibility.documentsCompleted ? 1 : 0)
  const done = doneCount === 2
  const href = `/cases/${caseId}/eligibility`

  const content = (
    <>
      <ShieldCheck className={`w-5 h-5 shrink-0 ${done ? 'text-green-500' : 'text-red-400'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Confirm eligibility</p>
        <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate mt-0.5">
          {done ? 'Status + documents confirmed' : doneCount === 0 ? 'Status + documents' : '1 of 2 confirmed'}
        </p>
      </div>
      {done ? (
        <span className="text-xs font-medium text-green-400">Done</span>
      ) : (
        <ChevronRight className="w-5 h-5 text-[hsl(var(--color-text-muted))] shrink-0" />
      )}
    </>
  )

  const cls = `flex items-center gap-3 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3.5 ${inactive ? 'opacity-70' : ''}`
  return inactive ? (
    <div className={cls}>{content}</div>
  ) : (
    <Link
      href={href}
      onClick={(e) => { if (paneNav(href)) e.preventDefault() }}
      className={`${cls} hover:bg-[hsl(var(--color-surface-hover))] transition-colors`}
    >
      {content}
    </Link>
  )
}

// ============================================================
// Step feed — messages + thin event lines + composer + requests
// ============================================================
interface FeedAttachment {
  id: string
  file_name: string
  file_path: string
  file_type: string | null
  file_size: number | null
}

type FeedItem =
  | { kind: 'msg'; at: string; key: string; entry: CaseEntry }
  | { kind: 'event'; at: string; key: string; icon: 'request' | 'answer' | 'seen' | 'action' | 'done' | 'cancel' | 'system'; text: string }

const EVENT_META = {
  request: { Icon: MessageSquare, cls: 'text-amber-400' },
  answer: { Icon: CornerDownRight, cls: 'text-green-400' },
  seen: { Icon: CheckCheck, cls: 'text-[hsl(var(--color-text-muted))]' },
  action: { Icon: Zap, cls: 'text-[hsl(var(--color-primary))]' },
  done: { Icon: CheckCheck, cls: 'text-green-500' },
  cancel: { Icon: X, cls: 'text-red-400' },
  system: { Icon: Check, cls: 'text-[hsl(var(--color-text-muted))]' },
} as const

function EventLine({ icon, text, at }: { icon: keyof typeof EVENT_META; text: string; at: string }) {
  const { Icon, cls } = EVENT_META[icon]
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-[hsl(var(--color-border))]" />
      <Icon className={`w-3 h-3 shrink-0 ${cls}`} />
      <p className="text-[11px] text-[hsl(var(--color-text-muted))] whitespace-nowrap">
        {text} · {new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </p>
      <div className="h-px flex-1 bg-[hsl(var(--color-border))]" />
    </div>
  )
}

function FeedMessage({ entry, query, attachments, mine, right, selectMode, selected, onToggle }: {
  entry: CaseEntry
  query?: CaseQuery
  attachments: FeedAttachment[]
  mine: boolean
  right: boolean
  selectMode: boolean
  selected: boolean
  onToggle: () => void
}) {
  const author = entry.author?.display_name || entry.author?.email?.split('@')[0] || 'Someone'
  const isQuestion = entry.request_part === 'question'
  const isAnswer = entry.request_part === 'answer'
  const live = !!query && (query.status === 'open' || query.status === 'answered')

  const openFile = async (a: FeedAttachment) => {
    const url = await getAttachmentUrl(a.file_path)
    if (url) window.open(url, '_blank')
  }

  return (
    <div className={`flex ${right ? 'justify-end' : 'justify-start'}`}>
    <div
      onClick={selectMode && mine ? onToggle : undefined}
      className={`rounded-xl border px-3.5 py-2.5 transition-colors max-w-[85%] ${
        isQuestion && live
          ? 'border-amber-400/60 bg-amber-400/5'
          : isAnswer && live
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]'
      } ${selectMode ? (mine ? 'cursor-pointer' : 'opacity-50') : ''} ${
        selected ? 'ring-2 ring-[hsl(var(--color-primary))]' : ''
      }`}
    >
      <div className={`flex items-baseline gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <p className="text-xs font-semibold text-[hsl(var(--color-text-primary))]">{author}</p>
        <p className="text-[10px] text-[hsl(var(--color-text-muted))]">
          {new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
        <span className={`${right ? 'mr-auto' : 'ml-auto'} flex items-center gap-1.5 shrink-0`}>
          {isQuestion && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              live ? 'bg-amber-400/15 text-amber-400' : 'bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-muted))]'
            }`}>
              Requested
            </span>
          )}
          {isAnswer && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              live ? 'bg-green-500/15 text-green-400' : 'bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-muted))]'
            }`}>
              Answer
            </span>
          )}
          {selectMode && mine && (
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selected ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]' : 'border-[hsl(var(--color-text-muted))]'
            }`}>
              {selected && <Check className="w-3 h-3 text-white" />}
            </span>
          )}
        </span>
      </div>
      {entry.body && (
        <p className="text-sm text-[hsl(var(--color-text-primary))] whitespace-pre-wrap mt-1">{entry.body}</p>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {attachments.map(a => (
            <button
              key={a.id}
              onClick={(e) => { e.stopPropagation(); openFile(a) }}
              className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--color-surface-active))] px-2.5 py-1.5 text-xs text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))] transition-colors"
            >
              <PaperclipIcon className="w-3 h-3" />
              <span className="max-w-[180px] truncate">{a.file_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}

function StepFeed({ stepId, canPost, feed, queries, meId, csrId, legalId, attachmentsByEntry, select, selectedIds, busy, onToggleEntry, onStartSelect, onMarkSeen, onCancelRequest, composer }: {
  stepId: string
  canPost: boolean
  feed: FeedItem[]
  queries: Record<string, CaseQuery>
  meId: string | null
  csrId: string | null
  legalId: string | null
  attachmentsByEntry: Record<string, FeedAttachment[]>
  select: { mode: 'request' | 'answer'; stepId: string; queryId?: string } | null
  selectedIds: Set<string>
  busy: boolean
  onToggleEntry: (entryId: string) => void
  onStartSelect: (mode: 'request' | 'answer', queryId?: string) => void
  onMarkSeen: (queryId: string) => void
  onCancelRequest: (queryId: string) => void
  composer: ReactNode
}) {
  const stepQueries = Object.values(queries).filter(q => q.step_id === stepId)
  const myOpen = stepQueries.find(q => q.opened_by === meId && q.status === 'open')
  const myAnswered = stepQueries.find(q => q.opened_by === meId && q.status === 'answered' && !q.seen_at)
  const toAnswer = stepQueries.find(q => q.assigned_to === meId && q.status === 'open')

  // Bubble side: participants see their own messages right / others left.
  // An uninvolved viewer (admin etc.) sees CSR left, legal right.
  const viewerIsParty = meId === csrId || meId === legalId
  const alignRight = (authorId: string | null) =>
    authorId === meId || (!viewerIsParty && authorId === legalId)

  // Fill the space down to the pinned composer so the message column can
  // anchor to the bottom of it — last message hugs the input, empty space
  // collects at the top of the chat area. Mobile measures against the fixed
  // overlay + document scroll; desktop against the sticky composer inside
  // the pane's own scroll column. Measured before paint.
  const regionRef = useRef<HTMLDivElement>(null)
  const tailRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const [regionH, setRegionH] = useState<number | null>(null)
  const [tailH, setTailH] = useState(44)
  useLayoutEffect(() => {
    const measure = () => {
      const el = regionRef.current
      if (!el) { setRegionH(null); return }
      if (window.innerWidth >= 768) {
        const composer = composerRef.current
        const scroller = el.closest('.overflow-y-auto') as HTMLElement | null
        if (!composer || !scroller) { setRegionH(null); return }
        const sRect = scroller.getBoundingClientRect()
        const docTop = el.getBoundingClientRect().top - sRect.top + scroller.scrollTop
        // The sticky composer rests 24px (pane bottom padding) above the
        // scrollport's bottom edge — fill the region so its bottom lands
        // on the composer's natural top. Longer feeds already exceed this,
        // so min-height is a no-op for them.
        const target = scroller.clientHeight - 24 - composer.getBoundingClientRect().height
        setRegionH(Math.max(target - docTop, 160))
        return
      }
      const composer = document.querySelector<HTMLElement>('[data-step-composer]')
      if (!composer) return // overlay mounts in the same commit; next render re-measures
      const composerTop = composer.getBoundingClientRect().top
      const docTop = el.getBoundingClientRect().top + window.scrollY
      // Fill so the region's bottom edge lands exactly on the composer's
      // top edge (auto-handles composer height + safe-area inset).
      // composerTop is viewport-space, docTop document-space — no scrollY
      // on composerTop or the region overshoots by the scroll position.
      setRegionH(Math.max(composerTop - docTop, 160))
      // Tail below the region = the composer's occluded zone, so the
      // anchored bottom lands flush on it and the last message can scroll
      // clear. Below-space is measured inside THIS step's panel only —
      // document.scrollHeight would be contaminated by sibling panels in
      // the swipe track. 80 = the page-level bottom padding.
      const docBottom = el.getBoundingClientRect().bottom + window.scrollY
      const panel = el.closest('[data-step-panel]')
      const panelBottom = (panel?.getBoundingClientRect().bottom ?? el.getBoundingClientRect().bottom) + window.scrollY
      const belowWithoutTail = panelBottom - docBottom - (tailRef.current?.offsetHeight ?? 0) + 80
      setTailH(Math.max(window.innerHeight - composerTop - belowWithoutTail, 0))
    }
    measure()
    window.addEventListener('resize', measure)
    // Composer height changes (textarea growth, staged files, errors) don't
    // change the deps below — watch it directly so the fill re-measures.
    const ro = new ResizeObserver(measure)
    if (composerRef.current) ro.observe(composerRef.current)
    const overlay = document.querySelector<HTMLElement>('[data-step-composer]')
    if (overlay) ro.observe(overlay)
    return () => { window.removeEventListener('resize', measure); ro.disconnect() }
    // Deps, not every-render: a setState here must not be able to retrigger
    // the effect (infinite-loop guard). Re-measure when the feed grows or
    // the composer/request-slot above can change height.
  }, [canPost, feed.length, select !== null, queries])

  const feedList = feed.length === 0 ? (
    <p className="text-xs text-[hsl(var(--color-text-muted))] py-6 text-center">
      No messages in this step yet
    </p>
  ) : (
    <div className="space-y-2">
      {feed.map(item => item.kind === 'event' ? (
        <EventLine key={item.key} icon={item.icon} text={item.text} at={item.at} />
      ) : (
        <FeedMessage
          key={item.key}
          entry={item.entry}
          query={item.entry.query_id ? queries[item.entry.query_id] : undefined}
          attachments={attachmentsByEntry[item.entry.id] || []}
          mine={item.entry.created_by === meId}
          right={alignRight(item.entry.created_by)}
          selectMode={select !== null}
          selected={selectedIds.has(item.entry.id)}
          onToggle={() => onToggleEntry(item.entry.id)}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-2.5">
      {/* Request slot — above the feed. Send → waiting → mark seen, per step */}
      {canPost && !select && (
        <div className="space-y-2">
          {myAnswered ? (
            <Button onClick={() => onMarkSeen(myAnswered.id)} disabled={busy} className="w-full gap-2 bg-green-600 hover:bg-green-700">
              <CheckCheck className="w-4 h-4" />
              Mark as seen
            </Button>
          ) : myOpen ? (
            <div className="flex gap-2">
              <Button variant="secondary" disabled className="flex-1">
                Request sent — waiting
              </Button>
              <Button variant="ghost" onClick={() => onCancelRequest(myOpen.id)} disabled={busy} className="text-red-400 hover:text-red-300">
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => onStartSelect('request')} className="w-full gap-2">
              <MessageSquare className="w-4 h-4" />
              Send Request
            </Button>
          )}
          {toAnswer && (
            <Button onClick={() => onStartSelect('answer', toAnswer.id)} className="w-full gap-2">
              <CornerDownRight className="w-4 h-4" />
              Close request
            </Button>
          )}
        </div>
      )}

      {/* Feed — newest first. Fills down to the pinned composer and anchors
          messages to its bottom (last message hugs the input), but scrolls
          with the page/pane — no separate scroll region. */}
      {canPost ? (
        <div
          ref={regionRef}
          style={regionH ? { minHeight: regionH } : undefined}
          className="flex flex-col"
        >
          <div className="mt-auto">{feedList}</div>
        </div>
      ) : feedList}

      {/* Tail below the feed — sized so everything below the region equals
          the zone the fixed composer covers; the anchored bottom lands
          flush on the input and the last message can scroll clear */}
      {canPost && <div ref={tailRef} className="md:hidden" style={{ height: tailH }} />}

      {/* Composer — desktop only; mobile uses the fixed overlay at the
          panel root. Sticky to the pane's scroll bottom: pinned while
          scrolling, in-flow at rest so the last message always scrolls
          clear. Full-bleed bg so messages don't peek past it. */}
      {canPost && (
        <div
          ref={composerRef}
          className="hidden md:block sticky bottom-0 z-10 -mx-6 px-6 pt-2 pb-6 bg-[hsl(var(--color-background))]"
        >
          {composer}
        </div>
      )}
    </div>
  )
}

// Shared composer body — rendered inside the mobile fixed overlay and in
// the desktop sticky slot. Switches to select-mode controls when the owner
// step is picking request/answer messages.
function FeedComposer({ stepId, text, setText, staged, onRemoveStaged, busy, error, fileRef, onUpload, onSend, select, selectedCount, onCancelSelect, onConfirmSelect }: {
  stepId: string
  text: string
  setText: (v: string) => void
  staged: { id: string; name: string }[]
  onRemoveStaged: (id: string) => void
  busy: boolean
  error: string | null
  fileRef: RefObject<HTMLInputElement | null>
  onUpload: (files: FileList | null) => void
  onSend: () => void
  select: { mode: 'request' | 'answer'; stepId: string; queryId?: string } | null
  selectedCount: number
  onCancelSelect: () => void
  onConfirmSelect: () => void
}) {
  const selecting = !!select && select.stepId === stepId
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Grow the field with content up to ~4 lines, then scroll inside it.
  useEffect(() => {
    const t = textRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 110)}px`
  }, [text])

  if (selecting) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-[hsl(var(--color-text-secondary))]">
          {select!.mode === 'request'
            ? 'Tap your messages to highlight what this request is about'
            : 'Tap your messages that answer this request'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancelSelect} disabled={busy} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirmSelect} disabled={busy || selectedCount === 0} className="flex-1">
            {select!.mode === 'request'
              ? `Send Request${selectedCount ? ` (${selectedCount})` : ''}`
              : `Close Request${selectedCount ? ` (${selectedCount})` : ''}`}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-400 px-1">{error}</p>}
      {staged.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {staged.map(f => (
            <span key={f.id} className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--color-surface-active))] px-2.5 py-1.5 text-xs text-[hsl(var(--color-text-secondary))]">
              <PaperclipIcon className="w-3 h-3" />
              <span className="max-w-[160px] truncate">{f.name}</span>
              <button onClick={() => onRemoveStaged(f.id)} className="text-[hsl(var(--color-text-muted))]">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <input type="file" ref={fileRef} multiple className="hidden" onChange={e => onUpload(e.target.files)} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-10 h-10 rounded-xl bg-[hsl(var(--color-surface-active))] flex items-center justify-center text-[hsl(var(--color-text-secondary))] disabled:opacity-40 shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSend())}
          placeholder="Message…"
          rows={1}
          className="flex-1 min-h-10 max-h-[110px] px-3.5 py-2.5 rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none resize-none overflow-y-auto"
        />
        <button
          onClick={onSend}
          disabled={busy || (!text.trim() && staged.length === 0)}
          className="w-10 h-10 rounded-xl bg-[hsl(var(--color-primary))] text-white flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
