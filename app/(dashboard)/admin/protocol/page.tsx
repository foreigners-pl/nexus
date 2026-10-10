'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getServices, getServiceForEdit, saveServiceProtocol, type ParsedProtocol } from '@/app/actions/admin'
import { Loader2, Plus, X } from 'lucide-react'
import type { Service } from '@/types/database'

const emptyForm: ParsedProtocol = {
  serviceName: '',
  serviceDescription: '',
  servicePrice: null,
  steps: [],
  optionalStages: [],
  allInclusive: null,
  executionStages: [],
  closureStages: [],
  statusItems: [],
  documentItems: [],
  sectionDescriptions: {},
}

export default function ServiceSetupPage() {
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ParsedProtocol>(emptyForm)

  useEffect(() => {
    getServices().then(setServices)
  }, [])

  useEffect(() => {
    if (!serviceId) {
      setForm(emptyForm)
      return
    }
    setLoading(true)
    getServiceForEdit(serviceId)
      .then(data => setForm(data || emptyForm))
      .catch(() => setError('Failed to load service'))
      .finally(() => setLoading(false))
  }, [serviceId])

  const handleSave = async () => {
    if (!serviceId) return
    setSaving(true)
    setError(null)
    const result = await saveServiceProtocol(serviceId, form)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.push('/admin')
    }
  }

  const updateField = <K extends keyof ParsedProtocol>(field: K, value: ParsedProtocol[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Steps
  const addStep = () => updateField('steps', [...form.steps, { name: '', description: '', price: null, isRequired: true }])
  const updateStep = (idx: number, value: string) => {
    const steps = [...form.steps]
    steps[idx] = { ...steps[idx], name: value }
    updateField('steps', steps)
  }
  const removeStep = (idx: number) => updateField('steps', form.steps.filter((_, i) => i !== idx))

  // Eligibility
  const addEligibility = (type: 'statusItems' | 'documentItems') =>
    updateField(type, [...form[type], { title: '', description: '' }])
  const updateEligibility = (type: 'statusItems' | 'documentItems', idx: number, value: string) => {
    const items = [...form[type]]
    items[idx] = { ...items[idx], title: value }
    updateField(type, items)
  }
  const removeEligibility = (type: 'statusItems' | 'documentItems', idx: number) =>
    updateField(type, form[type].filter((_, i) => i !== idx))

  // Optional stages
  const addOptional = () => updateField('optionalStages', [...form.optionalStages, { name: '', price: null }])
  const updateOptional = (idx: number, field: 'name' | 'price', value: string | number | null) => {
    const list = [...form.optionalStages]
    list[idx] = { ...list[idx], [field]: value } as any
    updateField('optionalStages', list)
  }
  const removeOptional = (idx: number) => updateField('optionalStages', form.optionalStages.filter((_, i) => i !== idx))

  // All inclusive
  const addAllInclusive = () => updateField('allInclusive', { name: 'All inclusive', price: null, items: [''] })
  const updateAllInclusive = (field: 'name' | 'price', value: string | number | null) => {
    if (!form.allInclusive) return
    updateField('allInclusive', { ...form.allInclusive, [field]: value })
  }
  const updateAllInclusiveItem = (idx: number, value: string) => {
    if (!form.allInclusive) return
    const items = [...form.allInclusive.items]
    items[idx] = value
    updateField('allInclusive', { ...form.allInclusive, items })
  }
  const addAllInclusiveItem = () => {
    if (!form.allInclusive) return
    updateField('allInclusive', { ...form.allInclusive, items: [...form.allInclusive.items, ''] })
  }
  const removeAllInclusiveItem = (idx: number) => {
    if (!form.allInclusive) return
    updateField('allInclusive', { ...form.allInclusive, items: form.allInclusive.items.filter((_, i) => i !== idx) })
  }
  const removeAllInclusive = () => updateField('allInclusive', null)

  // Execution
  const addExecutionStage = () => updateField('executionStages', [...form.executionStages, { name: '', items: [''] }])
  const updateExecutionStage = (idx: number, value: string) => {
    const stages = [...form.executionStages]
    stages[idx] = { ...stages[idx], name: value }
    updateField('executionStages', stages)
  }
  const removeExecutionStage = (idx: number) => updateField('executionStages', form.executionStages.filter((_, i) => i !== idx))
  const addExecutionItem = (stageIdx: number) => {
    const stages = [...form.executionStages]
    stages[stageIdx] = { ...stages[stageIdx], items: [...stages[stageIdx].items, ''] }
    updateField('executionStages', stages)
  }
  const updateExecutionItem = (stageIdx: number, itemIdx: number, value: string) => {
    const stages = [...form.executionStages]
    stages[stageIdx].items[itemIdx] = value
    updateField('executionStages', stages)
  }
  const removeExecutionItem = (stageIdx: number, itemIdx: number) => {
    const stages = [...form.executionStages]
    stages[stageIdx] = { ...stages[stageIdx], items: stages[stageIdx].items.filter((_, i) => i !== itemIdx) }
    updateField('executionStages', stages)
  }

  // Closure
  const addClosureItem = () => updateField('closureStages', [...form.closureStages, ''])
  const updateClosureItem = (idx: number, value: string) => {
    const items = [...form.closureStages]
    items[idx] = value
    updateField('closureStages', items)
  }
  const removeClosureItem = (idx: number) => updateField('closureStages', form.closureStages.filter((_, i) => i !== idx))

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
      <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-2">Set up service</h1>
      <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-6">
        Select a service and fill out its protocol manually. Only the Steps and Eligibility sections are used in case workflows; the rest is reference info.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="mb-8">
        <label className="block text-sm font-medium text-[hsl(var(--color-text-primary))] mb-1.5">Service</label>
        <select
          value={serviceId}
          onChange={e => setServiceId(e.target.value)}
          className="w-full rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] px-3 py-2.5 text-sm text-[hsl(var(--color-text-primary))] outline-none"
        >
          <option value="">Select a service</option>
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-[hsl(var(--color-text-secondary))]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading…
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Service details</h2>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Service name</label>
              <Input
                value={form.serviceName}
                onChange={e => updateField('serviceName', e.target.value)}
                placeholder="e.g. TRC Full Service"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Description</label>
              <textarea
                value={form.serviceDescription}
                onChange={e => updateField('serviceDescription', e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] px-3 py-2 text-sm text-[hsl(var(--color-text-primary))] outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Base price (PLN)</label>
              <Input
                type="number"
                value={form.servicePrice ?? ''}
                onChange={e => updateField('servicePrice', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Workflow steps */}
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Workflow steps</h2>
            <ul className="space-y-3">
              {form.steps.map((step, i) => (
                <li key={i} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Input
                      value={step.name}
                      onChange={e => updateStep(i, e.target.value)}
                      placeholder="Step name"
                    />
                  </div>
                  <button onClick={() => removeStep(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={addStep} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add step
            </Button>
          </div>

          {/* Eligibility status */}
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Eligibility — Status verification</h2>
            {form.statusItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={item.title}
                    onChange={e => updateEligibility('statusItems', i, e.target.value)}
                    placeholder="Item title"
                  />
                </div>
                <button onClick={() => removeEligibility('statusItems', i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addEligibility('statusItems')} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add status item
            </Button>
          </div>

          {/* Eligibility documents */}
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Eligibility — Mandatory documents</h2>
            {form.documentItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={item.title}
                    onChange={e => updateEligibility('documentItems', i, e.target.value)}
                    placeholder="Item title"
                  />
                </div>
                <button onClick={() => removeEligibility('documentItems', i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addEligibility('documentItems')} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add document item
            </Button>
          </div>

          {/* Optional stages */}
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Optional stages</h2>
            {form.optionalStages.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={opt.name}
                    onChange={e => updateOptional(i, 'name', e.target.value)}
                    placeholder="Optional stage name"
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    value={opt.price ?? ''}
                    onChange={e => updateOptional(i, 'price', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="PLN"
                  />
                </div>
                <button onClick={() => removeOptional(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addOptional} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add optional stage
            </Button>
          </div>

          {/* All inclusive */}
          {form.allInclusive ? (
            <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">All inclusive package</h2>
                <button onClick={removeAllInclusive} className="text-[hsl(var(--color-text-muted))] hover:text-red-400 text-xs">
                  Remove package
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={form.allInclusive.name}
                    onChange={e => updateAllInclusive('name', e.target.value)}
                    placeholder="Package name"
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    value={form.allInclusive.price ?? ''}
                    onChange={e => updateAllInclusive('price', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="PLN"
                  />
                </div>
              </div>
              {form.allInclusive.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center pl-4">
                  <div className="flex-1">
                    <Input
                      value={item}
                      onChange={e => updateAllInclusiveItem(i, e.target.value)}
                      placeholder="Included item"
                    />
                  </div>
                  <button onClick={() => removeAllInclusiveItem(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addAllInclusiveItem} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Add included item
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={addAllInclusive} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add all inclusive package
            </Button>
          )}

          {/* Execution and Completion */}
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Execution and Completion</h2>
            {form.executionStages.map((stage, i) => (
              <div key={i} className="space-y-2 rounded-lg bg-[hsl(var(--color-background))] p-3">
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Input
                      value={stage.name}
                      onChange={e => updateExecutionStage(i, e.target.value)}
                      placeholder="Stage name"
                    />
                  </div>
                  <button onClick={() => removeExecutionStage(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {stage.items.map((item, j) => (
                  <div key={j} className="flex gap-2 items-center pl-4">
                    <div className="flex-1">
                      <Input
                        value={item}
                        onChange={e => updateExecutionItem(i, j, e.target.value)}
                        placeholder="Item"
                      />
                    </div>
                    <button onClick={() => removeExecutionItem(i, j)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addExecutionItem(i)} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add item
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addExecutionStage} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add execution stage
            </Button>
          </div>

          {/* Service Closure */}
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Service Closure</h2>
            {form.closureStages.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={item}
                    onChange={e => updateClosureItem(i, e.target.value)}
                    placeholder="Closure item"
                  />
                </div>
                <button onClick={() => removeClosureItem(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addClosureItem} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Add closure item
            </Button>
          </div>

          <Button onClick={handleSave} disabled={!serviceId || saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save service setup
          </Button>
        </div>
      )}
    </div>
  )
}
