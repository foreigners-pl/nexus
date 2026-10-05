'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { usePaneBack } from '@/lib/panes'
import { useCaseHeaderCache, fetchCaseHeaderQuery, queryKeys } from '@/lib/query'
import { SubPageHeader } from '@/components/shared/SubPageHeader'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  getWorkflowEditorData,
  saveWorkflowChanges,
  type CaseStep,
  type ServiceStepTemplate,
} from '@/app/actions/workflow'
import { ChevronUp, ChevronDown, Trash2, Plus, GripVertical, ListChecks, X } from 'lucide-react'

interface WorkflowEditPageProps {
  params: Promise<{ id: string }>
}

interface EditableStep {
  key: string
  id?: string
  name: string
  is_required: boolean
  step_type: string
  service_step_id?: string
}

export default function WorkflowEditPage({ params }: WorkflowEditPageProps) {
  const { id: urlId } = use(params)
  const router = useRouter()
  const paneBack = usePaneBack()
  const queryClient = useQueryClient()
  const { getCached: getCachedHeader } = useCaseHeaderCache(urlId)

  const [caseId, setCaseId] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [caseCode, setCaseCode] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [serviceName, setServiceName] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)

  const [steps, setSteps] = useState<EditableStep[]>([])
  const [available, setAvailable] = useState<ServiceStepTemplate[]>([])
  const [hasLogs, setHasLogs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    const cachedHeader = getCachedHeader()
    if (cachedHeader?.caseId) {
      setCaseId(cachedHeader.caseId)
      setClientId(cachedHeader.clientId ?? null)
      setCaseCode(cachedHeader.caseCode)
      setClientName(cachedHeader.clientName || cachedHeader.title)
      setServiceName(cachedHeader.serviceName || null)
      setPhone(cachedHeader.phone || null)
    }

    ;(async () => {
      const header = await fetchCaseHeaderQuery(queryClient, urlId)
      if (!isMounted.current) return
      if ('error' in header) {
        setLoading(false)
        return
      }
      setCaseId(header.caseId)
      setClientId(header.clientId)
      setCaseCode(header.caseCode)
      setClientName(header.clientName || header.title)
      setServiceName(header.serviceName || null)
      setPhone(header.phone || null)

      const data = await getWorkflowEditorData(header.caseId)
      if (!isMounted.current) return
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }
      setSteps(
        data.steps.map(s => ({
          key: s.id,
          id: s.id,
          name: s.name,
          is_required: s.is_required,
          step_type: s.step_type,
        }))
      )
      setAvailable(data.available)
      setHasLogs(data.hasLogs)
      setLoading(false)
    })()

    return () => { isMounted.current = false }
  }, [urlId])

  const canRemove = (item: EditableStep) => {
    if (item.is_required) return false
    if (item.id && hasLogs[item.id]) return false
    return true
  }

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= steps.length) return
    const copy = [...steps]
    const tmp = copy[idx]
    copy[idx] = copy[next]
    copy[next] = tmp
    setSteps(copy)
  }

  const remove = (idx: number) => {
    const item = steps[idx]
    if (!canRemove(item)) return
    setSteps(prev => prev.filter((_, i) => i !== idx))
  }

  const addServiceStep = (svc: ServiceStepTemplate) => {
    setSteps(prev => [
      ...prev,
      {
        key: `new-${Date.now()}-${svc.id}`,
        name: svc.name,
        is_required: svc.is_required,
        step_type: 'service',
        service_step_id: svc.id,
      },
    ])
    setAvailable(prev => prev.filter(s => s.id !== svc.id))
  }

  const addCustom = () => {
    const name = customName.trim()
    if (!name) return
    setSteps(prev => [
      ...prev,
      {
        key: `new-custom-${Date.now()}`,
        name,
        is_required: false,
        step_type: 'custom',
      },
    ])
    setCustomName('')
  }

  const handleSave = async () => {
    if (!caseId) return
    setSaving(true)
    setError(null)
    const items = steps.map(s => {
      if (s.id) return { id: s.id }
      if (s.service_step_id) return { service_step_id: s.service_step_id }
      return { custom_name: s.name }
    })
    const result = await saveWorkflowChanges(caseId, items)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.workflow(caseId) })
    if (paneBack) paneBack()
    else router.push(`/cases/${urlId}/progress`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-[hsl(var(--color-text-secondary))]">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!caseId) return <div className="flex items-center justify-center min-h-screen"><p>Case not found</p></div>

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <SubPageHeader
        backHref={`/cases/${urlId}/progress`}
        title={caseCode || 'Case'}
        subtitle={[clientName, serviceName, phone].filter(Boolean).join(' · ')}
        icon={<ListChecks className="w-4 h-4 text-white" />}
        titleHref={clientId ? `/clients/${clientId}` : undefined}
        action={
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        }
      />

      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-hover))]/30">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Steps</h2>
            <p className="text-xs text-[hsl(var(--color-text-secondary))]">Drag or use arrows to reorder. Required steps and steps with logs cannot be removed.</p>
          </div>

          {steps.length === 0 ? (
            <p className="text-sm text-[hsl(var(--color-text-secondary))] text-center py-8">No steps yet.</p>
          ) : (
            <div className="divide-y divide-[hsl(var(--color-border))]">
              {steps.map((step, idx) => {
                const locked = !canRemove(step)
                return (
                  <div key={step.key} className="flex items-center gap-2 px-4 py-3">
                    <GripVertical className="w-4 h-4 text-[hsl(var(--color-text-muted))]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">{step.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {step.is_required ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">Required</span>
                        ) : step.step_type === 'custom' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-secondary))] font-medium">Custom</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--color-surface-active))] text-[hsl(var(--color-text-secondary))] font-medium">Optional</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))] disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={idx === steps.length - 1}
                        className="p-1.5 rounded-lg text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))] disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        disabled={locked}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <Button variant="secondary" onClick={() => setModalOpen(true)} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add step
        </Button>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add step">
        <div className="space-y-5">
          {available.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--color-text-muted))]">From service</h3>
              <div className="divide-y divide-[hsl(var(--color-border))] border border-[hsl(var(--color-border))] rounded-xl overflow-hidden">
                {available.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--color-surface))]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">{svc.name}</p>
                      <p className="text-xs text-[hsl(var(--color-text-secondary))]">{svc.is_required ? 'Required' : 'Optional'}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => addServiceStep(svc)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--color-text-muted))]">Other</h3>
            <div className="flex gap-2">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Step name"
                className="flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
              />
              <Button onClick={addCustom} disabled={!customName.trim()}>
                Add
              </Button>
            </div>
          </div>

          {available.length === 0 && (
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">No more service steps to add. Use the field above for a custom step.</p>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
