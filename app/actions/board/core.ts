'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { hasEditorAccess } from './helpers'

/**
 * Get all boards accessible by the current user
 * Returns boards with access information for categorization
 */
export async function getUserBoards() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // RLS policy now handles access control with SECURITY DEFINER function (no recursion)
  const { data: boards, error: boardsError } = await supabase
    .from('boards')
    .select('*')
    .order('created_at', { ascending: false })

  if (boardsError) {
    return { error: boardsError.message }
  }

  if (!boards || boards.length === 0) {
    return { data: [] }
  }

  // Get ALL access data for all boards in ONE query
  const boardIds = boards.map(b => b.id)
  const { data: allAccessData } = await supabase
    .from('board_access')
    .select('id, board_id, user_id, access_level')
    .in('board_id', boardIds)

  // Group access data by board_id
  const accessByBoard = (allAccessData || []).reduce((acc, access) => {
    if (!acc[access.board_id]) {
      acc[access.board_id] = []
    }
    acc[access.board_id].push(access)
    return acc
  }, {} as Record<string, any[]>)

  // Attach access data to each board, including the owner
  const boardsWithAccess = boards.map(board => {
    const boardAccess = accessByBoard[board.id] || []
    
    // Add owner to the access list if not already present (for display purposes)
    const ownerInList = boardAccess.some(access => access.user_id === board.owner_id)
    if (!ownerInList && board.owner_id) {
      boardAccess.unshift({
        id: `owner-${board.id}`,
        board_id: board.id,
        user_id: board.owner_id,
        access_level: 'owner'
      })
    }
    
    return {
      ...board,
      board_access: boardAccess
    }
  })

  // Sort: system boards first, then by created_at
  boardsWithAccess.sort((a, b) => {
    if (a.is_system && !b.is_system) return -1
    if (!a.is_system && b.is_system) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return { data: boardsWithAccess }
}

/**
 * Create a new custom board
 */
export async function createBoard(name: string, description?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!name || name.trim().length === 0) {
    return { error: 'Board name is required' }
  }

  // Create the board
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .insert({
      name: name.trim(),
      description: description?.trim(),
      owner_id: user.id,
      is_system: false
    })
    .select()
    .single()

  if (boardError) {
    return { error: boardError.message }
  }

  // DON'T insert owner into board_access - they're already the owner via owner_id
  // Only editors/viewers need entries in board_access

  // Create default statuses: To Do, In Progress, Done
  const defaultStatuses = [
    { name: 'To Do', position: 0, color: '#94a3b8' }, // slate-400
    { name: 'In Progress', position: 1, color: '#3b82f6' }, // blue-500
    { name: 'Done', position: 2, color: '#22c55e' } // green-500
  ]

  const { error: statusError } = await supabase
    .from('board_statuses')
    .insert(
      defaultStatuses.map(status => ({
        board_id: board.id,
        ...status
      }))
    )

  if (statusError) {
    console.error('Default status creation error:', statusError)
    // Don't rollback - board is still usable, user can add statuses manually
  }

  // Don't revalidate - use optimistic updates in components
  return { data: board }
}

/**
 * Update board details (name, description)
 */
export async function updateBoard(boardId: string, updates: { name?: string; description?: string }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (updates.name !== undefined && updates.name.trim().length === 0) {
    return { error: 'Board name cannot be empty' }
  }

  // Check if user has editor or owner access
  const hasAccess = await hasEditorAccess(supabase, boardId, user.id)
  
  console.log(`[updateBoard] User ${user.id} attempting to update board ${boardId}`)
  console.log(`[updateBoard] Has editor access: ${hasAccess}`)
  
  if (!hasAccess) {
    return { error: 'Only board owners and editors can update board details' }
  }

  const updateData: any = {}
  if (updates.name !== undefined) updateData.name = updates.name.trim()
  if (updates.description !== undefined) updateData.description = updates.description.trim()

  const { data, error } = await supabase
    .from('boards')
    .update(updateData)
    .eq('id', boardId)
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error updating board:', error)
    return { error: error.message }
  }
  
  if (!data) {
    return { error: 'Failed to update board. It may be a system board or you may not have permission.' }
  }
  
  // Don't revalidate - use optimistic updates in components
  return { data }
}

/**
 * Delete a custom board (must be owner, cannot delete system boards)
 */
export async function deleteBoard(boardId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', boardId)
    .eq('owner_id', user.id)
    .eq('is_system', false)

  if (error) return { error: error.message }
  
  // Don't revalidate - use optimistic updates in components
  return { success: true }
}

/**
 * Get board with all data (statuses, cards, access)
 * For Cases board, returns null as it uses different data sources
 */
export async function getBoardWithData(boardId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check if this is the Cases board
  if (boardId === '00000000-0000-0000-0000-000000000001') {
    return { isCasesBoard: true }
  }

  // Get board with statuses
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select(`
      *,
      board_statuses (
        id,
        name,
        position,
        color,
        created_at,
        updated_at
      )
    `)
    .eq('id', boardId)
    .single()

  if (boardError) return { error: boardError.message }

  // Get board access separately (no join to users since there's no FK)
  const { data: boardAccess, error: accessError } = await supabase
    .from('board_access')
    .select('id, user_id, access_level, granted_at')
    .eq('board_id', boardId)

  if (accessError) {
    console.error('Error fetching board access:', accessError)
  }

  // Get all cards for this board
  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true })

  // Fetch ALL assignees for all cards (not just for shared boards)
  let assigneesByCard: Record<string, any[]> = {}
  
  if (cards && cards.length > 0) {
    const cardIds = cards.map(c => c.id)
    const { data: allAssignees } = await supabase
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
      .in('card_id', cardIds)

    // Group assignees by card_id
    if (allAssignees) {
      assigneesByCard = allAssignees.reduce((acc, assignee) => {
        if (!acc[assignee.card_id]) {
          acc[assignee.card_id] = []
        }
        acc[assignee.card_id].push(assignee)
        return acc
      }, {} as Record<string, any[]>)
    }
  }

  // Attach assignees to each card
  const cardsWithAssignees = (cards || []).map(card => ({
    ...card,
    card_assignees: assigneesByCard[card.id] || []
  }))

  return { 
    data: {
      ...board,
      board_access: boardAccess || [],
      cards: cardsWithAssignees
    }
  }
}

/**
 * Get Cases board data (cases + statuses from existing tables)
 */
export async function getCasesBoardData() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch statuses
  const { data: statuses, error: statusError } = await supabase
    .from('status')
    .select('*')
    .order('position', { ascending: true })

  if (statusError) return { error: statusError.message }

  // Fetch cases with relations
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select(`
      *,
      clients (
        id,
        client_code,
        first_name,
        last_name,
        contact_email
      ),
      status (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })

  if (casesError) return { error: casesError.message }

  return { data: { statuses, cases } }
}
