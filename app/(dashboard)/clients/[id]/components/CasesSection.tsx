'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { addCase } from '@/app/actions/cases'
import { getAllServices } from '@/app/actions/services'
import { createClient } from '@/lib/supabase/client'
import { usePaneNavigate } from '@/lib/panes'
import { usePrefetchCasePage } from '@/lib/query'
import type { Case, Status, User } from '@/types/database'

interface CaseWithStatus extends Case {
  status?: Status
  csr?: User
  legal?: User
  case_services?: Array<{
    services?: {
      name: string
    }
  }>
}

interface CasesSectionProps {
  clientId: string
  cases: CaseWithStatus[]
  onCaseAdded: (newCase: CaseWithStatus) => void
}

export function CasesSection({ clientId, cases, onCaseAdded }: CasesSectionProps) {
  const paneNav = usePaneNavigate()
  const prefetchCase = usePrefetchCasePage()
  const [submitting, setSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [services, setServices] = useState<{ id: string; name: string; migrated?: boolean }[]>([])
  const [selectedService, setSelectedService] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedLegal, setSelectedLegal] = useState('')
  const [modalStep, setModalStep] = useState<'details' | 'custom'>('details')
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customSteps, setCustomSteps] = useState<string[]>([''])
  const [error, setError] = useState<string | null>(null)
  const [stepNames, setStepNames] = useState<Record<string, string>>({})

  // Fetch active step names for the listed cases
  useEffect(() => {
    const ids = [...new Set(cases.map(c => c.current_step_id).filter(Boolean))] as string[]
    if (ids.length === 0) return
    createClient()
      .from('case_steps')
      .select('id, name')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, string> = {}
        for (const s of data) map[s.id] = s.name
        setStepNames(map)
      })
  }, [cases])

  useEffect(() => {
    getAllServices().then(list => {
      const migrated = (list || []).filter(s => s.migrated)
      setServices(migrated)
      if (migrated.length === 1) setSelectedService(migrated[0].id)
    })
    createClient()
      .from('users')
      .select('*')
      .order('display_name', { ascending: true })
      .then(({ data }) => { if (data) setUsers(data) })
  }, [])

  const handleAddCase = async () => {
    setError(null)
    if (selectedService === 'custom') {
      if (!customName.trim()) {
        setError('Please enter a service name')
        return
      }
      if (!customSteps.some(s => s.trim())) {
        setError('Please add at least one step')
        return
      }
    }
    setSubmitting(true)
    const formData = new FormData()
    formData.set('clientId', clientId)
    if (selectedService) formData.set('serviceId', selectedService)
    if (selectedLegal) formData.set('assignedTo', selectedLegal)
    if (selectedService === 'custom') {
      formData.set('customServiceName', customName.trim())
      if (customPrice.trim()) formData.set('customPrice', customPrice.trim())
      formData.set('customSteps', JSON.stringify(customSteps))
    }

    const result = await addCase(formData)

    if (!result?.error && result?.caseData) {
      // Optimistically add the case to the local state
      const newCase: CaseWithStatus = {
        ...result.caseData,
        status: { name: 'New' } as Status,
        case_services: [{ services: { name: selectedService === 'custom' ? customName.trim() : (services.find(s => s.id === selectedService)?.name || '') } }]
      }
      onCaseAdded(newCase)
      // Refresh so the optimistic row gets replaced by the real row with rep names
      window.dispatchEvent(new CustomEvent('nexus:client-data-changed', { detail: { clientId } }))
      setIsModalOpen(false)
      setSelectedService('')
      setModalStep('details')
      setCustomName('')
      setCustomPrice('')
      setCustomSteps([''])
    } else {
      console.error('Error creating case:', result?.error)
      setError(result?.error || 'Failed to create case')
    }
    setSubmitting(false)
  }

  return (
    <div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Case">
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
              {error}
            </div>
          )}

          {modalStep === 'details' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                  Service
                </label>
                <Select
                  options={[...services.map(s => ({ id: s.id, label: s.name })), { id: 'custom', label: 'Custom' }]}
                  value={selectedService}
                  onChange={setSelectedService}
                  placeholder="Select service..."
                  searchPlaceholder="Search services..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                  Legal rep
                </label>
                <Select
                  options={users.map(u => ({ id: u.id, label: u.display_name || u.email }))}
                  value={selectedLegal}
                  onChange={setSelectedLegal}
                  placeholder="Assign lawyer..."
                  searchPlaceholder="Search users..."
                />
                <p className="text-[11px] text-[hsl(var(--color-text-muted))] mt-1.5">
                  You'll be the customer success rep automatically
                </p>
              </div>
              {selectedService === 'custom' ? (
                <Button
                  onClick={() => { setError(null); setModalStep('custom') }}
                  className="w-full"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleAddCase}
                  disabled={submitting || !selectedService}
                  className="w-full"
                >
                  {submitting ? 'Creating...' : 'Create Case'}
                </Button>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                  Service name
                </label>
                <Input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="e.g. Custom legal support"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                  Approximate value (PLN)
                </label>
                <Input
                  type="number"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
                  Workflow steps
                </label>
                <div className="space-y-2">
                  {['Pre-sale', 'Consultation'].map(name => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-hover))] px-3 py-2.5 text-sm text-[hsl(var(--color-text-secondary))]"
                    >
                      <span className="flex-1">{name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--color-text-muted))]">auto</span>
                    </div>
                  ))}
                  {customSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={step}
                        onChange={e => {
                          const next = [...customSteps]
                          next[i] = e.target.value
                          setCustomSteps(next)
                        }}
                        placeholder={`Custom step ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => setCustomSteps(customSteps.filter((_, j) => j !== i))}
                        className="text-[hsl(var(--color-text-muted))] hover:text-red-400 shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomSteps([...customSteps, ''])}
                    className="w-full"
                  >
                    + Add step
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setModalStep('details')}
                  disabled={submitting}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleAddCase}
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Creating...' : 'Create Case'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">Cases</h2>
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          + Add Case
        </Button>
      </div>
      {cases.length === 0 ? (
        <p className="text-[hsl(var(--color-text-secondary))] text-center py-8">No cases yet for this client</p>
      ) : (
        <div className="space-y-2">
          {cases.map((caseItem) => {
            const service = caseItem.case_services?.map(cs => cs.services?.name).filter(Boolean).join(', ') || caseItem.custom_service_name
            const step = caseItem.current_step_id ? stepNames[caseItem.current_step_id] : null
            const csrName = caseItem.csr?.display_name || caseItem.csr?.email
            const legalName = caseItem.legal?.display_name || caseItem.legal?.email
            const href = `/cases/${caseItem.case_code || caseItem.id}`
            return (
              <Link
                key={caseItem.id}
                href={href}
                onClick={(e) => { if (paneNav(href)) e.preventDefault() }}
                onMouseEnter={() => prefetchCase(caseItem.id)}
                onTouchStart={() => prefetchCase(caseItem.id)}
                className="flex items-center gap-3 rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3.5 hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))] truncate">
                      {service || caseItem.case_code || 'Case'}
                    </p>
                    <span className="text-xs text-[hsl(var(--color-text-muted))] shrink-0">
                      {new Date(caseItem.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <p className="text-xs text-[hsl(var(--color-text-secondary))] truncate">
                      {step || 'No step'}
                    </p>
                    <p className="text-xs text-[hsl(var(--color-text-muted))] truncate shrink-0">
                      {csrName || 'No CSR'} · {legalName || 'No LGL'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[hsl(var(--color-text-muted))] shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
