'use client'

import { useState, useEffect } from 'react'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { updateCase } from '@/app/actions/cases'
import type { Case, Client, Status, User } from '@/types/database'

interface CaseInfoProps {
  caseData: Case
  client: Client | null
  status: Status | null
  onUpdate: () => void
}

export function CaseInfo({ caseData, client, status, onUpdate }: CaseInfoProps) {
  const [statuses, setStatuses] = useState<Status[]>([])
  const [users, setUsers] = useState<User[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchStatuses()
    fetchUsers()
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

  const update = async (fields: Record<string, string>) => {
    const formData = new FormData()
    formData.set('caseId', caseData.id)
    for (const [k, v] of Object.entries(fields)) formData.set(k, v)
    const result = await updateCase(formData)
    if (!result?.error) onUpdate()
  }

  const getClientDisplayName = () => {
    if (!client) return 'Unknown Client'
    if (client.first_name && client.last_name) return `${client.first_name} ${client.last_name}`
    if (client.first_name) return client.first_name
    if (client.last_name) return client.last_name
    if (client.contact_email) return client.contact_email
    return 'Unnamed Client'
  }

  const userOptions = users.map(u => ({ id: u.id, label: u.display_name || u.email }))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-0 sm:divide-x sm:divide-[hsl(var(--color-border))]">
      {/* Client */}
      <div className="sm:pr-6">
        <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Client</label>
        <p className="text-sm text-[hsl(var(--color-text-primary))] font-medium truncate">{getClientDisplayName()}</p>
        {client?.client_code && (
          <p className="text-xs text-[hsl(var(--color-text-secondary))] font-mono mt-1">{client.client_code}</p>
        )}
      </div>

      {/* Status */}
      <div className="sm:px-6">
        <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Status</label>
        <Select
          options={statuses.map(s => ({ id: s.id, label: s.name }))}
          value={caseData.status_id || ''}
          onChange={(value) => update({ statusId: value })}
          placeholder="Select status..."
          searchPlaceholder="Search statuses..."
        />
      </div>

      {/* Due Date */}
      <div className="sm:px-6">
        <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Due Date</label>
        <input
          type="date"
          value={caseData.due_date || ''}
          onChange={(e) => update({ dueDate: e.target.value })}
          className="w-full px-3 sm:px-4 py-2.5 text-sm bg-[hsl(var(--color-input-bg))] border border-[hsl(var(--color-input-border))] rounded-xl text-[hsl(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-border-hover))] hover:border-[hsl(var(--color-border-hover))] hover:bg-[hsl(var(--color-surface-hover))] transition-all duration-200"
        />
      </div>

      {/* Legal rep */}
      <div className="sm:px-6">
        <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Legal</label>
        <Select
          options={userOptions}
          value={caseData.assigned_to || ''}
          onChange={(value) => update({ assignedTo: value })}
          placeholder="Assign lawyer..."
          searchPlaceholder="Search users..."
        />
      </div>

      {/* CSR rep */}
      <div className="sm:pl-6">
        <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Customer success</label>
        <Select
          options={userOptions}
          value={caseData.csr_id || ''}
          onChange={(value) => update({ csrId: value })}
          placeholder="Assign CSR..."
          searchPlaceholder="Search users..."
        />
      </div>
    </div>
  )
}
