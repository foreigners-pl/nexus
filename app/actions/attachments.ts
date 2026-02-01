'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivityForUsers } from './dashboard'

export async function uploadAttachment(caseId: string, formData: FormData) {
  const supabase = await createClient()
  const file = formData.get('file') as File
  
  if (!file) {
    return { error: 'No file provided' }
  }

  try {
    // Generate unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${caseId}/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('case_attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { error: 'Failed to upload file' }
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    // Save metadata to database
    const { data: attachment, error: dbError } = await supabase
      .from('case_attachments')
      .insert({
        case_id: caseId,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user?.id
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error details:', dbError)
      console.error('Attempted insert:', {
        case_id: caseId,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user?.id
      })
      // Clean up uploaded file
      await supabase.storage.from('case_attachments').remove([filePath])
      return { error: `Failed to save attachment metadata: ${dbError.message}` }
    }

    // Log activity for case assignees
    const { data: caseData } = await supabase
      .from('cases')
      .select('case_code')
      .eq('id', caseId)
      .single()

    const { data: assignees } = await supabase
      .from('case_assignees')
      .select('user_id')
      .eq('case_id', caseId)

    const { data: actorProfile } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', user?.id)
      .single()

    const actorName = actorProfile?.display_name || actorProfile?.email || 'Someone'
    const assigneeIds = assignees?.map(a => a.user_id) || []

    if (assigneeIds.length > 0) {
      await logActivityForUsers({
        userIds: assigneeIds,
        actorId: user?.id,
        actionType: 'case_attachment_added',
        entityType: 'case',
        entityId: caseId,
        message: `${actorName} added attachment "${file.name}" to case ${caseData?.case_code || ''}`,
        metadata: {
          case_code: caseData?.case_code,
          file_name: file.name,
          actor_name: actorName,
        }
      })
    }

    revalidatePath(`/cases/${caseId}`)
    return { success: true, data: attachment }
  } catch (error) {
    console.error('Upload error:', error)
    return { error: 'Failed to upload attachment' }
  }
}

export async function getAttachments(caseId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('case_attachments')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching attachments:', error)
    return []
  }

  return data
}

export async function downloadAttachment(filePath: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.storage
    .from('case_attachments')
    .download(filePath)

  if (error) {
    console.error('Download error:', error)
    return { error: 'Failed to download file' }
  }

  return { data }
}

export async function getAttachmentUrl(filePath: string) {
  const supabase = await createClient()
  
  // Use signed URL for private buckets (valid for 1 hour)
  const { data, error } = await supabase.storage
    .from('case_attachments')
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error)
    return null
  }

  return data.signedUrl
}

export async function deleteAttachment(attachmentId: string, filePath: string, caseId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get attachment info before deletion
  const { data: attachmentData } = await supabase
    .from('case_attachments')
    .select('file_name, case_id')
    .eq('id', attachmentId)
    .single()

  const actualCaseId = caseId || attachmentData?.case_id

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('case_attachments')
    .remove([filePath])

  if (storageError) {
    console.error('Storage delete error:', storageError)
    return { error: 'Failed to delete file from storage' }
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('case_attachments')
    .delete()
    .eq('id', attachmentId)

  if (dbError) {
    console.error('Database delete error:', dbError)
    return { error: 'Failed to delete attachment record' }
  }

  // Log activity for case assignees
  if (actualCaseId) {
    const { data: caseData } = await supabase
      .from('cases')
      .select('case_code')
      .eq('id', actualCaseId)
      .single()

    const { data: assignees } = await supabase
      .from('case_assignees')
      .select('user_id')
      .eq('case_id', actualCaseId)

    const { data: actorProfile } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', user?.id)
      .single()

    const actorName = actorProfile?.display_name || actorProfile?.email || 'Someone'
    const assigneeIds = assignees?.map(a => a.user_id) || []

    if (assigneeIds.length > 0) {
      await logActivityForUsers({
        userIds: assigneeIds,
        actorId: user?.id,
        actionType: 'case_attachment_removed',
        entityType: 'case',
        entityId: actualCaseId,
        message: `${actorName} removed attachment "${attachmentData?.file_name || 'file'}" from case ${caseData?.case_code || ''}`,
        metadata: {
          case_code: caseData?.case_code,
          file_name: attachmentData?.file_name,
          actor_name: actorName,
        }
      })
    }
  }

  return { success: true }
}
