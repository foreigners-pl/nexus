'use server'

import { createClient } from '@/lib/supabase/server'
import { logActivity } from '../dashboard'

/**
 * Add an assignee to a card
 */
export async function addCardAssignee(cardId: string, userId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  console.log('🔧 [addCardAssignee] Adding assignee:', { cardId, userId, currentUser: user.id })

  // Debug: Check if user has access to the card's board
  const { data: cardData } = await supabase
    .from('cards')
    .select('board_id, boards!inner(owner_id, is_system)')
    .eq('id', cardId)
    .single()
  
  console.log('🔍 [addCardAssignee] Card board info:', cardData)

  // Check if already assigned
  const { data: existing } = await supabase
    .from('card_assignees')
    .select('id')
    .eq('card_id', cardId)
    .eq('user_id', userId)
    .single()

  if (existing) {
    console.log('⚠️ [addCardAssignee] User already assigned')
    return { error: 'User is already assigned to this card' }
  }

  const { data, error } = await supabase
    .from('card_assignees')
    .insert({
      card_id: cardId,
      user_id: userId,
      assigned_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('❌ [addCardAssignee] Insert error:', error)
    return { error: error.message }
  }
  
  console.log('✅ [addCardAssignee] Assignee added successfully:', data)

  // Log task assigned notification (only if assigning someone else)
  if (userId !== user.id) {
    const { data: card } = await supabase
      .from('cards')
      .select('title, boards(name)')
      .eq('id', cardId)
      .single()

    const { data: actorProfile } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', user.id)
      .single()

    const actorName = actorProfile?.display_name || actorProfile?.email || 'Someone'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boardName = (card?.boards as any)?.name || 'Unknown'

    await logActivity({
      userId: userId,
      actorId: user.id,
      actionType: 'task_assigned',
      entityType: 'card',
      entityId: cardId,
      message: `${actorName} assigned you to task "${card?.title || 'Unknown'}"`,
      metadata: {
        card_title: card?.title,
        board_name: boardName,
        actor_name: actorName,
      }
    })
  }

  return { data }
}

/**
 * Remove an assignee from a card
 */
export async function removeCardAssignee(assigneeId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('card_assignees')
    .delete()
    .eq('id', assigneeId)

  if (error) return { error: error.message }
  
  return { success: true }
}

/**
 * Get assignees for a card
 */
export async function getCardAssignees(cardId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('card_assignees')
    .select('id, user_id, assigned_at')
    .eq('card_id', cardId)
    .order('assigned_at', { ascending: true })

  if (error) return { error: error.message }
  
  return { data }
}

/**
 * Get all users for assignee selection
 */
export async function getAllUsers() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name')
    .order('display_name', { ascending: true })

  if (error) return { error: error.message }
  
  return { data }
}
