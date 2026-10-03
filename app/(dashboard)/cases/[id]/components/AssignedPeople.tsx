'use client'

import { useEffect, useState } from 'react'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { updateCase } from '@/app/actions/cases'
import type { Case, User } from '@/types/database'

/** Editable panel showing the case's two reps: legal + customer success. */
export function AssignedPeople({ caseData, onUpdate }: { caseData: Case; onUpdate: () => void }) {
  const [users, setUsers] = useState<User[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('users')
      .select('*')
      .order('display_name', { ascending: true })
      .then(({ data }) => { if (data) setUsers(data) })
  }, [])

  const update = async (fields: Record<string, string>) => {
    const formData = new FormData()
    formData.set('caseId', caseData.id)
    for (const [k, v] of Object.entries(fields)) formData.set(k, v)
    const result = await updateCase(formData)
    if (!result?.error) onUpdate()
  }

  const userOptions = users.map(u => ({ id: u.id, label: u.display_name || u.email }))

  return (
    <div className="rounded-xl border border-[hsl(var(--color-border))] backdrop-blur-xl bg-[hsl(var(--color-surface))]/80 shadow-[0_8px_32px_rgb(0_0_0/0.25)] p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Customer success</label>
          <Select
            options={userOptions}
            value={caseData.csr_id || ''}
            onChange={(value) => update({ csrId: value })}
            placeholder="Assign CSR..."
            searchPlaceholder="Search users..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[hsl(var(--color-text-secondary))] mb-2">Legal</label>
          <Select
            options={userOptions}
            value={caseData.assigned_to || ''}
            onChange={(value) => update({ assignedTo: value })}
            placeholder="Assign lawyer..."
            searchPlaceholder="Search users..."
          />
        </div>
      </div>
    </div>
  )
}
