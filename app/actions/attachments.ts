'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivityForUsers } from './dashboard'

/**
 * Saves attachment metadata after the file was uploaded directly to Storage
 * by the browser. Keeping the file upload client-side avoids the server-action
 * request body limit that rejected larger files.
 */
export async function saveAttachment(caseId: string, meta: {
  file_name: string
  file_path: string
  file_size: number
  file_type: string
}, opts?: { announce?: boolean }) {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: attachment, error: dbError } = await supabase
      .from('case_attachments')
      .insert({
        case_id: caseId,
        file_name: meta.file_name,
        file_path: meta.file_path,
        file_size: meta.file_size,
        file_type: meta.file_type,
        uploaded_by: user?.id
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error details:', dbError)
      // Clean up uploaded file
      await supabase.storage.from('case_attachments').remove([meta.file_path])
      return { error: `Failed to save attachment metadata: ${dbError.message}` }
    }

    // Announce the upload in the active step's feed — mirrors the bot's
    // attach_files tool so files-page uploads surface in the process too.
    // The feed composer passes announce: false — its attachments ride on
    // the message entry it posts itself.
    if (opts?.announce) {
      const { data: c } = await supabase
        .from('cases')
        .select('current_step_id')
        .eq('id', caseId)
        .single()
      if (c?.current_step_id) {
        const { data: entry } = await supabase.from('case_entries').insert({
          case_id: caseId,
          step_id: c.current_step_id,
          kind: 'note',
          body: `Attached file: ${meta.file_name}`,
          created_by: user?.id,
        }).select('id').single()
        if (entry?.id) {
          await supabase.from('case_attachments').update({ entry_id: entry.id }).eq('id', attachment.id)
        }
      }
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
        message: `${actorName} added attachment "${meta.file_name}" to case ${caseData?.case_code || ''}`,
        metadata: {
          case_code: caseData?.case_code,
          file_name: meta.file_name,
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

  // uploaded_by has no FK to users — resolve names in a second query
  const uploaderIds = [...new Set((data || []).map(a => a.uploaded_by).filter(Boolean))] as string[]
  const names: Record<string, { display_name: string | null; email: string }> = {}
  if (uploaderIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, email')
      .in('id', uploaderIds)
    for (const u of users || []) names[u.id] = u
  }

  return (data || []).map(a => ({
    ...a,
    uploader: a.uploaded_by ? names[a.uploaded_by] ?? null : null,
  }))
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
