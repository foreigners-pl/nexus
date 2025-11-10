'use server'

import { createClient } from '@/lib/supabase/server'
import { hasEditorAccess } from './helpers'

/**
 * Share a board with a user
 */
export async function shareBoardWithUser(
  boardId: string,
  userEmail: string,
  accessLevel: 'editor' | 'viewer' = 'editor'
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check if user has editor or owner access (editors can share too)
  const hasAccess = await hasEditorAccess(supabase, boardId, user.id)
  if (!hasAccess) {
    return { error: 'Only board owners and editors can share the board' }
  }

  // Find user by email (you'll need to query auth.users or have a users table)
  // For now, we'll assume you pass the user_id directly
  // This is a simplified version - you may need to adjust based on your auth setup
  
  const { data: existingAccess } = await supabase
    .from('board_access')
    .select('id')
    .eq('board_id', boardId)
    .eq('user_id', userEmail) // This should be user_id, not email
    .single()

  if (existingAccess) {
    return { error: 'User already has access to this board' }
  }

  const { data, error } = await supabase
    .from('board_access')
    .insert({
      board_id: boardId,
      user_id: userEmail, // This should be user_id
      access_level: accessLevel,
      granted_by: user.id
    })
    .select()
    .single()

  if (error) return { error: error.message }
  
  // Don't revalidate - use optimistic updates in components
  return { data }
}

/**
 * Remove user access from a board
 */
export async function removeBoardAccess(
  boardId: string,
  userId: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check ownership
  const { data: board } = await supabase
    .from('boards')
    .select('owner_id')
    .eq('id', boardId)
    .single()

  if (!board || board.owner_id !== user.id) {
    return { error: 'Only the board owner can remove access' }
  }

  // Prevent removing owner's access
  if (userId === user.id) {
    return { error: 'Cannot remove your own access as the owner' }
  }

  const { error } = await supabase
    .from('board_access')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  
  // Don't revalidate - use optimistic updates in components
  return { success: true }
}

/**
 * Get users with access to a board (including the owner)
 */
export async function getBoardAccessList(boardId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the board owner
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('owner_id, created_at')
    .eq('id', boardId)
    .maybeSingle()

  if (boardError) {
    console.error('Error fetching board:', boardError)
    return { error: 'Failed to fetch board' }
  }

  if (!board) {
    return { error: 'Board not found' }
  }

  // Get other users with access (excluding owner if they're in board_access)
  const { data: accessList, error } = await supabase
    .from('board_access')
    .select('id, user_id, access_level, granted_at, granted_by')
    .eq('board_id', boardId)
    .neq('user_id', board.owner_id) // Exclude owner from board_access results
    .order('granted_at', { ascending: true })

  if (error) return { error: error.message }

  // Add the owner to the list
  const ownerAccess = {
    id: 'owner',
    user_id: board.owner_id,
    access_level: 'owner',
    granted_at: board.created_at,
    granted_by: board.owner_id
  }

  // Combine owner and other access (owner first)
  const allAccess = [ownerAccess, ...(accessList || [])]
  
  return { data: allAccess }
}

/**
 * Get users who have access to a specific board (for assignee selection)
 */
export async function getBoardUsers(boardId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the board owner
  const { data: board } = await supabase
    .from('boards')
    .select('owner_id')
    .eq('id', boardId)
    .single()

  if (!board) return { error: 'Board not found' }

  // Get users who have access to this board (from board_access table)
  const { data: boardAccess } = await supabase
    .from('board_access')
    .select('user_id')
    .eq('board_id', boardId)

  // Collect all user IDs (owner + users with access)
  const userIds = [board.owner_id]
  if (boardAccess) {
    userIds.push(...boardAccess.map(ba => ba.user_id))
  }

  // Get user details for all these user IDs
  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name')
    .in('id', userIds)
    .order('display_name', { ascending: true })

  if (error) return { error: error.message }
  
  return { data }
}
