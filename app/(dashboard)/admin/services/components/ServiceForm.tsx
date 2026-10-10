'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createService, getServiceForEdit, saveServiceProtocol, type ParsedProtocol } from '@/app/actions/admin'
import { Loader2, Plus, X, ArrowUp, ArrowDown } from 'lucide-react'

const emptyForm: ParsedProtocol = {
  serviceName: '',
  category: 'immigration',
  serviceDescription: '',
  servicePrice: null,
  steps: [],
  optionalStages: [],
  allInclusive: null,
  saleExecution: [],
  legalHandoff: [],
  closureStages: [],
  statusItems: [],
  documentItems: [],
  sectionDescriptions: {},
}

interface ServiceFormProps {
  serviceId: string | null
  isNew?: boolean
}

export default function ServiceForm({ serviceId, isNew }: ServiceFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ParsedProtocol>(emptyForm)

  useEffect(() => {
    if (isNew || !serviceId) {
      setForm(emptyForm)
      setLoading(false)
      return
    }
    setLoading(true)
    getServiceForEdit(serviceId)
      .then(data => setForm(data || emptyForm))
      .catch(() => setError('Failed to load service'))
      .finally(() => setLoading(false))
  }, [serviceId, isNew])

  const handleSave = async () => {
    if (!form.serviceName.trim()) {
      setError('Service name is required')
      return
    }
    setSaving(true)
    setError(null)

    let targetId = serviceId
    if (isNew) {
      const created = await createService(form.serviceName.trim())
      if (created.error || !created.id) {
        setSaving(false)
        setError(created.error || 'Failed to create service')
        return
      }
      targetId = created.id
    }

    if (!targetId) {
      setSaving(false)
      setError('No service selected')
      return
    }

    const result = await saveServiceProtocol(targetId, form)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.push('/admin/services')
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
    updateField(type, [...form[type], { title: '', description: null }])
  const updateEligibility = (
    type: 'statusItems' | 'documentItems',
    idx: number,
    field: 'title' | 'description',
    value: string | null
  ) => {
    const items = [...form[type]]
    items[idx] = { ...items[idx], [field]: value }
    updateField(type, items)
  }
  const removeEligibility = (type: 'statusItems' | 'documentItems', idx: number) =>
    updateField(type, form[type].filter((_, i) => i !== idx))

  // Add-ons
  const addAddon = () => updateField('optionalStages', [...form.optionalStages, { name: '', price: null }])
  const updateAddon = (idx: number, field: 'name' | 'price', value: string | number | null) => {
    const list = [...form.optionalStages]
    list[idx] = { ...list[idx], [field]: value } as any
    updateField('optionalStages', list)
  }
  const removeAddon = (idx: number) => updateField('optionalStages', form.optionalStages.filter((_, i) => i !== idx))

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

  // Sale execution
  const addSaleItem = () => updateField('saleExecution', [...form.saleExecution, ''])
  const updateSaleItem = (idx: number, value: string) => {
    const items = [...form.saleExecution]
    items[idx] = value
    updateField('saleExecution', items)
  }
  const removeSaleItem = (idx: number) => updateField('saleExecution', form.saleExecution.filter((_, i) => i !== idx))

  // Legal handoff
  const addHandoffItem = () => updateField('legalHandoff', [...form.legalHandoff, ''])
  const updateHandoffItem = (idx: number, value: string) => {
    const items = [...form.legalHandoff]
    items[idx] = value
    updateField('legalHandoff', items)
  }
  const removeHandoffItem = (idx: number) => updateField('legalHandoff', form.legalHandoff.filter((_, i) => i !== idx))

  // Completion
  const addCompletionItem = () => updateField('closureStages', [...form.closureStages, ''])
  const updateCompletionItem = (idx: number, value: string) => {
    const items = [...form.closureStages]
    items[idx] = value
    updateField('closureStages', items)
  }
  const removeCompletionItem = (idx: number) => updateField('closureStages', form.closureStages.filter((_, i) => i !== idx))

  const move = <T,>(arr: T[], from: number, to: number) => {
    if (to < 0 || to >= arr.length) return arr
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  }
  const moveStep = (idx: number, dir: -1 | 1) => updateField('steps', move(form.steps, idx, idx + dir))
  const moveStatus = (idx: number, dir: -1 | 1) => updateField('statusItems', move(form.statusItems, idx, idx + dir))
  const moveDocument = (idx: number, dir: -1 | 1) => updateField('documentItems', move(form.documentItems, idx, idx + dir))
  const moveAddon = (idx: number, dir: -1 | 1) => updateField('optionalStages', move(form.optionalStages, idx, idx + dir))
  const moveAllInclusiveItem = (idx: number, dir: -1 | 1) => {
    if (!form.allInclusive) return
    updateField('allInclusive', { ...form.allInclusive, items: move(form.allInclusive.items, idx, idx + dir) })
  }
  const moveSaleItem = (idx: number, dir: -1 | 1) => updateField('saleExecution', move(form.saleExecution, idx, idx + dir))
  const moveHandoffItem = (idx: number, dir: -1 | 1) => updateField('legalHandoff', move(form.legalHandoff, idx, idx + dir))
  const moveCompletionItem = (idx: number, dir: -1 | 1) => updateField('closureStages', move(form.closureStages, idx, idx + dir))

  const ReorderButtons = ({ idx, total, onMove }: { idx: number; total: number; onMove: (dir: -1 | 1) => void }) => (
    <div className="flex flex-col">
      <button
        onClick={() => onMove(-1)}
        disabled={idx === 0}
        className="text-[hsl(var(--color-text-muted))] hover:text-[hsl(var(--color-text-primary))] disabled:opacity-30 disabled:hover:text-[hsl(var(--color-text-muted))]"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onMove(1)}
        disabled={idx === total - 1}
        className="text-[hsl(var(--color-text-muted))] hover:text-[hsl(var(--color-text-primary))] disabled:opacity-30 disabled:hover:text-[hsl(var(--color-text-muted))]"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[hsl(var(--color-text-secondary))]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading…
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
      <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-2">
        {isNew ? 'New service' : 'Edit service'}
      </h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

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
            <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => updateField('category', e.target.value)}
              className="w-full rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] px-3 py-2.5 text-sm text-[hsl(var(--color-text-primary))] outline-none"
            >
              <option value="immigration">Immigration</option>
              <option value="driving">Driving</option>
              <option value="business">Business</option>
              <option value="language">Language</option>
            </select>
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

        {/* Mandatory steps */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Mandatory steps</h2>
          <ul className="space-y-3">
            {form.steps.map((step, i) => (
              <li key={i} className="flex gap-2 items-center">
                <ReorderButtons idx={i} total={form.steps.length} onMove={dir => moveStep(i, dir)} />
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

        {/* Add-ons */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Add-ons</h2>
          {form.optionalStages.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <ReorderButtons idx={i} total={form.optionalStages.length} onMove={dir => moveAddon(i, dir)} />
              <div className="flex-1">
                <Input
                  value={opt.name}
                  onChange={e => updateAddon(i, 'name', e.target.value)}
                  placeholder="Add-on name"
                />
              </div>
              <div className="w-28">
                <Input
                  type="number"
                  value={opt.price ?? ''}
                  onChange={e => updateAddon(i, 'price', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="PLN"
                />
              </div>
              <button onClick={() => removeAddon(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addAddon} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add add-on
          </Button>
        </div>

        {/* All inclusive */}
        {form.allInclusive ? (
          (() => {
            const ai = form.allInclusive
            return (
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
                      value={ai.name}
                      onChange={e => updateAllInclusive('name', e.target.value)}
                      placeholder="Package name"
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      value={ai.price ?? ''}
                      onChange={e => updateAllInclusive('price', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="PLN"
                    />
                  </div>
                </div>
                {ai.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center pl-4">
                    <ReorderButtons idx={i} total={ai.items.length} onMove={dir => moveAllInclusiveItem(i, dir)} />
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
            )
          })()
        ) : (
          <Button variant="outline" size="sm" onClick={addAllInclusive} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add all inclusive package
          </Button>
        )}

        {/* Status verification */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Status verification</h2>
          {form.statusItems.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="pt-2">
                <ReorderButtons idx={i} total={form.statusItems.length} onMove={dir => moveStatus(i, dir)} />
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  value={item.title}
                  onChange={e => updateEligibility('statusItems', i, 'title', e.target.value)}
                  placeholder="Item title"
                />
                <label className="flex items-center gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                  <input
                    type="checkbox"
                    checked={item.description !== null}
                    onChange={e => updateEligibility('statusItems', i, 'description', e.target.checked ? '' : null)}
                    className="rounded border-[hsl(var(--color-border))]"
                  />
                  Only applies in specific cases
                </label>
                {item.description !== null && (
                  <Input
                    value={item.description}
                    onChange={e => updateEligibility('statusItems', i, 'description', e.target.value)}
                    placeholder="e.g. Only for family reunification"
                  />
                )}
              </div>
              <button onClick={() => removeEligibility('statusItems', i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400 pt-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addEligibility('statusItems')} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add status item
          </Button>
        </div>

        {/* Mandatory documents */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Mandatory documents</h2>
          {form.documentItems.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="pt-2">
                <ReorderButtons idx={i} total={form.documentItems.length} onMove={dir => moveDocument(i, dir)} />
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  value={item.title}
                  onChange={e => updateEligibility('documentItems', i, 'title', e.target.value)}
                  placeholder="Item title"
                />
                <label className="flex items-center gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                  <input
                    type="checkbox"
                    checked={item.description !== null}
                    onChange={e => updateEligibility('documentItems', i, 'description', e.target.checked ? '' : null)}
                    className="rounded border-[hsl(var(--color-border))]"
                  />
                  Only applies in specific cases
                </label>
                {item.description !== null && (
                  <Input
                    value={item.description}
                    onChange={e => updateEligibility('documentItems', i, 'description', e.target.value)}
                    placeholder="e.g. Only for first-time applicants"
                  />
                )}
              </div>
              <button onClick={() => removeEligibility('documentItems', i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400 pt-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addEligibility('documentItems')} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add document item
          </Button>
        </div>

        {/* Sale execution */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Sale execution</h2>
          {form.saleExecution.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <ReorderButtons idx={i} total={form.saleExecution.length} onMove={dir => moveSaleItem(i, dir)} />
              <div className="flex-1">
                <Input
                  value={item}
                  onChange={e => updateSaleItem(i, e.target.value)}
                  placeholder="e.g. Send personalised service agreement"
                />
              </div>
              <button onClick={() => removeSaleItem(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSaleItem} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add sale execution item
          </Button>
        </div>

        {/* Legal handoff */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Legal handoff</h2>
          {form.legalHandoff.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <ReorderButtons idx={i} total={form.legalHandoff.length} onMove={dir => moveHandoffItem(i, dir)} />
              <div className="flex-1">
                <Input
                  value={item}
                  onChange={e => updateHandoffItem(i, e.target.value)}
                  placeholder="e.g. Lawyer officially takes over the case"
                />
              </div>
              <button onClick={() => removeHandoffItem(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addHandoffItem} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add legal handoff item
          </Button>
        </div>

        {/* Completion */}
        <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Completion</h2>
          {form.closureStages.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <ReorderButtons idx={i} total={form.closureStages.length} onMove={dir => moveCompletionItem(i, dir)} />
              <div className="flex-1">
                <Input
                  value={item}
                  onChange={e => updateCompletionItem(i, e.target.value)}
                  placeholder="Completion item"
                />
              </div>
              <button onClick={() => removeCompletionItem(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCompletionItem} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add completion item
          </Button>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save service
        </Button>
      </div>
    </div>
  )
}
