const fs = require('fs');
const path = require('path');

// Read the backup file
const backup = fs.readFileSync('app/actions/boards.ts.backup', 'utf8');

// Board helpers
const boardHelpers = 'use server'

import { createClient } from '@/lib/supabase/server'

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
;

fs.writeFileSync('app/actions/board/helpers.ts', boardHelpers);
console.log('Created board/helpers.ts');
