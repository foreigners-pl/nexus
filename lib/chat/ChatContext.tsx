'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTotalUnreadCount } from '@/app/actions/chat'

interface ChatContextType {
  unreadCount: number
  refreshCount: () => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [supabase])

  const refreshCount = useCallback(async () => {
    const { count } = await getTotalUnreadCount()
    setUnreadCount(count)
  }, [])

  // Initial load
  useEffect(() => {
    refreshCount()
  }, [refreshCount])

  // Subscribe to new messages for realtime updates
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('chat-unread-count')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const newMessage = payload.new as { sender_id: string }
          // Only increment if message is from someone else
          if (newMessage.sender_id !== userId) {
            // Refresh the count (more accurate than incrementing)
            refreshCount()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // When last_read_at is updated (user read messages), refresh count
          refreshCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, refreshCount])

  return (
    <ChatContext.Provider value={{ unreadCount, refreshCount }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
