'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [selectedService, setSelectedService] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedLegal, setSelectedLegal] = useState('')
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
      setServices(list)
      if (list.length === 1) setSelectedService(list[0].id)
    })
    createClient()
      .from('users')
      .select('*')
      .order('display_name', { ascending: true })
      .then(({ data }) => { if (data) setUsers(data) })
  }, [])

  const handleAddCase = async () => {
    setSubmitting(true)
    const formData = new FormData()
    formData.set('clientId', clientId)
    if (selectedService) formData.set('serviceId', selectedService)
    if (selectedLegal) formData.set('assignedTo', selectedLegal)

    const result = await addCase(formData)

    if (!result?.error && result?.caseData) {
      // Optimistically add the case to the local state
      const newCase: CaseWithStatus = {
        ...result.caseData,
        status: { name: 'New' } as Status,
        case_services: [{ services: { name: services.find(s => s.id === selectedService)?.name || '' } }]
      }
      onCaseAdded(newCase)
      // Refresh so the optimistic row gets replaced by the real row with rep names
      window.dispatchEvent(new CustomEvent('nexus:client-data-changed', { detail: { clientId } }))
      setIsModalOpen(false)
    } else {
      console.error('Error creating case:', result?.error)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Case">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Service
            </label>
            {services.length === 0 ? (
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">No service available</p>
            ) : (
              <Select
                options={services.map(s => ({ id: s.id, label: s.name }))}
                value={selectedService}
                onChange={setSelectedService}
                placeholder="Select service..."
                searchPlaceholder="Search services..."
              />
            )}
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
          <Button
            onClick={handleAddCase}
            disabled={submitting || !selectedService}
            className="w-full"
          >
            {submitting ? 'Creating...' : 'Create Case'}
          </Button>
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
            const service = caseItem.case_services?.map(cs => cs.services?.name).filter(Boolean).join(', ')
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
