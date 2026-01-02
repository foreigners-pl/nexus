'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity, logActivityForUsers } from './dashboard'

export async function addCase(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const clientId = formData.get('clientId') as string
  let statusId = formData.get('statusId') as string | null
  const assignedTo = formData.get('assignedTo') as string | null

  if (!clientId) {
    return { error: 'Client ID is required' }
  }

  // If no status is provided, get the "New" status
  if (!statusId) {
    const { data: newStatus } = await supabase
      .from('status')
      .select('id')
      .eq('name', 'New')
      .single()
    
    if (newStatus) {
      statusId = newStatus.id
    }
  }

  const { data, error } = await supabase
    .from('cases')
    .insert({
      client_id: clientId,
      status_id: statusId,
      assigned_to: assignedTo,
    })
    .select(`
      *,
      clients(first_name, last_name)
    `)
    .single()

  if (error) {
    console.error('Error creating case:', error)
    return { error: 'Failed to create case' }
  }

  // Create default down payment installment
  if (data?.id) {
    await supabase
      .from('installments')
      .insert({
        case_id: data.id,
        amount: 0,
        position: 1,
        is_down_payment: true,
        automatic_invoice: false,
      })
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
  const dueDate = formData.get('dueDate') as string | null

  if (!caseId) {
    return { error: 'Case ID is required' }
  }

  const updateData: any = {}
  if (statusId !== null) updateData.status_id = statusId
  if (assignedTo !== null) updateData.assigned_to = assignedTo
  if (dueDate !== undefined) updateData.due_date = dueDate || null

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

export async function updateCaseStatus(caseId: string, statusId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current case info before update
  const { data: caseData } = await supabase
    .from('cases')
    .select(`
      case_code,
      status_id,
      status:status_id(name),
      clients(first_name, last_name)
    `)
    .eq('id', caseId)
    .single()

  // Get new status name
  const { data: newStatus } = await supabase
    .from('status')
    .select('name')
    .eq('id', statusId)
    .single()

  const { error } = await supabase
    .from('cases')
    .update({ status_id: statusId })
    .eq('id', caseId)

  if (error) {
    console.error('Error updating case status:', error)
    return { error: 'Failed to update case status' }
  }

  // Log status change for all assignees
  if (caseData && newStatus) {
    const { data: assignees } = await supabase
      .from('case_assignees')
      .select('user_id')
      .eq('case_id', caseId)

    const assigneeIds = assignees?.map(a => a.user_id) || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = caseData.clients as any
    const clientName = client 
      ? `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unknown'
      : 'Unknown'
    const oldStatusName = (caseData.status as any)?.name || 'Unknown'

    await logActivityForUsers({
      userIds: assigneeIds,
      actorId: user?.id,
      actionType: 'case_status_changed',
      entityType: 'case',
      entityId: caseId,
      message: `Case ${caseData.case_code || ''} moved to "${newStatus.name}"`,
      metadata: {
        case_code: caseData.case_code,
        client_name: clientName,
        old_status: oldStatusName,
        new_status: newStatus.name,
      }
    })
  }

  revalidatePath('/cases')
  revalidatePath(`/cases/${caseId}`)
  revalidatePath('/board/00000000-0000-0000-0000-000000000001')
  
  return { success: true }
}

export async function moveCase(caseId: string, newStatusId: string, newPosition: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('cases')
    .update({ 
      status_id: newStatusId,
      position: newPosition
    })
    .eq('id', caseId)

  if (error) {
    console.error('Error moving case:', error)
    return { error: 'Failed to move case' }
  }
  
  return { success: true }
}
