'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { updateCase } from '@/app/actions/cases'
import { addAssigneeToCase, removeAssigneeFromCase } from '@/app/actions/assignees'
import type { Case, Client, Status, User } from '@/types/database'

interface AssigneeWithUser {
  id: string
  user_id: string
  users?: User
}

interface CaseInfoProps {
  caseData: Case
  client: Client | null
  status: Status | null
  assignees: AssigneeWithUser[]
  onUpdate: () => void
  onAssigneesUpdate: () => void
}

export function CaseInfo({ caseData, client, status, assignees, onUpdate, onAssigneesUpdate }: CaseInfoProps) {
  const [statuses, setStatuses] = useState<Status[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isAddAssigneeModalOpen, setIsAddAssigneeModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchStatuses()
  }, [])

  useEffect(() => {
    if (isAddAssigneeModalOpen && users.length === 0) {
      fetchUsers()
    }
  }, [isAddAssigneeModalOpen])

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

  const handleUpdateStatus = async (newStatusId: string) => {
    const formData = new FormData()
    formData.set('caseId', caseData.id)
    formData.set('statusId', newStatusId)

    // Optimistically update the UI
    const newStatus = statuses.find(s => s.id === newStatusId)
    
    const result = await updateCase(formData)

    if (!result?.error) {
      // Only refetch case info if needed, status is already updated
      onUpdate()
    }
  }

  const handleUpdateDueDate = async (newDueDate: string) => {
    const formData = new FormData()
    formData.set('caseId', caseData.id)
    formData.set('dueDate', newDueDate)
    
    const result = await updateCase(formData)

    if (!result?.error) {
      onUpdate()
    }
  }

  const handleAddAssignee = async () => {
    if (!selectedUser) return

    setSubmitting(true)
    const result = await addAssigneeToCase(caseData.id, selectedUser)

    if (!result?.error) {
      setSelectedUser('')
      setIsAddAssigneeModalOpen(false)
      onAssigneesUpdate()
    }
    setSubmitting(false)
  }

  const handleRemoveAssignee = async (assigneeId: string) => {
    await removeAssigneeFromCase(assigneeId, caseData.id)
    onAssigneesUpdate()
  }

  const getClientDisplayName = () => {
    if (!client) return 'Unknown Client'
    if (client.first_name && client.last_name) return `${client.first_name} ${client.last_name}`
    if (client.first_name) return client.first_name
    if (client.last_name) return client.last_name
    if (client.contact_email) return client.contact_email
    return 'Unnamed Client'
  }

  return (
    <>
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--color-border))]">
        {/* Left: Client Info */}
        <div className="pr-6">
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Client</label>
          <p className="text-sm text-[hsl(var(--color-text-primary))] font-medium">{getClientDisplayName()}</p>
          {client?.client_code && (
            <p className="text-xs text-[hsl(var(--color-text-secondary))] font-mono mt-0.5">{client.client_code}</p>
          )}
        </div>

        {/* Center-Left: Status */}
        <div className="px-6">
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Status</label>
          <Select
            options={statuses.map(s => ({ id: s.id, label: s.name }))}
            value={caseData.status_id || ''}
            onChange={(value) => handleUpdateStatus(value)}
            placeholder="Select status..."
            searchPlaceholder="Search statuses..."
          />
        </div>

        {/* Center-Right: Due Date */}
        <div className="px-6">
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-1">Due Date</label>
          <input
            type="date"
            value={caseData.due_date || ''}
            onChange={(e) => handleUpdateDueDate(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-[hsl(var(--color-surface))] border border-[hsl(var(--color-border))] rounded-lg text-[hsl(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] transition-colors"
          />
        </div>

        {/* Right: Assignees */}
        <div className="pl-6">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))]">Assigned To</label>
            <Button size="sm" variant="ghost" onClick={() => setIsAddAssigneeModalOpen(true)} className="text-xs h-6 px-2">
              + Add
            </Button>
          </div>
          {assignees.length === 0 ? (
            <p className="text-[hsl(var(--color-text-secondary))] text-xs">No assignees</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {assignees.map((assignee) => (
                <div key={assignee.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[hsl(var(--color-border))] text-xs">
                  <span className="text-[hsl(var(--color-text-primary))]">{assignee.users?.display_name || assignee.users?.email}</span>
                  <button
                    onClick={() => handleRemoveAssignee(assignee.id)}
                    className="text-[hsl(var(--color-text-secondary))] hover:text-red-500 ml-0.5"
                    title="Remove assignee"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isAddAssigneeModalOpen} onClose={() => setIsAddAssigneeModalOpen(false)} title="Add Assignee">
        <div className="space-y-4">
          <Select
            options={users.filter(u => !assignees.some(a => a.user_id === u.id)).map(u => ({ id: u.id, label: u.display_name || u.email }))}
            value={selectedUser}
            onChange={setSelectedUser}
            placeholder="Select user..."
            searchPlaceholder="Search users..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsAddAssigneeModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleAddAssignee} disabled={submitting || !selectedUser}>
              {submitting ? 'Adding...' : 'Add Assignee'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}