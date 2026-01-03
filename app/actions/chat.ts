'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Types
export interface Conversation {
  id: string
  name: string | null
  is_group: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  active_meeting_url: string | null
  meeting_started_by: string | null
  meeting_started_at: string | null
}

export interface ConversationMember {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string
  is_admin: boolean
  users?: {
    id: string
    display_name: string | null
    email: string
  }
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string | null
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: string | null
  is_system: boolean
  created_at: string
  updated_at: string
  sender?: {
    id: string
    display_name: string | null
    email: string
  }
  reactions?: MessageReaction[]
}

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface ConversationWithDetails extends Conversation {
  members: ConversationMember[]
  last_message?: Message
  unread_count?: number
}

// Get all conversations for current user
export async function getConversations(): Promise<{ conversations: ConversationWithDetails[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { conversations: [], error: 'Not authenticated' }

  // Get conversations user is a member of
  const { data: memberData, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', user.id)

  if (memberError) return { conversations: [], error: memberError.message }
  
  const conversationIds = memberData?.map(m => m.conversation_id) || []
  if (conversationIds.length === 0) return { conversations: [] }

  // Get conversations with members
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(`
      *,
      conversation_members (
        id,
        user_id,
        is_admin,
        last_read_at
      )
    `)
    .in('id', conversationIds)
    .order('updated_at', { ascending: false })

  if (error) return { conversations: [], error: error.message }

  // Get user info for all members
  const allUserIds = new Set<string>()
  conversations?.forEach(conv => {
    conv.conversation_members?.forEach((m: any) => allUserIds.add(m.user_id))
  })

  const { data: usersData } = await supabase
    .from('users')
    .select('id, display_name, email')
    .in('id', Array.from(allUserIds))

  const usersMap = new Map(usersData?.map(u => [u.id, u]) || [])

  // Get last message and unread count for each conversation
  const result: ConversationWithDetails[] = await Promise.all(
    (conversations || []).map(async (conv) => {
      // Get last message
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Get unread count
      const membership = conv.conversation_members?.find((m: ConversationMember) => m.user_id === user.id)
      const lastReadAt = membership?.last_read_at || conv.created_at

      const { count: unreadCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .gt('created_at', lastReadAt)
        .neq('sender_id', user.id)

      // Add user info to members
      const membersWithUsers = (conv.conversation_members || []).map((m: any) => ({
        ...m,
        users: usersMap.get(m.user_id) || null
      }))

      return {
        ...conv,
        members: membersWithUsers,
        last_message: lastMsg || undefined,
        unread_count: unreadCount || 0
      }
    })
  )

  return { conversations: result }
}

// Get messages for a conversation
export async function getMessages(conversationId: string, limit = 50, before?: string): Promise<{ messages: Message[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { messages: [], error: 'Not authenticated' }

  let query = supabase
    .from('messages')
    .select(`
      *,
      reactions:message_reactions(id, user_id, emoji)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) return { messages: [], error: error.message }

  // Return in chronological order
  return { messages: (data || []).reverse() }
}

// Send a message
export async function sendMessage(
  conversationId: string, 
  content: string,
  attachment?: { url: string; name: string; type: string }
): Promise<{ message?: Message; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }
  if (!content?.trim() && !attachment) return { error: 'Message cannot be empty' }

  console.log('Sending message to conversation:', conversationId, 'content:', content?.substring(0, 50))

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content?.trim() || null,
      attachment_url: attachment?.url || null,
      attachment_name: attachment?.name || null,
      attachment_type: attachment?.type || null
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error inserting message:', error)
    return { error: error.message }
  }

  console.log('Message sent successfully:', data?.id)
  return { message: data }
}

// Create a direct message conversation (or return existing one)
export async function createDirectConversation(otherUserId: string): Promise<{ conversation?: Conversation; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }
  if (otherUserId === user.id) return { error: 'Cannot create conversation with yourself' }

  // Check if DM already exists between these users
  const { data: existingMembers } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', user.id)

  if (existingMembers && existingMembers.length > 0) {
    const convIds = existingMembers.map(m => m.conversation_id)
    
    // Find a non-group conversation that includes the other user
    const { data: otherMembers } = await supabase
      .from('conversation_members')
      .select('conversation_id, conversations!inner(is_group)')
      .eq('user_id', otherUserId)
      .in('conversation_id', convIds)
    
    const existingDM = otherMembers?.find((m: any) => !m.conversations?.is_group)
    if (existingDM) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', existingDM.conversation_id)
        .single()
      if (conv) return { conversation: conv }
    }
  }

  // Create new conversation
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({
      is_group: false,
      created_by: user.id
    })
    .select()
    .single()

  if (convError) return { error: convError.message }

  // Add both users as members
  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert([
      { conversation_id: conv.id, user_id: user.id, is_admin: false },
      { conversation_id: conv.id, user_id: otherUserId, is_admin: false }
    ])

  if (memberError) return { error: memberError.message }

  revalidatePath('/chat')
  return { conversation: conv }
}

// Create a group conversation
export async function createGroupConversation(name: string, memberIds: string[]): Promise<{ conversation?: Conversation; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }
  if (!name?.trim()) return { error: 'Group name is required' }
  if (memberIds.length < 1) return { error: 'At least one other member is required' }

  // Create conversation
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({
      name: name.trim(),
      is_group: true,
      created_by: user.id
    })
    .select()
    .single()

  if (convError) return { error: convError.message }

  // Add creator as admin
  const members = [
    { conversation_id: conv.id, user_id: user.id, is_admin: true },
    ...memberIds.map(id => ({ conversation_id: conv.id, user_id: id, is_admin: false }))
  ]

  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert(members)

  if (memberError) return { error: memberError.message }

  // Add system message
  await supabase.from('messages').insert({
    conversation_id: conv.id,
    sender_id: user.id,
    content: 'created this group',
    is_system: true
  })

  revalidatePath('/chat')
  return { conversation: conv }
}

// Mark conversation as read
export async function markConversationRead(conversationId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return {}
}

// Add reaction to message
export async function addReaction(messageId: string, emoji: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('message_reactions')
    .upsert({
      message_id: messageId,
      user_id: user.id,
      emoji
    }, { onConflict: 'message_id,user_id,emoji' })

  if (error) return { error: error.message }
  return {}
}

// Remove reaction from message
export async function removeReaction(messageId: string, emoji: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)

  if (error) return { error: error.message }
  return {}
}

// Search users for starting new conversation
export async function searchUsers(query: string): Promise<{ users: any[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { users: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, email')
    .neq('id', user.id)
    .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10)

  if (error) return { users: [], error: error.message }
  return { users: data || [] }
}

// Get all users (for group creation)
export async function getAllUsers(): Promise<{ users: any[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { users: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, email')
    .neq('id', user.id)
    .order('display_name')

  if (error) return { users: [], error: error.message }
  return { users: data || [] }
}

// Start a meeting in a conversation
export async function startMeeting(conversationId: string, meetingUrl: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { success: false, error: 'Not authenticated' }

  // Check if user is a member of the conversation
  const { data: member } = await supabase
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!member) return { success: false, error: 'Not a member of this conversation' }

  // Update conversation with meeting info
  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      active_meeting_url: meetingUrl,
      meeting_started_by: user.id,
      meeting_started_at: new Date().toISOString()
    })
    .eq('id', conversationId)

  if (updateError) return { success: false, error: updateError.message }

  // Send a system message about the meeting
  const { error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: `started a meeting`,
      is_system: true
    })

  if (messageError) return { success: false, error: messageError.message }

  revalidatePath('/chat')
  return { success: true }
}

// End a meeting in a conversation
export async function endMeeting(conversationId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { success: false, error: 'Not authenticated' }

  // Check if user is a member of the conversation
  const { data: member } = await supabase
    .from('conversation_members')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!member) return { success: false, error: 'Not a member of this conversation' }

  // Clear meeting info from conversation
  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      active_meeting_url: null,
      meeting_started_by: null,
      meeting_started_at: null
    })
    .eq('id', conversationId)

  if (updateError) return { success: false, error: updateError.message }

  // Send a system message about the meeting ending
  const { error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: `ended the meeting`,
      is_system: true
    })

  if (messageError) return { success: false, error: messageError.message }

  revalidatePath('/chat')
  return { success: true }
}

// Meeting timeout in milliseconds (2 hours)
const MEETING_TIMEOUT_MS = 2 * 60 * 60 * 1000

// Get active meeting for a conversation (auto-expires after timeout)
export async function getActiveMeeting(conversationId: string): Promise<{ 
  meetingUrl: string | null; 
  startedBy: string | null;
  startedAt: string | null;
  error?: string 
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { meetingUrl: null, startedBy: null, startedAt: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('conversations')
    .select('active_meeting_url, meeting_started_by, meeting_started_at')
    .eq('id', conversationId)
    .single()

  if (error) return { meetingUrl: null, startedBy: null, startedAt: null, error: error.message }
  
  // Check if meeting has expired (auto-end after 2 hours)
  if (data?.meeting_started_at) {
    const startedAt = new Date(data.meeting_started_at).getTime()
    const now = Date.now()
    
    if (now - startedAt > MEETING_TIMEOUT_MS) {
      // Meeting has expired - auto-end it
      await supabase
        .from('conversations')
        .update({
          active_meeting_url: null,
          meeting_started_by: null,
          meeting_started_at: null
        })
        .eq('id', conversationId)
      
      // Send system message about auto-end
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: null, // System message
          content: 'Meeting ended automatically after 2 hours',
          is_system: true
        })
      
      return { meetingUrl: null, startedBy: null, startedAt: null }
    }
  }
  
  return { 
    meetingUrl: data?.active_meeting_url || null,
    startedBy: data?.meeting_started_by || null,
    startedAt: data?.meeting_started_at || null
  }
}

// Delete a conversation (only creator or admin can delete)
export async function deleteConversation(conversationId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Check if user is the creator or an admin of this conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('created_by')
    .eq('id', conversationId)
    .single()

  if (convError) return { success: false, error: convError.message }

  const { data: membership } = await supabase
    .from('conversation_members')
    .select('is_admin')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single()

  const isCreator = conversation.created_by === user.id
  const isAdmin = membership?.is_admin === true

  if (!isCreator && !isAdmin) {
    return { success: false, error: 'Only the creator or an admin can delete this conversation' }
  }

  // Delete in order: reactions -> messages -> members -> conversation
  // First delete message reactions
  const { data: messageIds } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)

  if (messageIds && messageIds.length > 0) {
    await supabase
      .from('message_reactions')
      .delete()
      .in('message_id', messageIds.map(m => m.id))
  }

  // Delete messages
  const { error: msgError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)

  if (msgError) return { success: false, error: msgError.message }

  // Delete members
  const { error: memberError } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)

  if (memberError) return { success: false, error: memberError.message }

  // Delete conversation
  const { error: convDelError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)

  if (convDelError) return { success: false, error: convDelError.message }

  revalidatePath('/chat')
  return { success: true }
}

// Get total unread message count across all conversations
export async function getTotalUnreadCount(): Promise<{ count: number; error?: string }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, error: 'Not authenticated' }

  // Get all conversations this user is a member of with their last_read_at
  const { data: memberships, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)

  if (memberError || !memberships) return { count: 0, error: memberError?.message }

  let totalUnread = 0

  // For each conversation, count messages after last_read_at
  for (const membership of memberships) {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', membership.conversation_id)
      .neq('sender_id', user.id) // Don't count own messages
      .gt('created_at', membership.last_read_at || '1970-01-01')

    if (!error && count) {
      totalUnread += count
    }
  }

  return { count: totalUnread }
}

// Send a buzz to all members of a conversation
export async function sendBuzz(conversationId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Get sender info
  const { data: sender } = await supabase
    .from('users')
    .select('display_name, email')
    .eq('id', user.id)
    .single()

  const senderName = sender?.display_name || sender?.email?.split('@')[0] || 'Someone'

  // Create a system message for the buzz in the conversation
  const { error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: '🔔 sent a buzz!',
      is_system: true
    })

  if (messageError) return { success: false, error: messageError.message }

  // Get all members of the conversation except the sender
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', user.id)

  if (members && members.length > 0) {
    // Create activity log entries for each member
    const activityEntries = members.map(member => ({
      user_id: member.user_id,
      action_type: 'buzz',
      entity_type: 'conversation',
      entity_id: conversationId,
      message: `🔔 ${senderName} buzzed you!`,
      metadata: { sender_name: senderName, sender_id: user.id },
      is_read: false
    }))

    await supabase.from('activity_log').insert(activityEntries)
  }

  return { success: true }
}
