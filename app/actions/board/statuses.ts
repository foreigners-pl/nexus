'use server'

import { createClient } from '@/lib/supabase/server'
import { hasEditorAccess } from './helpers'

/**
 * Create a new status for a board
 */
export async function createBoardStatus(
  boardId: string,
  name: string,
  color: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check if user has editor or owner access
  const hasAccess = await hasEditorAccess(supabase, boardId, user.id)
  if (!hasAccess) {
    return { error: 'Only board owners and editors can create statuses' }
  }

  // Get the highest position
  const { data: existingStatuses } = await supabase
    .from('board_statuses')
    .select('position')
    .eq('board_id', boardId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existingStatuses && existingStatuses.length > 0 
    ? existingStatuses[0].position + 1 
    : 0

  const { data, error } = await supabase
    .from('board_statuses')
    .insert({
      board_id: boardId,
      name: name.trim(),
      color,
      position: nextPosition
    })
    .select()
    .single()

  if (error) return { error: error.message }
  
  // Don't revalidate - use optimistic updates in components
  return { data }
}

/**
 * Update a board status
 */
export async function updateBoardStatus(
  statusId: string,
  updates: { name?: string; color?: string }
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the status with board_id
  const { data: status, error: statusError } = await supabase
    .from('board_statuses')
    .select('board_id')
    .eq('id', statusId)
    .maybeSingle()

  if (statusError) {
    console.error('Error fetching status:', statusError)
    return { error: 'Failed to fetch status' }
  }

  if (!status) {
    return { error: 'Status not found' }
  }

  // Check if user has editor or owner access
  const hasAccess = await hasEditorAccess(supabase, status.board_id, user.id)
  if (!hasAccess) {
    return { error: 'Only board owners and editors can update statuses' }
  }

  const updateData: any = {}
  if (updates.name !== undefined) updateData.name = updates.name.trim()
  if (updates.color !== undefined) updateData.color = updates.color

  const { data, error } = await supabase
    .from('board_statuses')
    .update(updateData)
    .eq('id', statusId)
    .select()
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Failed to update status' }
  
  // Don't revalidate - use optimistic updates in components
  return { data }
}

/**
 * Delete a board status
 */
export async function deleteBoardStatus(statusId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the status with board_id and position
  const { data: status, error: statusError } = await supabase
    .from('board_statuses')
    .select('board_id, position')
    .eq('id', statusId)
    .maybeSingle()

  if (statusError) {
    console.error('Error fetching status:', statusError)
    return { error: 'Failed to fetch status' }
  }

  if (!status) {
    return { error: 'Status not found' }
  }

  // Check if user has editor or owner access
  const hasAccess = await hasEditorAccess(supabase, status.board_id, user.id)
  if (!hasAccess) {
    return { error: 'Only board owners and editors can delete statuses' }
  }

  // Check if there are cards in this status
  const { data: cardsInStatus } = await supabase
    .from('cards')
    .select('id')
    .eq('status_id', statusId)
    .limit(1)

  if (cardsInStatus && cardsInStatus.length > 0) {
    return { error: 'Cannot delete status with existing tasks. Move or delete tasks first.' }
  }

  // Delete the status
  const { error } = await supabase
    .from('board_statuses')
    .delete()
    .eq('id', statusId)

  if (error) return { error: error.message }
  
  // Reindex remaining statuses - decrement position for all statuses after the deleted one
  const { data: remainingStatuses } = await supabase
    .from('board_statuses')
    .select('id, position')
    .eq('board_id', status.board_id)
    .gt('position', status.position)
    .order('position', { ascending: true })

  if (remainingStatuses && remainingStatuses.length > 0) {
    // Update each status to fill the gap
    for (const remainingStatus of remainingStatuses) {
      await supabase
        .from('board_statuses')
        .update({ position: remainingStatus.position - 1 })
        .eq('id', remainingStatus.id)
    }
  }
  
  // Don't revalidate - use optimistic updates in components
  return { success: true }
}

/**
 * Reorder board statuses
 */
export async function reorderBoardStatuses(
  boardId: string,
  statusIds: string[]
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check if user has editor or owner access
  const hasAccess = await hasEditorAccess(supabase, boardId, user.id)
  if (!hasAccess) {
    return { error: 'Only board owners and editors can reorder statuses' }
  }

  // Update positions
  for (let i = 0; i < statusIds.length; i++) {
    await supabase
      .from('board_statuses')
      .update({ position: i })
      .eq('id', statusIds[i])
      .eq('board_id', boardId)
  }

  // Don't revalidate - use optimistic updates in components
  return { success: true }
}
