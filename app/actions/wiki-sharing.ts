'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Share a wiki folder with a user
 */
export async function shareWikiFolderWithUser(
  folderId: string,
  userId: string,
  accessLevel: 'editor' | 'viewer' = 'editor'
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check if user is the owner or has editor access
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', folderId)
    .single()

  if (!folder) {
    return { error: 'Wiki folder not found' }
  }

  const isOwner = folder.owner_id === user.id
  
  if (!isOwner) {
    // Check if current user has editor access
    const { data: access } = await supabase
      .from('wiki_folder_access')
      .select('access_level')
      .eq('folder_id', folderId)
      .eq('user_id', user.id)
      .single()

    if (!access || access.access_level !== 'editor') {
      return { error: 'Only folder owners and editors can share the folder' }
    }
  }

  // Check if user already has access
  const { data: existingAccess } = await supabase
    .from('wiki_folder_access')
    .select('id')
    .eq('folder_id', folderId)
    .eq('user_id', userId)
    .single()

  if (existingAccess) {
    return { error: 'User already has access to this folder' }
  }

  const { data, error } = await supabase
    .from('wiki_folder_access')
    .insert({
      folder_id: folderId,
      user_id: userId,
      access_level: accessLevel,
      granted_by: user.id
    })
    .select()
    .single()

  if (error) return { error: error.message }
  
  // Mark the folder as shared
  await supabase
    .from('wiki_folders')
    .update({ is_shared: true })
    .eq('id', folderId)
  
  revalidatePath('/wiki')
  return { data }
}

/**
 * Remove user access from a wiki folder
 */
export async function removeWikiFolderAccess(
  folderId: string,
  userId: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check ownership
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', folderId)
    .single()

  if (!folder || folder.owner_id !== user.id) {
    return { error: 'Only the folder owner can remove access' }
  }

  // Prevent removing owner's access
  if (userId === user.id) {
    return { error: 'Cannot remove your own access as the owner' }
  }

  const { error } = await supabase
    .from('wiki_folder_access')
    .delete()
    .eq('folder_id', folderId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  
  // Check if there are any remaining users with access
  const { data: remainingAccess } = await supabase
    .from('wiki_folder_access')
    .select('id')
    .eq('folder_id', folderId)
    .limit(1)

  // If no more users have access, mark as private
  if (!remainingAccess || remainingAccess.length === 0) {
    await supabase
      .from('wiki_folders')
      .update({ is_shared: false })
      .eq('id', folderId)
  }
  
  revalidatePath('/wiki')
  return { success: true }
}

/**
 * Get users with access to a wiki folder (including the owner)
 */
export async function getWikiFolderAccessList(folderId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the folder owner
  const { data: folder, error: folderError } = await supabase
    .from('wiki_folders')
    .select('owner_id, created_at')
    .eq('id', folderId)
    .single()

  if (folderError) {
    return { error: 'Failed to fetch folder' }
  }

  if (!folder) {
    return { error: 'Folder not found' }
  }

  // Get all access records
  const { data: accessRecords, error: accessError } = await supabase
    .from('wiki_folder_access')
    .select('*')
    .eq('folder_id', folderId)
    .order('granted_at', { ascending: false })

  if (accessError) {
    // If table doesn't exist yet, return just the owner
    if (accessError.code === '42P01') {
      console.warn('wiki_folder_access table not created yet. Run migration_27_add_wiki_parent_id.sql')
      const ownerRecord = {
        id: 'owner',
        folder_id: folderId,
        user_id: folder.owner_id,
        access_level: 'owner',
        granted_by: null,
        granted_at: folder.created_at
      }
      return { data: [ownerRecord] }
    }
    return { error: 'Failed to fetch access list' }
  }

  // Add owner to the list with 'owner' access level
  const ownerRecord = {
    id: 'owner',
    folder_id: folderId,
    user_id: folder.owner_id,
    access_level: 'owner',
    granted_by: null,
    granted_at: folder.created_at
  }

  return { data: [ownerRecord, ...(accessRecords || [])] }
}

/**
 * Update wiki folder access level
 */
export async function updateWikiFolderAccessLevel(
  folderId: string,
  userId: string,
  accessLevel: 'editor' | 'viewer'
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check ownership
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', folderId)
    .single()

  if (!folder || folder.owner_id !== user.id) {
    return { error: 'Only the folder owner can update access levels' }
  }

  const { error } = await supabase
    .from('wiki_folder_access')
    .update({ access_level: accessLevel })
    .eq('folder_id', folderId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  
  revalidatePath('/wiki')
  return { success: true }
}
