'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Helper function to check if user is the board owner
 */
export async function isBoardOwner(supabase: any, boardId: string, userId: string): Promise<boolean> {
  const { data: board, error } = await supabase
    .from('boards')
    .select('owner_id')
    .eq('id', boardId)
    .maybeSingle()

  if (error) {
    console.error('[isBoardOwner] Error checking board ownership:', error)
    return false
  }

  console.log('[isBoardOwner] Board check result:', {
    boardId,
    userId,
    boardOwnerId: board?.owner_id,
    isOwner: board?.owner_id === userId
  })

  return board?.owner_id === userId
}

/**
 * Helper function to check if user has editor or owner access to a board
 */
export async function hasEditorAccess(supabase: any, boardId: string, userId: string): Promise<boolean> {
  // Check if user is the owner
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('owner_id')
    .eq('id', boardId)
    .maybeSingle()

  if (boardError) {
    console.error('Error checking board ownership:', boardError)
    return false
  }

  if (board?.owner_id === userId) return true

  // Check if user has editor or owner access level
  const { data: access, error: accessError } = await supabase
    .from('board_access')
    .select('access_level')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .maybeSingle()

  if (accessError) {
    console.error('Error checking board access:', accessError)
    return false
  }

  return access?.access_level === 'editor' || access?.access_level === 'owner'
}

/**
 * Get user's access level for a board
 * Returns 'owner' | 'editor' | 'viewer' | null
 */
export async function getUserBoardAccessLevel(boardId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if user is the owner
  const { data: board } = await supabase
    .from('boards')
    .select('owner_id')
    .eq('id', boardId)
    .maybeSingle()

  if (board?.owner_id === user.id) return 'owner'

  // Check board_access for their access level
  const { data: access } = await supabase
    .from('board_access')
    .select('access_level')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .maybeSingle()

  return access?.access_level as 'editor' | 'viewer' || null
}
