'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { addCase } from '@/app/actions/cases'
import { getAllServices } from '@/app/actions/services'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, useDeepPrefetchCases, usePrefetchCasePage } from '@/lib/query'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Case, Client, Status, User } from '@/types/database'

interface CaseWithRelations extends Case {
  clients?: Client
  status?: Status
  csr?: User
  legal?: User
  case_services?: Array<{ services?: { name: string } }>
}

const CASES_PER_PAGE = 20

export default function CasesPage() {
  const [cases, setCases] = useState<CaseWithRelations[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('')
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [selectedService, setSelectedService] = useState<string>('')
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })
  const [stepNames, setStepNames] = useState<Record<string, string>>({})

  const supabase = createClient()
  const tableRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const goCase = (href: string) => router.push(href)
  const queryClient = useQueryClient()
  const prefetchCaseDetails = useDeepPrefetchCases()
  const prefetchCase = usePrefetchCasePage()

  useEffect(() => {
    const cached = queryClient.getQueryData<CaseWithRelations[]>(queryKeys.cases)
    if (cached && cached.length > 0) {
      setCases(cached)
      setHasMore(cached.length >= CASES_PER_PAGE)
      setLoading(false)
      fetchStepNames(cached)
      fetchCases(true) // background refresh
      prefetchCaseDetails(cached)
    } else {
      fetchCases()
    }
  }, [])

  useEffect(() => {
    if (isModalOpen) {
      if (clients.length === 0) fetchClients()
      if (statuses.length === 0) fetchStatuses()
      if (users.length === 0) fetchUsers()
      if (services.length === 0) {
        // For now only "TRC Full service" is offered at case creation
        getAllServices().then(list => {
          const allowed = list.filter(s => s.name === 'TRC Full service')
          setServices(allowed)
          if (allowed.length === 1) setSelectedService(allowed[0].id)
        })
      }
    }
  }, [isModalOpen])

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setClients(data)
  }

  const fetchStatuses = async () => {
    const { data } = await supabase
      .from('status')
      .select('*')
      .order('position', { ascending: true })
    
    if (data) setStatuses(data)
  }

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('display_name', { ascending: true })
    
    if (data) setUsers(data)
  }

  // Batched lookup of current-step names for a page of cases
  const fetchStepNames = async (list: CaseWithRelations[]) => {
    const ids = [...new Set(list.map(c => c.current_step_id).filter(Boolean))] as string[]
    if (ids.length === 0) return
    const { data } = await supabase.from('case_steps').select('id, name').in('id', ids)
    if (!data) return
    setStepNames(prev => {
      const next = { ...prev }
      for (const s of data) next[s.id] = s.name
      return next
    })
  }

  const fetchCases = async (background = false) => {
    if (!background) setLoading(true)
    const { data, error } = await supabase
      .from('cases')
      .select(`
        *,
        clients (
          id,
          client_code,
          first_name,
          last_name,
          contact_email
        ),
        status (
          id,
          name
        ),
        csr:users!cases_csr_id_fkey (
          id,
          display_name,
          email
        ),
        legal:users!cases_assigned_to_fkey (
          id,
          display_name,
          email
        ),
        case_services:case_services!case_id (
          services (
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .range(0, CASES_PER_PAGE - 1)

    if (error) {
      console.error('Error fetching cases:', error)
    } else {
      const list = data || []
      setCases(list)
      queryClient.setQueryData(queryKeys.cases, list)
      setHasMore(list.length === CASES_PER_PAGE)
      fetchStepNames(list)
      if (!background) prefetchCaseDetails(list)
    }
    setLoading(false)
  }

  const loadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    const from = cases.length
    const to = from + CASES_PER_PAGE - 1

    const { data, error } = await supabase
      .from('cases')
      .select(`
        *,
        clients (
          id,
          client_code,
          first_name,
          last_name,
          contact_email
        ),
        status (
          id,
          name
        ),
        csr:users!cases_csr_id_fkey (
          id,
          display_name,
          email
        ),
        legal:users!cases_assigned_to_fkey (
          id,
          display_name,
          email
        ),
        case_services:case_services!case_id (
          services (
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error loading more cases:', error)
    } else {
      setCases([...cases, ...(data || [])])
      setHasMore((data?.length || 0) === CASES_PER_PAGE)
      fetchStepNames(data || [])
    }
    setLoadingMore(false)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (!tableRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = tableRef.current
      if (scrollHeight - scrollTop <= clientHeight * 1.2) {
        loadMore()
      }
    }

    const scrollElement = tableRef.current
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll)
      return () => scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [cases, loadingMore, hasMore])

  const filteredCases = cases.filter((caseItem) => {
    if (!filters.search && !filters.status) {
      return true
    }

    const q = filters.search.toLowerCase()
    const clientFullName = `${caseItem.clients?.first_name || ''} ${caseItem.clients?.last_name || ''}`.trim()
    const service = caseItem.case_services?.map(cs => cs.services?.name).filter(Boolean).join(', ') || ''
    const step = (caseItem.current_step_id && stepNames[caseItem.current_step_id]) || ''
    const matchesSearch = !q ||
      caseItem.case_code?.toLowerCase().includes(q) ||
      clientFullName.toLowerCase().includes(q) ||
      caseItem.clients?.contact_email?.toLowerCase().includes(q) ||
      service.toLowerCase().includes(q) ||
      step.toLowerCase().includes(q)
    const matchesStatus = !filters.status || caseItem.status?.name?.toLowerCase().includes(filters.status.toLowerCase())

    return matchesSearch && matchesStatus
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!selectedClient) {
      setError('Please select a client')
      setIsSubmitting(false)
      return
    }

    const formData = new FormData()
    formData.set('clientId', selectedClient)
    if (selectedStatus) formData.set('statusId', selectedStatus)
    if (selectedAssignee) formData.set('assignedTo', selectedAssignee)
    if (selectedService) formData.set('serviceId', selectedService)

    const result = await addCase(formData)

    if (result?.error) {
      setError(result.error)
      setIsSubmitting(false)
    } else {
      setIsModalOpen(false)
      setIsSubmitting(false)
      setSelectedClient('')
      setSelectedStatus('')
      setSelectedAssignee('')
      fetchCases()
    }
  }

  const getClientDisplayName = (client?: Client) => {
    if (!client) return 'Unknown Client'
    if (client.first_name && client.last_name) {
      return `${client.first_name} ${client.last_name}`
    }
    if (client.first_name) return client.first_name
    if (client.last_name) return client.last_name
    if (client.contact_email) return client.contact_email
    return 'Unnamed Client'
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Cases"
        subtitle="Manage client cases and track their progress"
        icon={
          <svg className="w-6 h-6 text-[hsl(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
        action={{
          label: 'Add Case',
          onClick: () => setIsModalOpen(true),
          icon: <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        }}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Case">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Client
            </label>
            <Select
              options={clients.map(c => ({ 
                id: c.id, 
                label: `${c.first_name || ''} ${c.last_name || ''} ${c.contact_email || ''}`.trim() || 'Unnamed Client'
              }))}
              value={selectedClient}
              onChange={setSelectedClient}
              placeholder="Select client..."
              searchPlaceholder="Search clients..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Service
            </label>
            <Select
              options={services.map(s => ({ id: s.id, label: s.name }))}
              value={selectedService}
              onChange={setSelectedService}
              placeholder="Select service..."
              searchPlaceholder="Search services..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Status
            </label>
            <Select
              options={statuses.map(s => ({ id: s.id, label: s.name }))}
              value={selectedStatus}
              onChange={setSelectedStatus}
              placeholder="Select status..."
              searchPlaceholder="Search statuses..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-2">
              Legal rep
            </label>
            <Select
              options={users.map(u => ({ 
                id: u.id, 
                label: u.display_name || u.email 
              }))}
              value={selectedAssignee}
              onChange={setSelectedAssignee}
              placeholder="Assign lawyer..."
              searchPlaceholder="Search users..."
            />
            <p className="text-[11px] text-[hsl(var(--color-text-muted))] mt-1.5">
              You'll be the customer success rep automatically
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Case'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Search + status filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--color-text-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Search cases..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10 bg-[hsl(var(--color-surface))]"
          />
        </div>
        <Input
          placeholder="Status..."
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="w-28 sm:w-36 bg-[hsl(var(--color-surface))]"
        />
      </div>

      {/* Cases list — same row format on all breakpoints */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-[hsl(var(--color-text-secondary))]">Loading cases...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[hsl(var(--color-text-secondary))]">
            No cases yet. Add one to get started.
          </p>
        </div>
      ) : (
        <div ref={tableRef} className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin">
          {filteredCases.map((caseItem) => {
            const service = caseItem.case_services?.map(cs => cs.services?.name).filter(Boolean).join(', ')
            const step = caseItem.current_step_id ? stepNames[caseItem.current_step_id] : null
            const csrName = caseItem.csr?.display_name || caseItem.csr?.email
            const legalName = caseItem.legal?.display_name || caseItem.legal?.email
            return (
              <div
                key={caseItem.id}
                onClick={() => goCase(`/cases/${caseItem.case_code || caseItem.id}`)}
                onMouseEnter={() => { prefetchCase(caseItem.id); router.prefetch(`/cases/${caseItem.case_code || caseItem.id}`) }}
                onTouchStart={() => { prefetchCase(caseItem.id); router.prefetch(`/cases/${caseItem.case_code || caseItem.id}`) }}
                className="p-4 bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-xl hover:bg-[hsl(var(--color-surface-hover))] transition-colors active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
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
                    <p className="text-xs text-[hsl(var(--color-text-muted))] mt-0.5 truncate">
                      {getClientDisplayName(caseItem.clients)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {caseItem.status && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[hsl(var(--color-primary))]/10 text-[hsl(var(--color-primary))]">
                        {caseItem.status.name}
                      </span>
                    )}
                    <svg className="w-5 h-5 text-[hsl(var(--color-text-muted))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            )
          })}
          {loadingMore && (
            <div className="text-center py-4">
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">Loading more...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
