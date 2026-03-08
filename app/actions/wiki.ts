'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to convert markdown text to TipTap JSON
function markdownToTipTap(markdown: string): any {
  const lines = markdown.split('\n')
  const content: any[] = []
  let currentList: any | null = null
  let currentListType: 'bulletList' | 'orderedList' | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Handle headers
    if (line.startsWith('## ')) {
      if (currentList) {
        content.push(currentList)
        currentList = null
        currentListType = null
      }
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: line.slice(3).trim() }]
      })
      continue
    }
    
    if (line.startsWith('### ')) {
      if (currentList) {
        content.push(currentList)
        currentList = null
        currentListType = null
      }
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: line.slice(4).trim() }]
      })
      continue
    }
    
    // Handle bullet lists (both * and • patterns)
    const bulletMatch = line.match(/^[\*\•\-]\s+(.+)/)
    if (bulletMatch) {
      if (currentListType !== 'bulletList') {
        if (currentList) content.push(currentList)
        currentList = { type: 'bulletList', content: [] }
        currentListType = 'bulletList'
      }
      currentList.content.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: bulletMatch[1].trim() }]
        }]
      })
      continue
    }
    
    // Handle numbered lists
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (numberedMatch) {
      if (currentListType !== 'orderedList') {
        if (currentList) content.push(currentList)
        currentList = { type: 'orderedList', content: [] }
        currentListType = 'orderedList'
      }
      currentList.content.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: numberedMatch[2].trim() }]
        }]
      })
      continue
    }
    
    // Close any open list before paragraph
    if (currentList && line.trim()) {
      content.push(currentList)
      currentList = null
      currentListType = null
    }
    
    // Handle horizontal rules
    if (line.match(/^[\*\-_]{3,}$/)) {
      content.push({ type: 'horizontalRule' })
      continue
    }
    
    // Handle empty lines
    if (!line.trim()) {
      if (currentList) {
        content.push(currentList)
        currentList = null
        currentListType = null
      }
      continue
    }
    
    // Regular paragraph with possible inline formatting
    const text = line
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italic
      .replace(/`([^`]+)`/g, '$1') // Code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links - keep text only
    
    if (text.trim()) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: text.trim() }]
      })
    }
  }
  
  // Push any remaining list
  if (currentList) {
    content.push(currentList)
  }
  
  // Return empty doc if no content
  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: '' }]
    })
  }
  
  return { type: 'doc', content }
}

// Wiki import structure types
interface WikiImportDocument {
  title: string
  content: string
}

interface WikiImportFolder {
  name: string
  documents: WikiImportDocument[]
}

// Import wiki from structured data
export async function importWiki(
  folders: WikiImportFolder[],
  isShared: boolean = false
): Promise<{ success?: boolean; error?: string; imported?: { folders: number; documents: number } }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  
  let foldersCreated = 0
  let documentsCreated = 0
  
  try {
    for (const folder of folders) {
      // Get current max position for folders
      const { data: existingFolders } = await supabase
        .from('wiki_folders')
        .select('position')
        .eq('owner_id', user.id)
        .eq('is_shared', isShared)
        .order('position', { ascending: false })
        .limit(1)
      
      const folderPosition = existingFolders && existingFolders.length > 0 
        ? existingFolders[0].position + 1 
        : 0
      
      // Create the folder
      const { data: newFolder, error: folderError } = await supabase
        .from('wiki_folders')
        .insert({
          name: folder.name,
          owner_id: user.id,
          is_shared: isShared,
          position: folderPosition,
        })
        .select()
        .single()
      
      if (folderError) {
        console.error('Error creating folder:', folder.name, folderError)
        continue
      }
      
      foldersCreated++
      
      // Create documents within the folder
      for (let i = 0; i < folder.documents.length; i++) {
        const doc = folder.documents[i]
        const tipTapContent = markdownToTipTap(doc.content)
        
        const { error: docError } = await supabase
          .from('wiki_documents')
          .insert({
            title: doc.title,
            content: tipTapContent,
            document_type: 'rich-text',
            owner_id: user.id,
            folder_id: newFolder.id,
            is_shared: isShared,
            position: i,
          })
        
        if (docError) {
          console.error('Error creating document:', doc.title, docError)
          continue
        }
        
        documentsCreated++
      }
    }
    
    revalidatePath('/wiki')
    return { 
      success: true, 
      imported: { folders: foldersCreated, documents: documentsCreated } 
    }
  } catch (error) {
    console.error('Import error:', error)
    return { error: 'Failed to import wiki data' }
  }
}

// Folder actions
export async function getWikiFolders(isShared: boolean = false) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []  // Return empty array if not authenticated (graceful handling)

  if (isShared) {
    // Get folders where user has been granted folder-level access OR owns and are shared
    const { data: accessRecords, error: accessError } = await supabase
      .from('wiki_folder_access')
      .select('folder_id')
      .eq('user_id', user.id)

    if (accessError && accessError.code !== '42P01') {
      throw accessError
    }

    const folderAccessIds = accessRecords?.map(r => r.folder_id) || []

    // Get folders that user has access to OR owns and are shared
    let query = supabase
      .from('wiki_folders')
      .select('*')

    if (folderAccessIds.length > 0) {
      // User has access to some folders, or owns shared folders
      query = query.or(`id.in.(${folderAccessIds.join(',')}),and(owner_id.eq.${user.id},is_shared.eq.true)`)
    } else {
      // Only get folders owned by user that are shared
      query = query.eq('owner_id', user.id).eq('is_shared', true)
    }

    const { data, error } = await query
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01' || error.code === '42703') {
        console.warn('Wiki tables not set up yet. Run migration_27_add_wiki_parent_id.sql')
        return []
      }
      throw error
    }
    return data || []
  } else {
    // Get private folders owned by user
    const { data, error } = await supabase
      .from('wiki_folders')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_shared', false)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01' || error.code === '42703') {
        console.warn('Wiki tables not set up yet. Run migration_27_add_wiki_parent_id.sql')
        return []
      }
      throw error
    }
    return data || []
  }
}

export async function createWikiFolder(name: string, isShared: boolean = false) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get the highest position for this user's folders
  const { data: folders } = await supabase
    .from('wiki_folders')
    .select('position')
    .eq('owner_id', user.id)
    .eq('is_shared', isShared)
    .order('position', { ascending: false })
    .limit(1)

  const newPosition = folders && folders.length > 0 ? folders[0].position + 1 : 0

  const { data, error } = await supabase
    .from('wiki_folders')
    .insert({
      name,
      owner_id: user.id,
      is_shared: isShared,
      position: newPosition,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { data }
}

export async function updateWikiFolderPosition(folderId: string, position: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', folderId)
    .single()

  if (!folder || folder.owner_id !== user.id) {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('wiki_folders')
    .update({ position })
    .eq('id', folderId)

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { success: true }
}

export async function updateWikiDocumentPosition(docId: string, position: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get document with folder info
  const { data: doc } = await supabase
    .from('wiki_documents')
    .select('owner_id, folder_id')
    .eq('id', docId)
    .single()

  if (!doc) return { error: 'Document not found' }

  const isDocOwner = doc.owner_id === user.id
  let hasEditorAccess = false

  if (!isDocOwner) {
    // Check if user has editor access to the folder
    const { data: access } = await supabase
      .from('wiki_folder_access')
      .select('access_level')
      .eq('folder_id', doc.folder_id)
      .eq('user_id', user.id)
      .single()

    hasEditorAccess = access?.access_level === 'editor'
  }

  if (!isDocOwner && !hasEditorAccess) {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('wiki_documents')
    .update({ position })
    .eq('id', docId)

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { success: true }
}

export async function updateWikiFolderName(folderId: string, name: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', folderId)
    .single()

  if (!folder || folder.owner_id !== user.id) {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('wiki_folders')
    .update({ name })
    .eq('id', folderId)

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { success: true }
}

export async function getWikiFolderDocumentCount(folderId: string) {
  const supabase = await createClient()
  
  const { count } = await supabase
    .from('wiki_documents')
    .select('*', { count: 'exact', head: true })
    .eq('folder_id', folderId)

  return count || 0
}

export async function deleteWikiFolder(folderId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify ownership
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', folderId)
    .single()

  if (!folder || folder.owner_id !== user.id) {
    return { error: 'Not authorized' }
  }

  // Get document count
  const { count } = await supabase
    .from('wiki_documents')
    .select('*', { count: 'exact', head: true })
    .eq('folder_id', folderId)

  const { error } = await supabase
    .from('wiki_folders')
    .delete()
    .eq('id', folderId)

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { success: true, documentCount: count || 0 }
}

// Document actions
export async function getWikiDocuments(folderId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []  // Return empty array if not authenticated (graceful handling)

  const { data, error } = await supabase
    .from('wiki_documents')
    .select('*')
    .eq('folder_id', folderId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01' || error.code === '42703') {
      console.warn('Wiki tables not set up yet. Run migration_27_add_wiki_parent_id.sql')
      return []
    }
    throw error
  }
  return data || []
}

export async function createWikiDocument(
  folderId: string, 
  title: string, 
  documentType: 'rich-text' | 'table' | 'whiteboard' = 'rich-text'
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify folder ownership or editor access
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id, is_shared')
    .eq('id', folderId)
    .single()

  if (!folder) return { error: 'Folder not found' }

  const isOwner = folder.owner_id === user.id
  let hasEditorAccess = false

  if (!isOwner) {
    // Check if user has editor access
    const { data: access } = await supabase
      .from('wiki_folder_access')
      .select('access_level')
      .eq('folder_id', folderId)
      .eq('user_id', user.id)
      .single()

    hasEditorAccess = access?.access_level === 'editor'
  }

  if (!isOwner && !hasEditorAccess) {
    return { error: 'Not authorized' }
  }

  // Set initial content based on document type
  let initialContent = {}
  if (documentType === 'table') {
    initialContent = {
      headers: ['Column 1', 'Column 2', 'Column 3'],
      rows: [['', '', ''], ['', '', ''], ['', '', '']]
    }
  }

  // Get the highest position for documents in this folder
  const { data: docs } = await supabase
    .from('wiki_documents')
    .select('position')
    .eq('folder_id', folderId)
    .order('position', { ascending: false })
    .limit(1)

  const newPosition = docs && docs.length > 0 ? docs[0].position + 1 : 0

  const { data, error } = await supabase
    .from('wiki_documents')
    .insert({
      title,
      content: initialContent,
      document_type: documentType,
      owner_id: user.id,
      folder_id: folderId,
      is_shared: folder.is_shared,
      position: newPosition,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { data }
}

export async function updateWikiDocument(docId: string, updates: { title?: string; content?: any }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get document with folder info
  const { data: doc } = await supabase
    .from('wiki_documents')
    .select('owner_id, folder_id')
    .eq('id', docId)
    .single()

  if (!doc) return { error: 'Document not found' }

  const isDocOwner = doc.owner_id === user.id
  let hasEditorAccess = false

  if (!isDocOwner) {
    // Check if user has editor access to the folder
    const { data: access } = await supabase
      .from('wiki_folder_access')
      .select('access_level')
      .eq('folder_id', doc.folder_id)
      .eq('user_id', user.id)
      .single()

    hasEditorAccess = access?.access_level === 'editor'
  }

  if (!isDocOwner && !hasEditorAccess) {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('wiki_documents')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', docId)

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { success: true }
}

export async function deleteWikiDocument(docId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get document with folder info
  const { data: doc } = await supabase
    .from('wiki_documents')
    .select('owner_id, folder_id')
    .eq('id', docId)
    .single()

  if (!doc) return { error: 'Document not found' }

  // Check if user is folder owner
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', doc.folder_id)
    .single()

  const isFolderOwner = folder?.owner_id === user.id
  const isDocOwner = doc.owner_id === user.id
  let hasEditorAccess = false

  if (!isFolderOwner && !isDocOwner) {
    // Check if user has editor access to the folder
    const { data: access } = await supabase
      .from('wiki_folder_access')
      .select('access_level')
      .eq('folder_id', doc.folder_id)
      .eq('user_id', user.id)
      .single()

    hasEditorAccess = access?.access_level === 'editor'
  }

  if (!isFolderOwner && !isDocOwner && !hasEditorAccess) {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('wiki_documents')
    .delete()
    .eq('id', docId)

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { success: true }
}

/**
 * Get user's access level for a folder
 * Returns 'owner', 'editor', 'viewer', or null
 */
export async function getUserFolderAccess(folderId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if user is the owner
  const { data: folder } = await supabase
    .from('wiki_folders')
    .select('owner_id')
    .eq('id', folderId)
    .single()

  if (!folder) return null
  if (folder.owner_id === user.id) return 'owner'

  // Check folder access level
  const { data: access } = await supabase
    .from('wiki_folder_access')
    .select('access_level')
    .eq('folder_id', folderId)
    .eq('user_id', user.id)
    .single()

  if (!access) return null
  return access.access_level as 'editor' | 'viewer'
}

/**
 * Move a document to a different folder
 */
export async function moveDocumentToFolder(docId: string, targetFolderId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if user has edit access to the target folder
  const targetAccess = await getUserFolderAccess(targetFolderId)
  if (targetAccess !== 'owner' && targetAccess !== 'editor') {
    return { error: 'Not authorized to add documents to target folder' }
  }

  // Update the document's folder_id
  const { error } = await supabase
    .from('wiki_documents')
    .update({ folder_id: targetFolderId })
    .eq('id', docId)

  if (error) return { error: error.message }

  revalidatePath('/wiki')
  return { success: true }
}
