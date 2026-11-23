'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createAction,
  completeAction,
  updateAction,
  type CaseEntry,
} from '@/app/actions/workflow'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import { Zap, Plus, Check, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const DAY_MS = 86400000

export default function CaseActionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params)
  const queryClient = useQueryClient()
  const [actions, setActions] = useState<CaseEntry[]>([])
  const [meId, setMeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<'new' | string | null>(null) // 'new' or entry id
  const [body, setBody] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setMeId(user?.id ?? null)
    const { data } = await supabase
      .from('case_entries')
      .select('*, author:users!created_by(display_name, email)')
      .eq('case_id', caseId)
      .eq('kind', 'action')
      .order('completed_at', { ascending: true, nullsFirst: true })
      .order('due_date', { ascending: true, nullsFirst: false })
    setActions((data || []) as CaseEntry[])
    setLoading(false)
  }, [caseId])

  useEffect(() => { load() }, [load])

  const refresh = () => {
    load()
    queryClient.invalidateQueries({ queryKey: queryKeys.workflow(caseId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.myActions })
  }

  const openNew = () => {
    setForm('new')
    setBody('')
    setDueDate('')
    setError(null)
  }

  const openEdit = (a: CaseEntry) => {
    setForm(a.id)
    setBody(a.body || '')
    setDueDate(a.due_date || '')
    setError(null)
  }

  const submit = async () => {
    if (!form || !body.trim() || !dueDate) return
    setSaving(true)
    setError(null)
    const r = form === 'new'
      ? await createAction(caseId, body, dueDate)
      : await updateAction(form, caseId, body, dueDate)
    setSaving(false)
    if (r.error) { setError(r.error); return }
    setForm(null)
    refresh()
  }

  const complete = async (a: CaseEntry) => {
    await completeAction(a.id, caseId)
    refresh()
  }

  const today = new Date(new Date().toDateString()).getTime()
  const open = actions.filter(a => !a.completed_at)
  const done = actions.filter(a => a.completed_at)

  return (
    <div className="pb-20">
      <SubPageHeader
        backHref={`/cases/${caseId}`}
        title="Actions"
        subtitle="Your reminders on this case"
        icon={<Zap className="w-4 h-4 text-white" />}
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--color-text-muted))]" />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2">
            {open.map(a => {
              const overdue = a.due_date && new Date(a.due_date).getTime() < today
              const mine = a.created_by === meId
              return (
                <li
                  key={a.id}
                  className={`rounded-xl border bg-[hsl(var(--color-surface))] px-4 py-3 flex items-center gap-3 ${
                    overdue ? 'border-red-500/50' : 'border-[hsl(var(--color-border))]'
                  }`}
                >
                  <button
                    onClick={() => complete(a)}
                    title="Mark done"
                    className="w-6 h-6 rounded-full border-2 border-[hsl(var(--color-text-muted))] hover:border-green-500 hover:bg-green-500/10 shrink-0 transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">{a.body}</p>
                    <p className={`text-xs mt-0.5 ${overdue ? 'text-red-400 font-medium' : 'text-[hsl(var(--color-text-muted))]'}`}>
                      {a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString()}` : 'No due date'}
                      {!mine && ` · ${a.author?.display_name || a.author?.email?.split('@')[0] || 'someone'}'s`}
                    </p>
                  </div>
                  {mine && (
                    <button onClick={() => openEdit(a)} className="text-[hsl(var(--color-text-muted))] hover:text-[hsl(var(--color-text-primary))] shrink-0">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </li>
              )
            })}
            {open.length === 0 && (
              <p className="text-xs text-[hsl(var(--color-text-muted))] text-center py-4">
                No open reminders
              </p>
            )}
          </ul>

          {form === null ? (
            <Button variant="secondary" onClick={openNew} className="w-full gap-2">
              <Plus className="w-4 h-4" />
              Add action
            </Button>
          ) : (
            <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
              <input
                value={body}
                onChange={e => setBody(e.target.value)}
                autoFocus
                placeholder="Remind yourself to…"
                className="w-full h-10 px-3 rounded-lg bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] placeholder:text-[hsl(var(--color-text-muted))] outline-none"
              />
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="h-10 px-3 rounded-lg bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))]"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setForm(null)} disabled={saving} className="flex-1">Cancel</Button>
                <Button onClick={submit} disabled={saving || !body.trim() || !dueDate} className="flex-1">
                  {saving ? 'Saving…' : form === 'new' ? 'Add' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {done.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 px-1 text-[hsl(var(--color-text-muted))]">
                Done · {done.length}
              </p>
              <ul className="space-y-2">
                {done.map(a => (
                  <li key={a.id} className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3 flex items-center gap-3 opacity-60">
                    <span className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[hsl(var(--color-text-secondary))] line-through">{a.body}</p>
                      <p className="text-xs text-[hsl(var(--color-text-muted))] mt-0.5">
                        Done {new Date(a.completed_at!).toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
