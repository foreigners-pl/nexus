'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Share a wiki document with a user
 */
export async function shareWikiDocumentWithUser(
  documentId: string,
  userId: string,
  accessLevel: 'editor' | 'viewer' = 'viewer'
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the document
  const { data: document } = await supabase
    .from('wiki_documents')
    .select('owner_id, folder_id')
    .eq('id', documentId)
    .single()

  if (!document) {
    return { error: 'Document not found' }
  }

  // Check if user is the owner or has editor access to the folder
  const isOwner = document.owner_id === user.id
  
  if (!isOwner) {
    const { data: folderAccess } = await supabase
      .from('wiki_folder_access')
      .select('access_level')
      .eq('folder_id', document.folder_id)
      .eq('user_id', user.id)
      .single()

    if (!folderAccess || folderAccess.access_level !== 'editor') {
      return { error: 'Only document owners and folder editors can share documents' }
    }
  }

  // For simplicity, we'll use the shared_with array column
  // Get current shared_with array
  const { data: currentDoc } = await supabase
    .from('wiki_documents')
    .select('shared_with')
    .eq('id', documentId)
    .single()

  const sharedWith = currentDoc?.shared_with || []
  
  if (sharedWith.includes(userId)) {
    return { error: 'User already has access to this document' }
  }

  // Add user to shared_with array
  const { error } = await supabase
    .from('wiki_documents')
    .update({ 
      shared_with: [...sharedWith, userId],
      is_shared: true
    })
    .eq('id', documentId)

  if (error) return { error: error.message }
  
  revalidatePath('/wiki')
  return { success: true }
}

/**
 * Remove user access from a wiki document
 */
export async function removeWikiDocumentAccess(
  documentId: string,
  userId: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the document
  const { data: document } = await supabase
    .from('wiki_documents')
    .select('owner_id, shared_with')
    .eq('id', documentId)
    .single()

  if (!document || document.owner_id !== user.id) {
    return { error: 'Only the document owner can remove access' }
  }

  // Remove user from shared_with array
  const sharedWith = (document.shared_with || []).filter((id: string) => id !== userId)

  const { error } = await supabase
    .from('wiki_documents')
    .update({ 
      shared_with: sharedWith,
      is_shared: sharedWith.length > 0
    })
    .eq('id', documentId)

  if (error) return { error: error.message }
  
  revalidatePath('/wiki')
  return { success: true }
}

/**
 * Get users with access to a wiki document
 */
export async function getWikiDocumentAccessList(documentId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the document
  const { data: document, error: docError } = await supabase
    .from('wiki_documents')
    .select('owner_id, shared_with, created_at')
    .eq('id', documentId)
    .single()

  if (docError || !document) {
    return { error: 'Document not found' }
  }

  // Build access list
  const accessList = []

  // Add owner
  accessList.push({
    id: 'owner',
    document_id: documentId,
    user_id: document.owner_id,
    access_level: 'owner',
    granted_by: null,
    granted_at: document.created_at
  })

  // Add shared users (all as viewers for now since we're using simple array)
  if (document.shared_with && Array.isArray(document.shared_with)) {
    for (const userId of document.shared_with) {
      accessList.push({
        id: `shared-${userId}`,
        document_id: documentId,
        user_id: userId,
        access_level: 'viewer',
        granted_by: document.owner_id,
        granted_at: document.created_at
      })
    }
  }

  return { data: accessList }
}

/**
 * Update document access level (for future expansion to support editor/viewer distinction)
 */
export async function updateWikiDocumentAccessLevel(
  documentId: string,
  userId: string,
  accessLevel: 'editor' | 'viewer'
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the document
  const { data: document } = await supabase
    .from('wiki_documents')
    .select('owner_id')
    .eq('id', documentId)
    .single()

  if (!document || document.owner_id !== user.id) {
    return { error: 'Only the document owner can update access levels' }
  }

  // For now, we're using a simple shared_with array, so this is a no-op
  // In the future, we could add a separate wiki_document_access table
  
  revalidatePath('/wiki')
  return { success: true }
}