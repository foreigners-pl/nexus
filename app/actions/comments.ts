'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivityForUsers } from './dashboard'

export async function addComment(caseId: string, text: string) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      case_id: caseId,
      user_id: user.id,
      text: text
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding comment:', error)
    return { error: error.message }
  }

  // Log comment for all other assignees
  const { data: caseData } = await supabase
    .from('cases')
    .select('case_code, clients(first_name, last_name)')
    .eq('id', caseId)
    .single()

  const { data: assignees } = await supabase
    .from('case_assignees')
    .select('user_id')
    .eq('case_id', caseId)

  const { data: commenterProfile } = await supabase
    .from('users')
    .select('display_name, email')
    .eq('id', user.id)
    .single()

  const assigneeIds = assignees?.map(a => a.user_id) || []
  const commenterName = commenterProfile?.display_name || commenterProfile?.email || 'Someone'

  await logActivityForUsers({
    userIds: assigneeIds,
    actorId: user.id,
    actionType: 'case_comment',
    entityType: 'case',
    entityId: caseId,
    message: `${commenterName} commented on case ${caseData?.case_code || ''}`,
    metadata: {
      case_code: caseData?.case_code,
      commenter_name: commenterName,
      comment_preview: text.slice(0, 100),
    }
  })

  revalidatePath(`/cases/${caseId}`)
  return { data }
}

export async function getComments(caseId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching comments:', error)
    return []
  }

  // Get current user to compare IDs
  const { data: { user } } = await supabase.auth.getUser()

  // Add user email to each comment
  const commentsWithUser = data.map(comment => ({
    ...comment,
    users: {
      id: comment.user_id,
      email: (comment.user_id === user?.id && user) ? user.email || 'Unknown' : 'Unknown User',
      display_name: (comment.user_id === user?.id && user) ? (user.user_metadata?.display_name || user.email) : null
    }
  }))

  return commentsWithUser
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    console.error('Error deleting comment:', error)
    return { error: error.message }
  }

  return { success: true }
}
