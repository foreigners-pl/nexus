'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getServices, parseServiceProtocol, saveServiceProtocol, type ParsedProtocol } from '@/app/actions/admin'
import { Loader2, Upload, X } from 'lucide-react'
import type { Service } from '@/types/database'

export default function ProtocolUploadPage() {
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedProtocol | null>(null)

  useEffect(() => {
    getServices().then(setServices)
  }, [])

  useEffect(() => {
    const selected = services.find(s => s.id === serviceId)
    setServiceName(selected?.name || '')
    if (parsed) {
      setParsed({ ...parsed, serviceName: selected?.name || '' })
    }
  }, [serviceId, services])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(null)
    setParsing(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          const base64Part = dataUrl.split(',')[1]
          if (base64Part) resolve(base64Part)
          else reject(new Error('Failed to read file'))
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const result = await parseServiceProtocol(base64)
      if (result.error) {
        setError(result.error)
      } else {
        setParsed({ ...result, serviceName: serviceName || result.serviceName })
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to read file')
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async () => {
    if (!serviceId || !parsed) return
    setSaving(true)
    setError(null)
    const result = await saveServiceProtocol(serviceId, { ...parsed, serviceName })
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.push('/admin')
    }
  }

  const updateStep = (idx: number, field: keyof ParsedProtocol['steps'][0], value: string | boolean | number | null) => {
    if (!parsed) return
    const steps = [...parsed.steps]
    steps[idx] = { ...steps[idx], [field]: value } as any
    setParsed({ ...parsed, steps })
  }

  const removeStep = (idx: number) => {
    if (!parsed) return
    const steps = parsed.steps.filter((_, i) => i !== idx)
    setParsed({ ...parsed, steps })
  }

  const updateEligibility = (
    type: 'statusItems' | 'documentItems',
    idx: number,
    field: keyof ParsedProtocol['statusItems'][0],
    value: string
  ) => {
    if (!parsed) return
    const items = [...parsed[type]]
    items[idx] = { ...items[idx], [field]: value }
    setParsed({ ...parsed, [type]: items })
  }

  const removeEligibility = (type: 'statusItems' | 'documentItems', idx: number) => {
    if (!parsed) return
    const items = parsed[type].filter((_, i) => i !== idx)
    setParsed({ ...parsed, [type]: items })
  }

  const sectionDescription = (keyword: string) =>
    Object.entries(parsed?.sectionDescriptions || {})
      .find(([title]) => title.toLowerCase().includes(keyword))?.[1] || ''

  const updateOptional = (idx: number, field: 'name' | 'price', value: string | number | null) => {
    if (!parsed) return
    const list = [...parsed.optionalStages]
    list[idx] = { ...list[idx], [field]: value } as any
    setParsed({ ...parsed, optionalStages: list })
  }
  const removeOptional = (idx: number) => {
    if (!parsed) return
    setParsed({ ...parsed, optionalStages: parsed.optionalStages.filter((_, i) => i !== idx) })
  }
  const updateAllInclusive = (field: 'name' | 'price', value: string | number | null) => {
    if (!parsed || !parsed.allInclusive) return
    setParsed({ ...parsed, allInclusive: { ...parsed.allInclusive, [field]: value } })
  }
  const updateAllInclusiveItem = (idx: number, value: string) => {
    if (!parsed || !parsed.allInclusive) return
    const items = [...parsed.allInclusive.items]
    items[idx] = value
    setParsed({ ...parsed, allInclusive: { ...parsed.allInclusive, items } })
  }
  const removeAllInclusiveItem = (idx: number) => {
    if (!parsed || !parsed.allInclusive) return
    setParsed({ ...parsed, allInclusive: { ...parsed.allInclusive, items: parsed.allInclusive.items.filter((_, i) => i !== idx) } })
  }
  const updateExecutionStage = (stageIdx: number, value: string) => {
    if (!parsed) return
    const stages = [...parsed.executionStages]
    stages[stageIdx] = { ...stages[stageIdx], name: value }
    setParsed({ ...parsed, executionStages: stages })
  }
  const updateExecutionItem = (stageIdx: number, itemIdx: number, value: string) => {
    if (!parsed) return
    const stages = [...parsed.executionStages]
    stages[stageIdx].items[itemIdx] = value
    setParsed({ ...parsed, executionStages: stages })
  }
  const removeExecutionItem = (stageIdx: number, itemIdx: number) => {
    if (!parsed) return
    const stages = [...parsed.executionStages]
    stages[stageIdx] = { ...stages[stageIdx], items: stages[stageIdx].items.filter((_, i) => i !== itemIdx) }
    setParsed({ ...parsed, executionStages: stages })
  }
  const removeExecutionStage = (stageIdx: number) => {
    if (!parsed) return
    setParsed({ ...parsed, executionStages: parsed.executionStages.filter((_, i) => i !== stageIdx) })
  }
  const updateClosureItem = (idx: number, value: string) => {
    if (!parsed) return
    const items = [...parsed.closureStages]
    items[idx] = value
    setParsed({ ...parsed, closureStages: items })
  }
  const removeClosureItem = (idx: number) => {
    if (!parsed) return
    setParsed({ ...parsed, closureStages: parsed.closureStages.filter((_, i) => i !== idx) })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 pb-20">
      <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))] mb-2">Upload service protocol</h1>
      <p className="text-sm text-[hsl(var(--color-text-secondary))] mb-6">
        Select a service and upload its DOCX protocol. The document will be parsed into steps and eligibility items that you can review before saving.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 mb-8">
        <div>
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

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--color-text-primary))] mb-1.5">Protocol document (.docx)</label>
          <label className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-8 cursor-pointer hover:bg-[hsl(var(--color-surface-hover))] transition-colors">
            <Upload className="w-5 h-5 text-[hsl(var(--color-text-secondary))]" />
            <span className="text-sm text-[hsl(var(--color-text-secondary))]">
              {fileName || 'Click to upload DOCX'}
            </span>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFile} />
          </label>
        </div>
      </div>

      {parsing && (
        <div className="flex items-center justify-center py-8 text-[hsl(var(--color-text-secondary))]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Parsing document…
        </div>
      )}

      {parsed && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Service details</h2>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Service name</label>
              <Input
                value={serviceName}
                onChange={e => {
                  setServiceName(e.target.value)
                  if (parsed) setParsed({ ...parsed, serviceName: e.target.value })
                }}
                placeholder="e.g. TRC Full Service"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Description</label>
              <textarea
                value={parsed.serviceDescription}
                onChange={e => setParsed({ ...parsed, serviceDescription: e.target.value })}
                rows={3}
                className="w-full rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] px-3 py-2 text-sm text-[hsl(var(--color-text-primary))] outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Base price (PLN)</label>
              <Input
                type="number"
                value={parsed.servicePrice ?? ''}
                onChange={e => setParsed({ ...parsed, servicePrice: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Steps ({parsed.steps.length})</h2>
              {sectionDescription('mandatory stages') && (
                <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">{sectionDescription('mandatory stages')}</p>
              )}
            </div>
            {parsed.steps.length === 0 ? (
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">No steps were detected.</p>
            ) : (
              <ul className="space-y-3">
                {parsed.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input
                        value={step.name}
                        onChange={e => updateStep(i, 'name', e.target.value)}
                        placeholder="Step name"
                      />
                    </div>
                    <button onClick={() => removeStep(i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Eligibility — Status verification</h2>
              {sectionDescription('status verification') && (
                <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">{sectionDescription('status verification')}</p>
              )}
            </div>
            {parsed.statusItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={item.title}
                    onChange={e => updateEligibility('statusItems', i, 'title', e.target.value)}
                    placeholder="Item title"
                  />
                </div>
                <button onClick={() => removeEligibility('statusItems', i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Eligibility — Mandatory documents</h2>
              {sectionDescription('mandatory documents') && (
                <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">{sectionDescription('mandatory documents')}</p>
              )}
            </div>
            {parsed.documentItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={item.title}
                    onChange={e => updateEligibility('documentItems', i, 'title', e.target.value)}
                    placeholder="Item title"
                  />
                </div>
                <button onClick={() => removeEligibility('documentItems', i)} className="text-[hsl(var(--color-text-muted))] hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">1. Service Outline — Optional stages</h2>
              {sectionDescription('optional stages') && (
                <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">{sectionDescription('optional stages')}</p>
              )}
            </div>
            {parsed.optionalStages.map((opt, i) => (
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
          </div>

          {parsed.allInclusive && (
            <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">All inclusive package</h2>
                {sectionDescription('all inclusive') && (
                  <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">{sectionDescription('all inclusive')}</p>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={parsed.allInclusive.name}
                    onChange={e => updateAllInclusive('name', e.target.value)}
                    placeholder="Package name"
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    value={parsed.allInclusive.price ?? ''}
                    onChange={e => updateAllInclusive('price', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="PLN"
                  />
                </div>
              </div>
              {parsed.allInclusive.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
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
            </div>
          )}

          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">3. Execution and Completion</h2>
            {parsed.executionStages.map((stage, i) => (
              <div key={i} className="space-y-2">
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
                {sectionDescription(stage.name.toLowerCase()) && (
                  <p className="text-xs text-[hsl(var(--color-text-secondary))] pl-1">{sectionDescription(stage.name.toLowerCase())}</p>
                )}
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
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">4. Service Closure</h2>
              {sectionDescription('service closure') && (
                <p className="text-xs text-[hsl(var(--color-text-secondary))] mt-1">{sectionDescription('service closure')}</p>
              )}
            </div>
            {parsed.closureStages.map((item, i) => (
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
          </div>

          <Button onClick={handleSave} disabled={!serviceId || saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save to service
          </Button>
        </div>
      )}
    </div>
  )
}
