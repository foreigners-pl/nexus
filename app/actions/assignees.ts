'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from './dashboard'

export async function addAssigneeToCase(caseId: string, userId: string) {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('case_assignees')
    .insert({
      case_id: caseId,
      user_id: userId,
    })

  if (error) {
    console.error('Error adding assignee to case:', error)
    return { error: 'Failed to add assignee' }
  }

  // Log assignment notification
  const { data: caseData } = await supabase
    .from('cases')
    .select('case_code, clients(first_name, last_name)')
    .eq('id', caseId)
    .single()

  const { data: actorProfile } = await supabase
    .from('users')
    .select('display_name, email')
    .eq('id', currentUser?.id)
    .single()

  const actorName = actorProfile?.display_name || actorProfile?.email || 'Someone'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = caseData?.clients as any
  const clientName = client 
    ? `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unknown'
    : 'Unknown'

  // Only notify the assigned user (not the actor)
  if (userId !== currentUser?.id) {
    await logActivity({
      userId: userId,
      actorId: currentUser?.id,
      actionType: 'case_assigned',
      entityType: 'case',
      entityId: caseId,
      message: `${actorName} assigned you to case ${caseData?.case_code || ''}`,
      metadata: {
        case_code: caseData?.case_code,
        client_name: clientName,
        actor_name: actorName,
      }
    })
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function removeAssigneeFromCase(assigneeId: string, caseId: string) {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // Get the user being removed before deletion
  const { data: assignee } = await supabase
    .from('case_assignees')
    .select('user_id')
    .eq('id', assigneeId)
    .single()

  const { error } = await supabase
    .from('case_assignees')
    .delete()
    .eq('id', assigneeId)

  if (error) {
    console.error('Error removing assignee from case:', error)
    return { error: 'Failed to remove assignee' }
  }

  // Log unassignment notification
  if (assignee && assignee.user_id !== currentUser?.id) {
    const { data: caseData } = await supabase
      .from('cases')
      .select('case_code')
      .eq('id', caseId)
      .single()

    await logActivity({
      userId: assignee.user_id,
      actorId: currentUser?.id,
      actionType: 'case_unassigned',
      entityType: 'case',
      entityId: caseId,
      message: `You were unassigned from case ${caseData?.case_code || ''}`,
      metadata: {
        case_code: caseData?.case_code,
      }
    })
  }

  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}
