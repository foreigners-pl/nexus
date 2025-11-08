'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Modal } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { updateCase, deleteCase } from '@/app/actions/cases'
import type { Case, Client, Status, User } from '@/types/database'

interface CasePageProps {
  params: Promise<{ id: string }>
}

export default function CasePage({ params }: CasePageProps) {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [assignedUser, setAssignedUser] = useState<User | null>(null)
  const [statuses, setStatuses] = useState<Status[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [isEditingAssignee, setIsEditingAssignee] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchCaseData()
  }, [params])

  useEffect(() => {
    if (isEditingStatus && statuses.length === 0) {
      fetchStatuses()
    }
  }, [isEditingStatus])

  useEffect(() => {
    if (isEditingAssignee && users.length === 0) {
      fetchUsers()
    }
  }, [isEditingAssignee])

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

  async function fetchCaseData() {
    const { id } = await params
    setLoading(true)

    let caseResult, caseError
    
    if (id.startsWith('C')) {
      const result = await supabase
        .from('cases')
        .select('*')
        .eq('case_code', id)
        .single()
      
      caseResult = result.data
      caseError = result.error
    } else {
      const result = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .single()
      
      caseResult = result.data
      caseError = result.error
    }

    if (caseError || !caseResult) {
      console.error('Error fetching case:', caseError)
      setLoading(false)
      return
    }

    setCaseData(caseResult)

    if (caseResult.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', caseResult.client_id)
        .single()
      
      if (clientData) setClient(clientData)
    }

    if (caseResult.status_id) {
      const { data: statusData } = await supabase
        .from('status')
        .select('*')
        .eq('id', caseResult.status_id)
        .single()
      
      if (statusData) setStatus(statusData)
    }

    if (caseResult.assigned_to) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', caseResult.assigned_to)
        .single()
      
      if (userData) setAssignedUser(userData)
    }

    setLoading(false)
  }

  const handleUpdateStatus = async (newStatusId: string) => {
    if (!caseData) return

    const formData = new FormData()
    formData.set('caseId', caseData.id)
    formData.set('statusId', newStatusId)

    const result = await updateCase(formData)

    if (!result?.error) {
      setIsEditingStatus(false)
      fetchCaseData()
    }
  }

  const handleUpdateAssignee = async (newUserId: string) => {
    if (!caseData) return

    const formData = new FormData()
    formData.set('caseId', caseData.id)
    formData.set('assignedTo', newUserId)

    const result = await updateCase(formData)

    if (!result?.error) {
      setIsEditingAssignee(false)
      fetchCaseData()
    }
  }

  const handleDelete = async () => {
    if (!caseData) return

    setSubmitting(true)
    const result = await deleteCase(caseData.id)

    if (!result?.error) {
      router.push('/cases')
    } else {
      setSubmitting(false)
    }
  }

  const getClientDisplayName = (client: Client | null) => {
    if (!client) return 'Unknown Client'
    if (client.first_name && client.last_name) {
      return `${client.first_name} ${client.last_name}`
    }
    if (client.first_name) return client.first_name
    if (client.last_name) return client.last_name
    if (client.contact_email) return client.contact_email
    return 'Unnamed Client'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[hsl(var(--color-text-secondary))]">Loading case...</p>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[hsl(var(--color-text-secondary))]">Case not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--color-text-primary))]">
            {getClientDisplayName(client)}
          </h1>
          {caseData.case_code && (
            <p className="text-[hsl(var(--color-text-secondary))] mt-1 font-mono">
              {caseData.case_code}
            </p>
          )}
          <p className="text-[hsl(var(--color-text-secondary))] text-sm mt-2">
            Created {new Date(caseData.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push('/cases')}
          >
            Back to Cases
          </Button>
          {client && (
            <Button
              variant="outline"
              onClick={() => router.push(`/clients/${client.client_code || client.id}`)}
            >
              View Client
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => setIsDeleteModalOpen(true)}
            className="text-red-500 hover:bg-red-500/10"
          >
            Delete Case
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Case"
      >
        <div className="space-y-4">
          <p className="text-[hsl(var(--color-text-secondary))]">
            Are you sure you want to delete this case? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {submitting ? 'Deleting...' : 'Delete Case'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Case Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">
                  Client
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-[hsl(var(--color-text-primary))]">
                    {getClientDisplayName(client)}
                  </p>
                  {client?.client_code && (
                    <span className="text-xs text-[hsl(var(--color-text-secondary))] font-mono">
                      ({client.client_code})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">
                  Status
                </label>
                {isEditingStatus ? (
                  <div className="flex gap-2">
                    <Select
                      options={statuses.map(s => ({ id: s.id, label: s.name }))}
                      value={caseData.status_id || ''}
                      onChange={(value) => {
                        handleUpdateStatus(value)
                      }}
                      placeholder="Select status..."
                      searchPlaceholder="Search statuses..."
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingStatus(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {status ? (
                      <span className="px-2 py-1 rounded text-sm bg-[hsl(var(--color-primary))]/10 text-[hsl(var(--color-primary))]">
                        {status.name}
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--color-text-secondary))]">No status</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingStatus(true)}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[hsl(var(--color-text-secondary))] mb-1">
                  Assigned To
                </label>
                {isEditingAssignee ? (
                  <div className="flex gap-2">
                    <Select
                      options={users.map(u => ({ 
                        id: u.id, 
                        label: u.display_name || u.email 
                      }))}
                      value={caseData.assigned_to || ''}
                      onChange={(value) => {
                        handleUpdateAssignee(value)
                      }}
                      placeholder="Select user..."
                      searchPlaceholder="Search users..."
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingAssignee(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-[hsl(var(--color-text-primary))]">
                      {assignedUser?.display_name || assignedUser?.email || 'Unassigned'}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingAssignee(true)}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-[hsl(var(--color-text-secondary))]">
                  Document management coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-[hsl(var(--color-text-secondary))] text-sm">
                  Activity timeline coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}