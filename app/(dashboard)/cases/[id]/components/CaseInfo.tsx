'use client'

import { useState, useEffect, useRef } from 'react'
import { Select } from '@/components/ui/Select'
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
  const [isAssigneesOpen, setIsAssigneesOpen] = useState(false)
  const assigneesRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchStatuses()
    fetchUsers()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assigneesRef.current && !assigneesRef.current.contains(event.target as Node)) {
        setIsAssigneesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleToggleAssignee = async (userId: string) => {
    const existingAssignee = assignees.find(a => a.user_id === userId)
    
    if (existingAssignee) {
      await removeAssigneeFromCase(existingAssignee.id, caseData.id)
    } else {
      await addAssigneeToCase(caseData.id, userId)
    }
    onAssigneesUpdate()
  }

  const isUserAssigned = (userId: string) => {
    return assignees.some(a => a.user_id === userId)
  }

  const getAssigneesDisplayText = () => {
    if (assignees.length === 0) return 'Select assignees...'
    if (assignees.length === 1) return assignees[0].users?.display_name || assignees[0].users?.email || '1 assignee'
    return `${assignees.length} assignees`
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
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Client</label>
          <p className="text-sm text-[hsl(var(--color-text-primary))] font-medium">{getClientDisplayName()}</p>
          {client?.client_code && (
            <p className="text-xs text-[hsl(var(--color-text-secondary))] font-mono mt-1">{client.client_code}</p>
          )}
        </div>

        {/* Center-Left: Status */}
        <div className="px-6">
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Status</label>
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
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Due Date</label>
          <input
            type="date"
            value={caseData.due_date || ''}
            onChange={(e) => handleUpdateDueDate(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] rounded-xl text-[hsl(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-border-hover))] hover:border-[hsl(var(--color-border-hover))] hover:bg-[hsl(var(--color-surface-hover))] transition-all duration-200"
          />
        </div>

        {/* Right: Assignees */}
        <div className="pl-6">
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Assignees</label>
          <div ref={assigneesRef} className="relative">
            <button
              type="button"
              onClick={() => setIsAssigneesOpen(!isAssigneesOpen)}
              className="w-full px-4 py-2.5 text-left bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] rounded-xl hover:border-[hsl(var(--color-border-hover))] hover:bg-[hsl(var(--color-surface-hover))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-border-hover))] text-[hsl(var(--color-text-primary))] transition-all duration-200 flex items-center justify-between"
            >
              <span className={assignees.length > 0 ? 'text-[hsl(var(--color-text-primary))]' : 'text-[hsl(var(--color-text-muted))]'}>
                {getAssigneesDisplayText()}
              </span>
              <svg className={`w-4 h-4 text-[hsl(var(--color-text-muted))] transition-transform duration-200 ${isAssigneesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isAssigneesOpen && (
              <div className="absolute z-[9999] w-full mt-2 bg-[hsl(var(--color-surface))] backdrop-blur-xl border border-[hsl(var(--color-border))] rounded-xl shadow-[0_10px_40px_rgb(0_0_0/0.4)] max-h-60 overflow-y-auto p-1">
                {users.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))] text-center">No users available</div>
                ) : (
                  users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleToggleAssignee(user.id)}
                      className="w-full px-4 py-2.5 text-left text-sm rounded-lg transition-all duration-150 flex items-center gap-3 hover:bg-[hsl(var(--color-surface-hover))]"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isUserAssigned(user.id) 
                          ? 'bg-[hsl(var(--color-primary))] border-[hsl(var(--color-primary))]' 
                          : 'border-[hsl(var(--color-border))]'
                      }`}>
                        {isUserAssigned(user.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[hsl(var(--color-text-primary))]">{user.display_name || user.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}