'use server'

import { createClient } from '@/lib/supabase/server'
import { logActivityForUsers } from '../dashboard'

/**
 * Get cards for a specific board
 */
export async function getBoardCards(boardId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true })

  if (error) return { error: error.message }
  
  return { data }
}

/**
 * Create a new card
 */
export async function createCard(
  boardId: string, 
  statusId: string, 
  title: string, 
  description?: string,
  dueDate?: string
) {
  console.log('🔧 SERVER ACTION - createCard called:', { boardId, statusId, title })
  
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  console.log('👤 Current user:', user?.id)
  
  if (!user) {
    console.error('❌ Not authenticated')
    return { error: 'Not authenticated' }
  }

  if (!title || title.trim().length === 0) {
    console.error('❌ Title required')
    return { error: 'Card title is required' }
  }

  // Get the highest position in this status
  const { data: existingCards } = await supabase
    .from('cards')
    .select('position')
    .eq('status_id', statusId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existingCards && existingCards.length > 0 
    ? existingCards[0].position + 1 
    : 0

  console.log('📊 Next position:', nextPosition)

  const cardData = {
    board_id: boardId,
    status_id: statusId,
    title: title.trim(),
    description: description?.trim(),
    due_date: dueDate || null,
    position: nextPosition,
    created_by: user.id
  }
  
  console.log('💾 Inserting card:', cardData)

  const { data, error } = await supabase
    .from('cards')
    .insert(cardData)
    .select()
    .single()

  if (error) {
    console.error('❌ INSERT ERROR:', error)
    return { error: error.message }
  }
  
  console.log('✅ Card created:', data)
  
  // Don't revalidate - use optimistic updates in components
  return { data }
}

/**
 * Update a card
 */
export async function updateCard(
  cardId: string, 
  updates: { title?: string; description?: string; status_id?: string; due_date?: string }
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (updates.title !== undefined && updates.title.trim().length === 0) {
    return { error: 'Card title cannot be empty' }
  }

  const updateData: any = {}
  if (updates.title !== undefined) updateData.title = updates.title.trim()
  if (updates.description !== undefined) updateData.description = updates.description.trim()
  if (updates.status_id !== undefined) updateData.status_id = updates.status_id
  if (updates.due_date !== undefined) updateData.due_date = updates.due_date || null

  const { data, error } = await supabase
    .from('cards')
    .update(updateData)
    .eq('id', cardId)
    .select()
    .single()

  if (error) return { error: error.message }
  
  // Get board_id to revalidate
  const { data: card } = await supabase
    .from('cards')
    .select('board_id')
    .eq('id', cardId)
    .single()
  
  // Don't revalidate - use optimistic updates in components
  return { data }
}

/**
 * Delete a card
 */
export async function deleteCard(cardId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get board_id before deleting
  const { data: card } = await supabase
    .from('cards')
    .select('board_id')
    .eq('id', cardId)
    .single()

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId)

  if (error) return { error: error.message }
  
  // Don't revalidate - use optimistic updates in components
  return { success: true }
}

/**
 * Move card to different status
 */
export async function moveCard(cardId: string, newStatusId: string, newPosition: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get card info before update
  const { data: cardBefore } = await supabase
    .from('cards')
    .select('title, status_id, board_id')
    .eq('id', cardId)
    .single()

  const { data, error } = await supabase
    .from('cards')
    .update({ 
      status_id: newStatusId,
      position: newPosition
    })
    .eq('id', cardId)
    .select('board_id')
    .single()

  if (error) return { error: error.message }

  // Log task status change if status actually changed
  if (cardBefore && cardBefore.status_id !== newStatusId) {
    const { data: newStatus } = await supabase
      .from('board_statuses')
      .select('name')
      .eq('id', newStatusId)
      .single()

    const { data: assignees } = await supabase
      .from('card_assignees')
      .select('user_id')
      .eq('card_id', cardId)

    const { data: actorProfile } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', user.id)
      .single()

    const actorName = actorProfile?.display_name || actorProfile?.email || 'Someone'
    const assigneeIds = assignees?.map(a => a.user_id) || []

    if (assigneeIds.length > 0) {
      await logActivityForUsers({
        userIds: assigneeIds,
        actorId: user.id,
        actionType: 'task_status_changed',
        entityType: 'card',
        entityId: cardId,
        message: `${actorName} moved task "${cardBefore.title}" to "${newStatus?.name || 'Unknown'}"`,
        metadata: {
          card_title: cardBefore.title,
          board_id: cardBefore.board_id,
          new_status: newStatus?.name,
          actor_name: actorName,
        }
      })
    }
  }
  
  // Don't revalidate - use optimistic updates in components
  return { success: true }
}

/**
 * Get a single card with all its data (including assignees)
 */
export async function getCardWithAssignees(cardId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the card
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .single()

  if (cardError) return { error: cardError.message }

  // Get assignees with user details
  const { data: assignees, error: assigneesError } = await supabase
    .from('card_assignees')
    .select(`
      id,
      card_id,
      user_id,
      assigned_at,
      users:user_id (
        id,
        email,
        display_name
      )
    `)
    .eq('card_id', cardId)

  if (assigneesError) {
    console.error('Error fetching card assignees:', assigneesError)
  }

  return {
    data: {
      ...card,
      card_assignees: assignees || []
    }
  }
}
