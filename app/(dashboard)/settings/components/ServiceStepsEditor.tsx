'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getAllServices } from '@/app/actions/services'
import { getServiceSteps, saveServiceSteps } from '@/app/actions/workflow'
import { ArrowUp, ArrowDown, Trash2, Plus, Layers } from 'lucide-react'

interface StepRow {
  name: string
  is_required: boolean
}

export function ServiceStepsEditor() {
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [serviceId, setServiceId] = useState<string>('')
  const [steps, setSteps] = useState<StepRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getAllServices().then(list => {
      setServices(list)
      if (list.length > 0) setServiceId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!serviceId) return
    setLoading(true)
    setMessage(null)
    getServiceSteps(serviceId).then(({ steps }) => {
      setSteps(steps.map(s => ({ name: s.name, is_required: s.is_required })))
      setLoading(false)
    })
  }, [serviceId])

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    setSteps(prev => {
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    const result = await saveServiceSteps(serviceId, steps)
    setMessage(result.error
      ? { type: 'error', text: result.error }
      : { type: 'success', text: 'Step template saved — new cases will use it' })
    setSaving(false)
    setTimeout(() => setMessage(null), 4000)
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">Service Steps</h3>
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">
              The stages each service goes through — copied onto new cases automatically
            </p>
          </div>
        </div>

        <select
          value={serviceId}
          onChange={e => setServiceId(e.target.value)}
          className="w-full h-10 px-3 mb-4 rounded-lg bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] text-sm text-[hsl(var(--color-text-primary))] outline-none"
        >
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {loading ? (
          <p className="text-sm text-[hsl(var(--color-text-secondary))] py-4 text-center">Loading…</p>
        ) : (
          <div className="space-y-2">
            {steps.length === 0 && (
              <p className="text-sm text-[hsl(var(--color-text-muted))] py-3 text-center">
                No steps defined — add the stages this service goes through
              </p>
            )}
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--color-surface-secondary))] border border-[hsl(var(--color-border))]"
              >
                <span className="text-xs text-[hsl(var(--color-text-muted))] w-5 text-center shrink-0">
                  {i + 1}
                </span>
                <input
                  value={step.name}
                  onChange={e => setSteps(prev => prev.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
                  placeholder="Step name"
                  className="flex-1 min-w-0 h-8 px-2 rounded bg-transparent text-sm text-[hsl(var(--color-text-primary))] outline-none"
                />
                <label className="flex items-center gap-1.5 text-xs text-[hsl(var(--color-text-secondary))] shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!step.is_required}
                    onChange={e => setSteps(prev => prev.map((s, j) => j === i ? { ...s, is_required: !e.target.checked } : s))}
                    className="w-4 h-4"
                  />
                  optional
                </label>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-[hsl(var(--color-text-muted))] disabled:opacity-30">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="p-1.5 text-[hsl(var(--color-text-muted))] disabled:opacity-30">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))}
                  className="p-1.5 text-red-400/70 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setSteps(prev => [...prev, { name: '', is_required: true }])}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--color-text-secondary))] hover:text-[hsl(var(--color-text-primary))]"
            >
              <Plus className="w-4 h-4" /> Add step
            </button>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={save} disabled={saving || steps.some(s => !s.name.trim())}>
                {saving ? 'Saving…' : 'Save template'}
              </Button>
              {message && (
                <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {message.text}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
