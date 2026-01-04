'use client'

import { useState, useEffect } from 'react'
import { useConversationsCache } from '@/lib/query'
import { getConversations, ConversationWithDetails } from '@/app/actions/chat'
import ChatContainer from './components/ChatContainer'

export default function ChatPage() {
  const { getCached } = useConversationsCache()
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try cache first for instant load
    const cached = getCached()
    if (cached?.conversations && cached.conversations.length > 0) {
      setConversations(cached.conversations)
      setLoading(false)
      // Still refresh in background
      getConversations().then(({ conversations: fresh }) => {
        if (fresh) setConversations(fresh)
      })
    } else {
      // No cache, load fresh
      getConversations().then(({ conversations: fresh }) => {
        setConversations(fresh || [])
        setLoading(false)
      })
    }
  }, [getCached])

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem+3rem)] -mx-6 -my-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  return (
    <div className="h-[calc(100vh-4rem+3rem)] -mx-6 -my-6">
      <ChatContainer initialConversations={conversations} />
    </div>
  )
}
