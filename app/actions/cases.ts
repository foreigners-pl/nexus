'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addCase(formData: FormData) {
  const supabase = await createClient()

  const clientId = formData.get('clientId') as string
  const statusId = formData.get('statusId') as string | null
  const assignedTo = formData.get('assignedTo') as string | null

  if (!clientId) {
    return { error: 'Client ID is required' }
  }

  const { data, error } = await supabase
    .from('cases')
    .insert({
      client_id: clientId,
      status_id: statusId,
      assigned_to: assignedTo,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating case:', error)
    return { error: 'Failed to create case' }
  }

  revalidatePath('/cases')
  revalidatePath(`/clients/${clientId}`)
  
  return { success: true, caseData: data }
}

export async function updateCase(formData: FormData) {
  const supabase = await createClient()

  const caseId = formData.get('caseId') as string
  const statusId = formData.get('statusId') as string | null
  const assignedTo = formData.get('assignedTo') as string | null

  if (!caseId) {
    return { error: 'Case ID is required' }
  }

  const updateData: any = {}
  if (statusId !== null) updateData.status_id = statusId
  if (assignedTo !== null) updateData.assigned_to = assignedTo

  const { error } = await supabase
    .from('cases')
    .update(updateData)
    .eq('id', caseId)

  if (error) {
    console.error('Error updating case:', error)
    return { error: 'Failed to update case' }
  }

  revalidatePath('/cases')
  revalidatePath(`/cases/${caseId}`)
  
  return { success: true }
}

export async function deleteCase(caseId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cases')
    .delete()
    .eq('id', caseId)

  if (error) {
    console.error('Error deleting case:', error)
    return { error: 'Failed to delete case' }
  }

  revalidatePath('/cases')
  
  return { success: true }
}
