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
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedProtocol | null>(null)

  useEffect(() => {
    getServices().then(setServices)
  }, [])

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
        setParsed(result)
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
    const result = await saveServiceProtocol(serviceId, parsed)
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
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Steps ({parsed.steps.length})</h2>
            {parsed.steps.length === 0 ? (
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">No steps were detected.</p>
            ) : (
              <ul className="space-y-3">
                {parsed.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={step.name}
                        onChange={e => updateStep(i, 'name', e.target.value)}
                        placeholder="Step name"
                      />
                      <textarea
                        value={step.description}
                        onChange={e => updateStep(i, 'description', e.target.value)}
                        rows={2}
                        placeholder="Description"
                        className="w-full rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] px-3 py-2 text-sm text-[hsl(var(--color-text-primary))] outline-none resize-y"
                      />
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                          <input
                            type="checkbox"
                            checked={step.isRequired}
                            onChange={e => updateStep(i, 'isRequired', e.target.checked)}
                            className="rounded border-[hsl(var(--color-border))]"
                          />
                          Required
                        </label>
                        <Input
                          type="number"
                          value={step.price ?? ''}
                          onChange={e => updateStep(i, 'price', e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="Price"
                          className="w-32"
                        />
                      </div>
                    </div>
                    <button onClick={() => removeStep(i)} className="mt-1 text-[hsl(var(--color-text-muted))] hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Eligibility — Status verification</h2>
            {parsed.statusItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <Input
                    value={item.title}
                    onChange={e => updateEligibility('statusItems', i, 'title', e.target.value)}
                    placeholder="Item title"
                  />
                  <textarea
                    value={item.description}
                    onChange={e => updateEligibility('statusItems', i, 'description', e.target.value)}
                    rows={2}
                    placeholder="Description"
                    className="w-full rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] px-3 py-2 text-sm text-[hsl(var(--color-text-primary))] outline-none resize-y"
                  />
                </div>
                <button onClick={() => removeEligibility('statusItems', i)} className="mt-1 text-[hsl(var(--color-text-muted))] hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">Eligibility — Mandatory documents</h2>
            {parsed.documentItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <Input
                    value={item.title}
                    onChange={e => updateEligibility('documentItems', i, 'title', e.target.value)}
                    placeholder="Item title"
                  />
                  <textarea
                    value={item.description}
                    onChange={e => updateEligibility('documentItems', i, 'description', e.target.value)}
                    rows={2}
                    placeholder="Description"
                    className="w-full rounded-xl bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] px-3 py-2 text-sm text-[hsl(var(--color-text-primary))] outline-none resize-y"
                  />
                </div>
                <button onClick={() => removeEligibility('documentItems', i)} className="mt-1 text-[hsl(var(--color-text-muted))] hover:text-red-400">
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
