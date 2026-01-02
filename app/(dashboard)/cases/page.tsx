'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { addCase } from '@/app/actions/cases'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Case, Client, Status, User } from '@/types/database'

interface CaseWithRelations extends Case {
  clients?: Client
  status?: Status
  users?: User
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
  const [filters, setFilters] = useState({
    caseCode: '',
    clientName: '',
    status: '',
  })

  const supabase = createClient()
  const tableRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetchCases()
  }, [])

  useEffect(() => {
    if (isModalOpen) {
      if (clients.length === 0) fetchClients()
      if (statuses.length === 0) fetchStatuses()
      if (users.length === 0) fetchUsers()
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

  const fetchCases = async () => {
    setLoading(true)
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
        users (
          id,
          display_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .range(0, CASES_PER_PAGE - 1)

    if (error) {
      console.error('Error fetching cases:', error)
    } else {
      setCases(data || [])
      setHasMore((data?.length || 0) === CASES_PER_PAGE)
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
        users (
          id,
          display_name,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error loading more cases:', error)
    } else {
      setCases([...cases, ...(data || [])])
      setHasMore((data?.length || 0) === CASES_PER_PAGE)
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
    if (!filters.caseCode && !filters.clientName && !filters.status) {
      return true
    }

    const matchesCaseCode = !filters.caseCode || caseItem.case_code?.toLowerCase().includes(filters.caseCode.toLowerCase())
    const clientFullName = `${caseItem.clients?.first_name || ''} ${caseItem.clients?.last_name || ''}`.trim()
    const matchesClientName = !filters.clientName || 
      clientFullName.toLowerCase().includes(filters.clientName.toLowerCase()) ||
      caseItem.clients?.contact_email?.toLowerCase().includes(filters.clientName.toLowerCase())
    const matchesStatus = !filters.status || caseItem.status?.name?.toLowerCase().includes(filters.status.toLowerCase())

    return matchesCaseCode && matchesClientName && matchesStatus
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
              Assign To
            </label>
            <Select
              options={users.map(u => ({ 
                id: u.id, 
                label: u.display_name || u.email 
              }))}
              value={selectedAssignee}
              onChange={setSelectedAssignee}
              placeholder="Select user..."
              searchPlaceholder="Search users..."
            />
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

      <Card>
        <CardHeader>
          <CardTitle>All Cases ({filteredCases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-[hsl(var(--color-text-secondary))]">Loading cases...</p>
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[hsl(var(--color-text-secondary))]">
                No cases yet. Click "Add Case" to get started.
              </p>
            </div>
          ) : (
            <div ref={tableRef} className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
              <table className="w-full">
                <thead className="sticky top-0 bg-[hsl(var(--color-surface))] z-10">
                  <tr className="border-b border-[hsl(var(--color-border))]">
                    <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium w-24">
                      
                    </th>
                    <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium">
                      <div className="space-y-2">
                        <div>Case Code</div>
                        <Input
                          placeholder="Search..."
                          value={filters.caseCode}
                          onChange={(e) => setFilters({ ...filters, caseCode: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </th>
                    <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium">
                      <div className="space-y-2">
                        <div>Client</div>
                        <Input
                          placeholder="Search..."
                          value={filters.clientName}
                          onChange={(e) => setFilters({ ...filters, clientName: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </th>
                    <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium">
                      <div className="space-y-2">
                        <div>Status</div>
                        <Input
                          placeholder="Search..."
                          value={filters.status}
                          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </th>
                    <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium">
                      Assigned To
                    </th>
                    <th className="text-left p-4 text-[hsl(var(--color-text-secondary))] font-medium">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((caseItem) => (
                    <tr
                      key={caseItem.id}
                      className="border-b border-[hsl(var(--color-border))] hover:bg-[hsl(var(--color-surface-hover))] transition-colors"
                    >
                      <td className="p-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => router.push(`/cases/${caseItem.case_code || caseItem.id}`)}
                        >
                          Open
                        </Button>
                      </td>
                      <td className="p-4 text-[hsl(var(--color-text-primary))] font-mono">
                        {caseItem.case_code || '-'}
                      </td>
                      <td className="p-4 text-[hsl(var(--color-text-primary))]">
                        {getClientDisplayName(caseItem.clients)}
                        {caseItem.clients?.client_code && (
                          <span className="text-xs text-[hsl(var(--color-text-secondary))] ml-2">
                            ({caseItem.clients.client_code})
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {caseItem.status ? (
                          <span className="px-2 py-1 rounded text-xs bg-[hsl(var(--color-primary))]/10 text-[hsl(var(--color-primary))]">
                            {caseItem.status.name}
                          </span>
                        ) : (
                          <span className="text-[hsl(var(--color-text-secondary))]">-</span>
                        )}
                      </td>
                      <td className="p-4 text-[hsl(var(--color-text-primary))]">
                        {caseItem.users?.display_name || caseItem.users?.email || '-'}
                      </td>
                      <td className="p-4 text-[hsl(var(--color-text-secondary))] text-sm">
                        {new Date(caseItem.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loadingMore && (
                <div className="text-center py-4">
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">Loading more...</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
